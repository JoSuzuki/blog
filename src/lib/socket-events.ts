// Event map shared by the socket.io server (`server/socket.ts`), server-side
// app code (`getIO()` in `~/lib/io.server`) and browser clients. Type-only:
// importing it adds nothing to any bundle.

import type { Server, Socket } from 'socket.io'

export type HelloPayload = {
  message: string
  serverTime: string
}

export type PingAck = {
  message: string
  serverTime: string
  received: unknown
}

export type DevBroadcastPayload = {
  message: string
  serverTime: string
}

export interface ServerToClientEvents {
  /** Sent to each socket right after it connects. */
  hello: (payload: HelloPayload) => void
  /** Emitted to everyone by the `/dev/socket` server function (temporary). */
  'dev:broadcast': (payload: DevBroadcastPayload) => void
}

export interface ClientToServerEvents {
  /** Round trip check: the server answers through the acknowledgement. */
  ping: (payload: unknown, ack: (response: PingAck) => void) => void
}

export interface InterServerEvents {}

// Per-socket data, filled by handshake middleware (the session user, later).
export interface SocketData {}

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
