import type { ExtendedError } from 'socket.io'
import { isPostRoute } from '../src/content/posts'
import { findOrCreateUser } from '../src/lib/auth/current-user.server'
import type { CurrentUser } from '../src/lib/auth/current-user.server'
import { canPlayQuiz } from '../src/lib/auth/roles'
import { readSessionFromCookieHeader } from '../src/lib/auth/session.server'
import { endGame } from '../src/lib/quiz/end-game.server'
import { nextPrint } from '../src/lib/quiz/next-print.server'
import type { QuizAck } from '../src/lib/quiz/quiz'
import { QUIZ_NOT_FOUND } from '../src/lib/quiz/quiz.server'
import { revealPrint } from '../src/lib/quiz/reveal-print.server'
import { startGame } from '../src/lib/quiz/start-game.server'
import { submitGuess } from '../src/lib/quiz/submit-guess.server'
import { createRateLimiter } from '../src/lib/rate-limit.server'
import {
  MAX_POST_ROOMS_PER_SOCKET,
  MAX_SANTORINI_ROOMS_PER_SOCKET,
  MAX_TABOO_ROOMS_PER_SOCKET,
  postRoom,
  santoriniRoom,
  tabooRoom,
  userRoom,
} from '../src/lib/realtime/events'
import type {
  ClientToServerEvents,
  IOServer,
  IOSocket,
  RoomAck,
  SantoriniAck,
  TabooAck,
} from '../src/lib/realtime/events'
import { commitTurn } from '../src/lib/santorini/commit-turn.server'
import { playAction } from '../src/lib/santorini/play-action.server'
import { resign } from '../src/lib/santorini/resign.server'
import { ROOM_CODE_PATTERN } from '../src/lib/santorini/room'
import { undoTurn } from '../src/lib/santorini/undo-turn.server'
import { endTurn as endTabooTurn } from '../src/lib/taboo/end-turn.server'
import { passSpeaker as passTabooSpeaker } from '../src/lib/taboo/pass-speaker.server'
import { playCard as playTabooCard } from '../src/lib/taboo/play-card.server'
import { ROOM_CODE_PATTERN as TABOO_ROOM_CODE_PATTERN } from '../src/lib/taboo/room'
import { announcePresence as announceTabooPresence } from '../src/lib/taboo/room.server'
import { startTurn as startTabooTurn } from '../src/lib/taboo/start-turn.server'
import { getSiteOrigin } from '../src/lib/site'

type Middleware = (
  socket: IOSocket,
  next: (err?: ExtendedError) => void,
) => void

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

const hostnameOf = (host: string) => {
  try {
    return new URL(`http://${host}`).hostname
  } catch {
    return ''
  }
}

/**
 * Whether a handshake from a page at `origin` may connect.
 *
 * A browser cannot be stopped from opening a WebSocket to any site, and it
 * attaches that site's cookies, so without this check a page on another site
 * could open a socket carrying a visitor's session. Browsers always send
 * `Origin` on a WebSocket handshake, and a page cannot change it. The rule:
 * - no `Origin`: not a browser page (curl, a script); it can send any cookie
 *   it likes anyway, so there is nothing to protect. Allowed.
 * - the site's own origin (`getSiteOrigin()`, from `SITE_URL`): allowed.
 * - when the server itself is reached on a loopback host (local development,
 *   or a production build run locally), the page at that same origin, for
 *   example `http://localhost:3100`. Never applies on the public host, so a
 *   page on another site cannot claim it.
 * - anything else, including the literal `null` origin: refused.
 * It compares against configuration and the `Host` header, never against
 * `X-Forwarded-*`, so it behaves the same behind Fly's proxy (which passes the
 * browser's `Origin` and the public `Host` through).
 */
export const isAllowedOrigin = (
  origin: string | undefined,
  host: string | undefined,
): boolean => {
  if (origin === undefined) return true
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }
  if (parsed.origin === 'null') return false
  if (parsed.origin === new URL(getSiteOrigin()).origin) return true
  return (
    host !== undefined &&
    LOOPBACK_HOSTNAMES.has(hostnameOf(host)) &&
    parsed.host === host
  )
}

// Control characters would let a name forge log lines.
const logName = (name: string | undefined) =>
  // eslint-disable-next-line no-control-regex
  (name ?? '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 60) || 'anonymous'

/**
 * Finds the `User` row of the socket's reader and puts the socket in that
 * reader's room, which is how game updates reach a player. Done once per
 * socket: at the handshake, or on the first game event if the database was
 * unreachable then. Null for a visitor; throws if the database is down.
 */
const identify = async (socket: IOSocket): Promise<number | null> => {
  // `== null`: a socket that connected before a dev reload has no field yet.
  if (socket.data.userId != null || !socket.data.user) {
    return socket.data.userId ?? null
  }
  const user = await findOrCreateUser(socket.data.user)
  // A deleted account: the socket is a visitor's from now on.
  if (!user) {
    socket.data.user = null
    return null
  }
  const { id } = user
  socket.data.userId = id
  void socket.join(userRoom(id))
  return id
}

/**
 * Game events per reader: 40 in 10 seconds. A turn is four of them, so this
 * is far above play and only stops a client that sends them in a loop.
 */
const gameEventLimiter = createRateLimiter({
  limit: 40,
  windowMs: 10_000,
  maxKeys: 5000,
})

const joinedPostRooms = (socket: IOSocket) =>
  [...socket.rooms].filter((room) => room.startsWith('post:'))

/**
 * Registers the socket.io handlers on `io` and returns a function that removes
 * every one of them again.
 *
 * `server.js` calls this once at startup. In development it calls the
 * returned dispose function and then the freshly loaded version of this
 * module whenever this file (or anything it imports) changes, so the process
 * never restarts and handlers never pile up.
 *
 * Handshake middleware (for example reading the session cookie) goes through
 * `use(...)` below rather than `io.use(...)`: socket.io cannot remove a
 * middleware, so `use` registers a wrapper that turns into a pass-through once
 * this registration is disposed.
 *
 * Per-socket listeners go through `listen(...)` so that dispose can remove
 * them from sockets that are still connected.
 */
export function registerSocketHandlers(io: IOServer): () => void {
  let active = true
  const socketCleanups = new Map<IOSocket, Array<() => void>>()

  const use = (middleware: Middleware) => {
    io.use((socket, next) => (active ? middleware(socket, next) : next()))
  }

  // 1. Refuse pages from other sites (see isAllowedOrigin).
  use((socket, next) => {
    const { origin, host } = socket.handshake.headers
    if (isAllowedOrigin(origin, host)) return next()
    console.warn(`[socket] refused a handshake from origin ${logName(origin)}`)
    next(new Error('forbidden origin'))
  })

  // 2. Read the session from the handshake's Cookie header. Visitors without
  // a (valid) session connect as anonymous: only the game events need a
  // reader. A logged-in reader is identified here (one indexed query), so
  // that the socket is in their room before any game update is sent; if the
  // database is down the socket still connects and is identified later.
  use((socket, next) => {
    socket.data.user = null
    socket.data.userId = null
    readSessionFromCookieHeader(socket.handshake.headers.cookie)
      .then((user) => {
        socket.data.user = user
        return identify(socket)
      })
      .catch((error: unknown) => {
        console.error('[socket] could not identify a reader:', error)
      })
      .then(() => next())
  })

  const listen = <E extends keyof ClientToServerEvents>(
    socket: IOSocket,
    event: E,
    listener: ClientToServerEvents[E],
  ) => {
    // socket.io's typed emitter cannot relate a generic key to its listener.
    const on = socket.on.bind(socket) as (e: E, l: typeof listener) => void
    const off = socket.off.bind(socket) as (e: E, l: typeof listener) => void
    on(event, listener)
    socketCleanups.get(socket)?.push(() => off(event, listener))
  }

  const reply = (ack: unknown, response: RoomAck) => {
    if (typeof ack === 'function') ack(response)
  }

  const joinPostRoom = (socket: IOSocket, route: unknown): RoomAck => {
    if (typeof route !== 'string' || route.length > 200) {
      return { ok: false, reason: 'invalid' }
    }
    if (!isPostRoute(route)) return { ok: false, reason: 'unknown_post' }
    const room = postRoom(route)
    if (socket.rooms.has(room)) return { ok: true }
    if (joinedPostRooms(socket).length >= MAX_POST_ROOMS_PER_SOCKET) {
      return { ok: false, reason: 'too_many_rooms' }
    }
    void socket.join(room)
    return { ok: true }
  }

  const leavePostRoom = (socket: IOSocket, route: unknown): RoomAck => {
    if (typeof route !== 'string' || route.length > 200) {
      return { ok: false, reason: 'invalid' }
    }
    void socket.leave(postRoom(route))
    return { ok: true }
  }

  // Anyone may listen to a Santorini channel: `santorini:changed` carries no
  // data, and the moves pushed to a room's channel are public (games can be
  // spectated and reviewed by anyone).
  const isSantoriniChannel = (channel: unknown): channel is string =>
    typeof channel === 'string' &&
    (channel === 'lobby' || ROOM_CODE_PATTERN.test(channel))

  const joinSantoriniRoom = (socket: IOSocket, channel: unknown): RoomAck => {
    if (!isSantoriniChannel(channel)) return { ok: false, reason: 'invalid' }
    const room = santoriniRoom(channel)
    if (socket.rooms.has(room)) return { ok: true }
    const joined = [...socket.rooms].filter((r) => r.startsWith('santorini:'))
    if (joined.length >= MAX_SANTORINI_ROOMS_PER_SOCKET) {
      return { ok: false, reason: 'too_many_rooms' }
    }
    void socket.join(room)
    return { ok: true }
  }

  const leaveSantoriniRoom = (socket: IOSocket, channel: unknown): RoomAck => {
    if (!isSantoriniChannel(channel)) return { ok: false, reason: 'invalid' }
    void socket.leave(santoriniRoom(channel))
    return { ok: true }
  }

  // Tabu channels work like Santorini's. Joining a room's channel is also
  // what marks a reader as having the room open: each join and leave (and
  // each disconnection, below) tells the room's pages who is there.
  const isTabooChannel = (channel: unknown): channel is string =>
    typeof channel === 'string' &&
    (channel === 'lobby' || TABOO_ROOM_CODE_PATTERN.test(channel))

  const joinTabooRoom = (socket: IOSocket, channel: unknown): RoomAck => {
    if (!isTabooChannel(channel)) return { ok: false, reason: 'invalid' }
    const room = tabooRoom(channel)
    if (socket.rooms.has(room)) return { ok: true }
    const joined = [...socket.rooms].filter((r) => r.startsWith('taboo:'))
    if (joined.length >= MAX_TABOO_ROOMS_PER_SOCKET) {
      return { ok: false, reason: 'too_many_rooms' }
    }
    void socket.join(room)
    if (channel !== 'lobby') void announceTabooPresence(channel)
    return { ok: true }
  }

  const leaveTabooRoom = (socket: IOSocket, channel: unknown): RoomAck => {
    if (!isTabooChannel(channel)) return { ok: false, reason: 'invalid' }
    void socket.leave(tabooRoom(channel))
    if (channel !== 'lobby') void announceTabooPresence(channel)
    return { ok: true }
  }

  /** The Tabu rooms (not the lobby) a socket has open. */
  const tabooRoomCodes = (socket: IOSocket) =>
    [...socket.rooms]
      .filter((r) => r.startsWith('taboo:') && r !== tabooRoom('lobby'))
      .map((r) => r.slice('taboo:'.length))

  // A Santorini game event: only a logged-in reader may send one, and every
  // one is answered. What the event does, and to whom the result is sent,
  // is in the action's own module under src/lib/santorini.
  const play = (
    socket: IOSocket,
    ack: unknown,
    action: (userId: number) => Promise<SantoriniAck | TabooAck>,
  ) => {
    const answer = (response: SantoriniAck | TabooAck) => {
      if (typeof ack === 'function') ack(response)
    }
    identify(socket)
      .then((userId) => {
        if (userId === null) {
          return {
            ok: false,
            error: 'login',
            message: 'Faça login para jogar.',
          } as const
        }
        if (!gameEventLimiter.take(String(userId)).allowed) {
          return {
            ok: false,
            error: 'rate_limited',
            message: 'Jogadas demais em pouco tempo. Espere um instante.',
          } as const
        }
        return action(userId)
      })
      .then(answer, (error: unknown) => {
        console.error('[socket] a game event failed:', error)
        answer({
          ok: false,
          error: 'unavailable',
          message: 'Não foi possível fazer a jogada agora. Tente de novo.',
        })
      })
  }

  // A quiz event. Who the socket is comes from its handshake, but what they
  // may do does not: the reader's row, and so their role, is read from the
  // database for every event, and the event's module gets that reader. To
  // someone who may not play, the quiz does not exist. What the event does is
  // in its own module under src/lib/quiz (the host's events check for an
  // admin there).
  const quiz = (
    socket: IOSocket,
    ack: unknown,
    action: (user: CurrentUser) => Promise<QuizAck>,
  ) => {
    const answer = (response: QuizAck) => {
      if (typeof ack === 'function') ack(response)
    }
    const session = socket.data.user
    Promise.resolve(session ? findOrCreateUser(session) : null)
      .then((user) => {
        if (!user || !canPlayQuiz(user.role)) return QUIZ_NOT_FOUND
        if (!gameEventLimiter.take(String(user.id)).allowed) {
          return {
            ok: false,
            error: 'rate_limited',
            message: 'Cliques demais em pouco tempo. Espere um instante.',
          } as const
        }
        return action(user)
      })
      .then(answer, (error: unknown) => {
        console.error('[socket] a quiz event failed:', error)
        answer({
          ok: false,
          error: 'unavailable',
          message: 'Não foi possível fazer isso agora. Tente de novo.',
        })
      })
  }

  const onConnection = (socket: IOSocket, announce = true) => {
    socketCleanups.set(socket, [])
    const onDisconnect = () => socketCleanups.delete(socket)
    socket.once('disconnect', onDisconnect)
    // The rooms are gone by 'disconnect', so note them on 'disconnecting'.
    let openTabooRooms: string[] = []
    const onDisconnecting = () => {
      openTabooRooms = tabooRoomCodes(socket)
    }
    const onGone = () => {
      for (const code of openTabooRooms) void announceTabooPresence(code)
    }
    socket.once('disconnecting', onDisconnecting)
    socket.once('disconnect', onGone)
    socketCleanups.get(socket)!.push(() => {
      socket.off('disconnect', onDisconnect)
      socket.off('disconnecting', onDisconnecting)
      socket.off('disconnect', onGone)
    })

    if (announce) {
      console.log(
        `[socket] ${logName(socket.data.user?.firstName)} connected (${socket.id})`,
      )
    }

    listen(socket, 'post:join', (route, ack) => {
      reply(ack, joinPostRoom(socket, route))
    })
    listen(socket, 'post:leave', (route, ack) => {
      reply(ack, leavePostRoom(socket, route))
    })
    listen(socket, 'santorini:join', (channel, ack) => {
      reply(ack, joinSantoriniRoom(socket, channel))
    })
    listen(socket, 'santorini:leave', (channel, ack) => {
      reply(ack, leaveSantoriniRoom(socket, channel))
    })
    listen(socket, 'santorini:action', (roomCode, action, ack) => {
      play(socket, ack, (userId) => playAction(userId, roomCode, action))
    })
    listen(socket, 'santorini:commit', (roomCode, ack) => {
      play(socket, ack, (userId) => commitTurn(userId, roomCode))
    })
    listen(socket, 'santorini:undo', (roomCode, ack) => {
      play(socket, ack, (userId) => undoTurn(userId, roomCode))
    })
    listen(socket, 'santorini:resign', (roomCode, ack) => {
      play(socket, ack, (userId) => resign(userId, roomCode))
    })
    listen(socket, 'taboo:join', (channel, ack) => {
      reply(ack, joinTabooRoom(socket, channel))
    })
    listen(socket, 'taboo:leave', (channel, ack) => {
      reply(ack, leaveTabooRoom(socket, channel))
    })
    listen(socket, 'taboo:start-turn', (roomCode, ack) => {
      play(socket, ack, (userId) => startTabooTurn(userId, roomCode))
    })
    listen(socket, 'taboo:card', (roomCode, input, ack) => {
      play(socket, ack, (userId) => playTabooCard(userId, roomCode, input))
    })
    listen(socket, 'taboo:time-up', (roomCode, turnNumber, ack) => {
      play(socket, ack, (userId) => endTabooTurn(userId, roomCode, turnNumber))
    })
    listen(socket, 'taboo:pass', (roomCode, turnNumber, ack) => {
      play(socket, ack, (userId) =>
        passTabooSpeaker(userId, roomCode, turnNumber),
      )
    })
    listen(socket, 'quiz:guess', (input, ack) => {
      quiz(socket, ack, (user) => submitGuess(user, input))
    })
    listen(socket, 'quiz:start', (input, ack) => {
      quiz(socket, ack, (user) => startGame(user, input))
    })
    listen(socket, 'quiz:reveal', (input, ack) => {
      quiz(socket, ack, (user) => revealPrint(user, input))
    })
    listen(socket, 'quiz:next', (input, ack) => {
      quiz(socket, ack, (user) => nextPrint(user, input))
    })
    listen(socket, 'quiz:end', (input, ack) => {
      quiz(socket, ack, (user) => endGame(user, input))
    })
  }

  io.on('connection', onConnection)

  // After a dev reload, sockets that connected under the previous version get
  // the new handlers without having to reconnect (and keep their rooms).
  for (const socket of io.of('/').sockets.values()) onConnection(socket, false)

  return () => {
    active = false
    io.off('connection', onConnection)
    for (const cleanups of socketCleanups.values()) {
      for (const cleanup of cleanups) cleanup()
    }
    socketCleanups.clear()
  }
}
