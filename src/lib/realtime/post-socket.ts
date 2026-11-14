import { acquireSocket, onSocketCreated, releaseSocket } from './connection'
import type { ClientSocket } from './connection'
import type { CommentCreatedPayload } from './events'

// Live events for a post's page, over the page's shared socket.

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

const subscriptions = new Set<PostSubscription & { route: string }>()

const routesInUse = () => new Set([...subscriptions].map((s) => s.route))

const joinAndSync = (socket: ClientSocket, route: string) => {
  socket.emit('post:join', route, (ack) => {
    // A refused join (unknown post) leaves nothing to sync with.
    if (!ack.ok) return
    for (const sub of subscriptions) if (sub.route === route) sub.onSync()
  })
}

onSocketCreated((socket) => {
  // Fires on the first connection and on every reconnection (the server has
  // forgotten our rooms by then).
  socket.on('connect', () => {
    for (const route of routesInUse()) joinAndSync(socket, route)
  })
  socket.on('comment:created', (payload) => {
    for (const sub of subscriptions) {
      if (sub.route === payload.route) sub.onComment(payload)
    }
  })
})

/**
 * Receive live events for a post. Returns the function that stops. Several
 * components may subscribe (even to the same post); they share one socket.
 */
export const subscribeToPost = (
  route: string,
  handlers: PostSubscription,
): (() => void) => {
  const subscription = { route, ...handlers }
  subscriptions.add(subscription)
  const socket = acquireSocket()
  // Already connected (a navigation, not the first subscriber): join now.
  // Otherwise the 'connect' handler joins every route in use.
  if (socket.connected) joinAndSync(socket, route)

  return () => {
    subscriptions.delete(subscription)
    if (socket.connected && !routesInUse().has(route)) {
      socket.emit('post:leave', route)
    }
    releaseSocket()
  }
}
