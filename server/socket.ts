import type { ExtendedError } from 'socket.io'
import { getPosts } from '../src/content/posts'
import { readSessionFromCookieHeader } from '../src/lib/auth/session-cookie.server'
import { getSiteOrigin } from '../src/lib/site'
import type {
  ClientToServerEvents,
  IOServer,
  IOSocket,
  RoomAck,
} from '../src/lib/socket-events'
import { MAX_POST_ROOMS_PER_SOCKET, postRoom } from '../src/lib/socket-rooms'

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

const isKnownRoute = (route: string) =>
  getPosts({ includeSecret: true }).some((post) => post.route === route)

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
  // a (valid) session connect as anonymous: nothing here requires login.
  use((socket, next) => {
    readSessionFromCookieHeader(socket.handshake.headers.cookie).then(
      (user) => {
        socket.data.user = user
        next()
      },
      // readSessionFromCookieHeader never rejects; belt and braces.
      () => {
        socket.data.user = null
        next()
      },
    )
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
    if (!isKnownRoute(route)) return { ok: false, reason: 'unknown_post' }
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
