// The socket.io protocol: the event map and the room names, shared by the
// socket.io server (`server/socket.ts`), server-side app code (`getIO()` in
// `./io.server`) and the browser clients (`./post-socket` and
// `./santorini-socket`, which import only the types).

import type { Server, Socket } from 'socket.io'
import type { SessionUser } from '~/lib/auth/session-user'
import type { CommentView } from '~/lib/comments/comment'

/** The socket.io room that receives a post's live events. */
export const postRoom = (route: string) => `post:${route}`

/** At most this many post rooms per socket (a page needs one, a navigation briefly two). */
export const MAX_POST_ROOMS_PER_SOCKET = 3

/**
 * A Santorini channel is `lobby` (the list of rooms) or a room's code. This
 * is the socket.io room that hears about its changes.
 */
export const santoriniRoom = (channel: string) => `santorini:${channel}`

/** At most this many Santorini channels per socket (the list and a room). */
export const MAX_SANTORINI_ROOMS_PER_SOCKET = 3

/** Sent to a post's room when a comment has been stored. */
export interface CommentCreatedPayload {
  /** The post's route, for example `/posts/potential`. */
  route: string
  comment: CommentView
}

/**
 * Sent to a Santorini channel when what it shows changed (a room was opened,
 * someone sat down, a move was played). It says only that: the page loads
 * the new state through its loader, which checks who is asking.
 */
export interface SantoriniChangedPayload {
  channel: string
}

/** Answer to the join and leave events. */
export type RoomAck =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'unknown_post' | 'too_many_rooms' }

export interface ServerToClientEvents {
  /** A comment was posted on a post this socket has joined. */
  'comment:created': (payload: CommentCreatedPayload) => void
  /** Something changed in a Santorini channel this socket has joined. */
  'santorini:changed': (payload: SantoriniChangedPayload) => void
}

/**
 * The only things a client can say: which rooms it listens to. Nothing here
 * is relayed to other clients or changes anything. Comments and game moves
 * go through server functions, which then emit to the room.
 */
export interface ClientToServerEvents {
  /** Starts receiving `comment:created` for a post. Idempotent. */
  'post:join': (route: string, ack?: (response: RoomAck) => void) => void
  /** Stops receiving them. */
  'post:leave': (route: string, ack?: (response: RoomAck) => void) => void
  /** Starts receiving `santorini:changed` for a channel. Idempotent. */
  'santorini:join': (channel: string, ack?: (response: RoomAck) => void) => void
  /** Stops receiving them. */
  'santorini:leave': (
    channel: string,
    ack?: (response: RoomAck) => void,
  ) => void
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
