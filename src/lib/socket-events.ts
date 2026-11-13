// Event map shared by the socket.io server (`server/socket.ts`), server-side
// app code (`getIO()` in `~/lib/io.server`) and browser clients. Type-only:
// importing it adds nothing to any bundle.

import type { Server, Socket } from 'socket.io'
import type { SessionUser } from '~/lib/auth/types'
import type { CommentView } from '~/lib/comments/comments.server'

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
