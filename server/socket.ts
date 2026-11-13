import type { ExtendedError } from 'socket.io'
import { isPostRoute } from '../src/content/posts'
import { findOrCreateUser } from '../src/lib/auth/current-user.server'
import { readSessionFromCookieHeader } from '../src/lib/auth/session.server'
import { createRateLimiter } from '../src/lib/rate-limit.server'
import {
  MAX_POST_ROOMS_PER_SOCKET,
  MAX_SANTORINI_ROOMS_PER_SOCKET,
  postRoom,
  santoriniRoom,
  userRoom,
} from '../src/lib/realtime/events'
import type {
  ClientToServerEvents,
  IOServer,
  IOSocket,
  RoomAck,
  SantoriniAck,
} from '../src/lib/realtime/events'
import { commitTurn } from '../src/lib/santorini/commit-turn.server'
import { playAction } from '../src/lib/santorini/play-action.server'
import { resign } from '../src/lib/santorini/resign.server'
import { ROOM_CODE_PATTERN } from '../src/lib/santorini/room'
import { undoTurn } from '../src/lib/santorini/undo-turn.server'
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
  const { id } = await findOrCreateUser(socket.data.user)
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

  // Santorini channels carry no data (see SantoriniChangedPayload), so anyone
  // may listen; what a reader may see is decided by the loaders.
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

  // A Santorini game event: only a logged-in reader may send one, and every
  // one is answered. What the event does, and to whom the result is sent,
  // is in the action's own module under src/lib/santorini.
  const play = (
    socket: IOSocket,
    ack: unknown,
    action: (userId: number) => Promise<SantoriniAck>,
  ) => {
    const answer = (response: SantoriniAck) => {
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
        console.error('[socket] a Santorini game event failed:', error)
        answer({
          ok: false,
          error: 'unavailable',
          message: 'Não foi possível fazer a jogada agora. Tente de novo.',
        })
      })
  }

  const onConnection = (socket: IOSocket, announce = true) => {
    socketCleanups.set(socket, [])
    const onDisconnect = () => socketCleanups.delete(socket)
    socket.once('disconnect', onDisconnect)
    socketCleanups
      .get(socket)!
      .push(() => socket.off('disconnect', onDisconnect))

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
