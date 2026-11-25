import type { Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from './events'

// The page's one socket.io connection, shared by everything live on it
// (`./post-socket`, `./santorini-socket`, `./quiz-socket`, `./taboo-socket`).
// Nothing here runs on import, and socket.io-client itself is not part of any
// page's bundle: the first `acquireSocket` call (from an effect, so never
// during server rendering or hydration) downloads it and then creates the
// connection, which is closed shortly after the last user releases it. Pages
// with nothing live never get either.

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>

/** Closing waits a moment so moving from one page to the next keeps the socket. */
const CLOSE_DELAY_MS = 2000

let socket: ClientSocket | null = null
/** The download of socket.io-client, while it is under way. */
let loading: Promise<ClientSocket | null> | null = null
let users = 0
let closeTimer: ReturnType<typeof setTimeout> | undefined
const setups = new Set<(socket: ClientSocket) => void>()

/**
 * Downloads socket.io-client and creates the socket. Resolves to null when
 * nobody wants it any more by the time it arrives, or when the download
 * fails: the pages are then simply not live, and the next `acquireSocket`
 * tries again.
 */
const load = (): Promise<ClientSocket | null> =>
  (loading ??= import('socket.io-client')
    .then(({ io }) => {
      if (socket || users === 0) return socket
      // WebSocket only: no long-polling fallback to keep alive or to pile up
      // requests in the console. Where WebSockets are blocked, the pages
      // simply are not live. Reconnection backs off to 30 s between attempts.
      const created: ClientSocket = io({
        transports: ['websocket'],
        reconnectionDelayMax: 30_000,
      })
      // Without a listener socket.io-client stays quiet; the browser itself
      // logs failed WebSocket attempts, which is all there is to see.
      created.on('connect_error', () => {})
      socket = created
      for (const setup of setups) setup(created)
      return created
    })
    .catch((error: unknown) => {
      console.error('Could not load socket.io-client:', error)
      return null
    })
    .finally(() => {
      loading = null
    }))

/**
 * Registers the listeners a module needs on the socket. `setup` runs on the
 * current socket, if there is one, and on every socket created later (the
 * connection is closed and recreated as pages come and go).
 */
export const onSocketCreated = (setup: (socket: ClientSocket) => void) => {
  setups.add(setup)
  if (socket) setup(socket)
}

/**
 * Takes a share of the socket, which is created if needed. Pair every call
 * with releaseSocket. Returns the socket if there is one already; null means
 * it is on its way (the library is still downloading), and the 'connect'
 * listeners registered with onSocketCreated run once it is there.
 */
export const acquireSocket = (): ClientSocket | null => {
  clearTimeout(closeTimer)
  users += 1
  if (!socket) void load()
  return socket
}

/** The socket as it is now: null before it is created and after it closes. */
export const getSocket = (): ClientSocket | null => socket

/**
 * The socket once it exists, for sending an event. Call it between
 * acquireSocket and releaseSocket. Null if it could not be created.
 */
export const whenSocketReady = (): Promise<ClientSocket | null> =>
  socket ? Promise.resolve(socket) : load()

/**
 * Connects again if there is a connection. The server reads the session
 * cookie once, at the handshake, so this is what follows a login or logout:
 * the new connection carries the new identity, and the 'connect' listeners
 * join their rooms again.
 */
export const reconnectSocket = () => {
  if (socket) socket.disconnect().connect()
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
