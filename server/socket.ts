import type { ExtendedError } from 'socket.io'
import type {
  ClientToServerEvents,
  IOServer,
  IOSocket,
} from '../src/lib/socket-events'

type Middleware = (
  socket: IOSocket,
  next: (err?: ExtendedError) => void,
) => void

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
  // No middleware yet; step 8 adds the session check here with use(...).
  void use

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

  const onConnection = (socket: IOSocket) => {
    socketCleanups.set(socket, [])
    const onDisconnect = () => socketCleanups.delete(socket)
    socket.once('disconnect', onDisconnect)
    socketCleanups
      .get(socket)!
      .push(() => socket.off('disconnect', onDisconnect))

    listen(socket, 'ping', (payload, ack) => {
      if (typeof ack !== 'function') return
      ack({
        message: 'pong',
        serverTime: new Date().toISOString(),
        received: payload,
      })
    })

    socket.emit('hello', {
      message: 'hello',
      serverTime: new Date().toISOString(),
    })
  }

  io.on('connection', onConnection)

  // After a dev reload, sockets that connected under the previous version get
  // the new handlers (and a new hello) without having to reconnect.
  for (const socket of io.of('/').sockets.values()) onConnection(socket)

  return () => {
    active = false
    io.off('connection', onConnection)
    for (const cleanups of socketCleanups.values()) {
      for (const cleanup of cleanups) cleanup()
    }
    socketCleanups.clear()
  }
}
