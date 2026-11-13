import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from './events'

// The page's one socket.io connection, shared by everything live on it
// (`./post-socket`, `./santorini-socket`). Nothing here runs on import: the
// connection is created by the first `acquireSocket` call (from an effect,
// so never during server rendering or hydration) and closed shortly after
// the last user releases it. Pages with nothing live never get one.

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/** Closing waits a moment so moving from one page to the next keeps the socket. */
const CLOSE_DELAY_MS = 2000

let socket: ClientSocket | null = null
let users = 0
let closeTimer: ReturnType<typeof setTimeout> | undefined
const setups = new Set<(socket: ClientSocket) => void>()

/**
 * Registers the listeners a module needs on the socket. `setup` runs on the
 * current socket, if there is one, and on every socket created later (the
 * connection is closed and recreated as pages come and go).
 */
export const onSocketCreated = (setup: (socket: ClientSocket) => void) => {
  setups.add(setup)
  if (socket) setup(socket)
}

/** The shared socket, created if needed. Pair every call with releaseSocket. */
export const acquireSocket = (): ClientSocket => {
  clearTimeout(closeTimer)
  users += 1
  if (!socket) {
    // WebSocket only: no long-polling fallback to keep alive or to pile up
    // requests in the console. Where WebSockets are blocked, the pages simply
    // are not live. Reconnection backs off to 30 s between attempts.
    socket = io({ transports: ['websocket'], reconnectionDelayMax: 30_000 })
    // Without a listener socket.io-client stays quiet; the browser itself
    // logs failed WebSocket attempts, which is all there is to see.
    socket.on('connect_error', () => {})
    for (const setup of setups) setup(socket)
  }
  return socket
}

export const releaseSocket = () => {
  users -= 1
  if (users > 0) return
  clearTimeout(closeTimer)
  closeTimer = setTimeout(() => {
    if (users === 0) {
      socket?.close()
      socket = null
    }
  }, CLOSE_DELAY_MS)
}
