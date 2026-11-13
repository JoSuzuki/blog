// The socket.io protocol: the event map and the room names, shared by the
// socket.io server (`server/socket.ts`), server-side app code (`getIO()` in
// `./io.server`) and the browser client (`./post-socket`, which imports only
// the types).

import type { Server, Socket } from 'socket.io'
import type { SessionUser } from '~/lib/auth/session-user'
import type { CommentView } from '~/lib/comments/comment'

/** The socket.io room that receives a post's live events. */
export const postRoom = (route: string) => `post:${route}`

/** At most this many post rooms per socket (a page needs one, a navigation briefly two). */
export const MAX_POST_ROOMS_PER_SOCKET = 3

/** Sent to a post's room when a comment has been stored. */
export interface CommentCreatedPayload {
  /** The post's route, for example `/posts/potential`. */
  route: string
  comment: CommentView
}

/** Answer to `post:join` and `post:leave`. */
export type RoomAck =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'unknown_post' | 'too_many_rooms' }

export interface ServerToClientEvents {
  /** A comment was posted on a post this socket has joined. */
  'comment:created': (payload: CommentCreatedPayload) => void
}

/**
 * The only things a client can say. Nothing here is relayed to other clients:
 * comments reach the room only through the `createComment` server function.
 */
export interface ClientToServerEvents {
  /** Starts receiving `comment:created` for a post. Idempotent. */
  'post:join': (route: string, ack?: (response: RoomAck) => void) => void
  /** Stops receiving them. */
  'post:leave': (route: string, ack?: (response: RoomAck) => void) => void
}

export interface InterServerEvents {}

// Per-socket data, filled by the handshake middleware in server/socket.ts.
export interface SocketData {
  /** The signed-in reader from the session cookie, or null for a visitor. */
  user: SessionUser | null
}

/** The typed socket.io server (`getIO()` returns it). */
export type IOServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>

/** A typed server-side socket. */
export type IOSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>
