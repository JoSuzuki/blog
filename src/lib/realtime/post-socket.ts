import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import type { CommentCreatedPayload } from '~/lib/socket-events'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '~/lib/socket-events'

// The page's one socket.io connection. Nothing here runs on import: the
// connection is created by the first `subscribeToPost` call (from an effect,
// so never during server rendering or hydration) and closed shortly after the
// last subscription is removed. Pages without a comments block never get one.

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>

export interface PostSubscription {
  /** A comment was posted on the post (also called for your own). */
  onComment: (payload: CommentCreatedPayload) => void
  /**
   * Called whenever the socket (re)connects and the room has been joined,
   * including the first time: refetch the data, comments may have been posted
   * while there was no connection.
   */
  onSync: () => void
}

/** Closing waits a moment so moving from one post to the next keeps the socket. */
const CLOSE_DELAY_MS = 2000

let socket: ClientSocket | null = null
let closeTimer: ReturnType<typeof setTimeout> | undefined
const subscriptions = new Set<PostSubscription & { route: string }>()

const routesInUse = () => new Set([...subscriptions].map((s) => s.route))

const joinAndSync = (target: ClientSocket, route: string) => {
  target.emit('post:join', route, (ack) => {
    // A refused join (unknown post) leaves nothing to sync with.
    if (!ack.ok) return
    for (const sub of subscriptions) if (sub.route === route) sub.onSync()
  })
}

const connect = (): ClientSocket => {
  // WebSocket only: no long-polling fallback to keep alive or to pile up
  // requests in the console. Where WebSockets are blocked, comments simply
  // are not live. Reconnection backs off to 30 s between attempts.
  const created: ClientSocket = io({
    transports: ['websocket'],
    reconnectionDelayMax: 30_000,
  })
  // Fires on the first connection and on every reconnection (the server has
  // forgotten our rooms by then).
  created.on('connect', () => {
    for (const route of routesInUse()) joinAndSync(created, route)
  })
  created.on('comment:created', (payload) => {
    for (const sub of subscriptions) {
      if (sub.route === payload.route) sub.onComment(payload)
    }
  })
  // Without a listener socket.io-client stays quiet; the browser itself
  // logs failed WebSocket attempts, which is all there is to see.
  created.on('connect_error', () => {})
  return created
}

/**
 * Receive live events for a post. Returns the function that stops. Several
 * components may subscribe (even to the same post); they share one socket.
 */
export const subscribeToPost = (
  route: string,
  handlers: PostSubscription,
): (() => void) => {
  const subscription = { route, ...handlers }
  clearTimeout(closeTimer)
  subscriptions.add(subscription)
  socket ??= connect()
  // Already connected (a navigation, not the first subscriber): join now.
  // Otherwise the 'connect' handler joins every route in use.
  if (socket.connected) joinAndSync(socket, route)

  return () => {
    subscriptions.delete(subscription)
    if (socket?.connected && !routesInUse().has(route)) {
      socket.emit('post:leave', route)
    }
    if (subscriptions.size === 0) {
      clearTimeout(closeTimer)
      closeTimer = setTimeout(() => {
        if (subscriptions.size === 0) {
          socket?.close()
          socket = null
        }
      }, CLOSE_DELAY_MS)
    }
  }
}
