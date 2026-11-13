import { getIO } from '~/lib/io.server'
import { postRoom } from '~/lib/socket-rooms'
import type { CommentView } from './comments.server'

let warnedNoSocketServer = false

/**
 * Tells everyone viewing the post that a comment was stored. Never throws and
 * never waits: the emit is synchronous and any failure is only logged, so it
 * can neither fail nor delay the comment itself.
 */
export const broadcastComment = (route: string, comment: CommentView) => {
  try {
    getIO().to(postRoom(route)).emit('comment:created', { route, comment })
  } catch (error) {
    if (globalThis.__blogSocketIO) {
      console.error('Broadcasting a comment failed:', error)
    } else if (!warnedNoSocketServer) {
      // Bare `vite dev` / `vite preview`: no server.js, no socket.io.
      warnedNoSocketServer = true
      console.warn(
        'No socket.io server: comments are saved but not broadcast live.',
      )
    }
  }
}
