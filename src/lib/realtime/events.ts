// The socket.io protocol: the event map and the room names, shared by the
// socket.io server (`server/socket.ts`), server-side app code (`getIO()` in
// `./io.server`) and the browser clients (`./post-socket`,
// `./santorini-socket` and `./quiz-socket`, which import only the types).

import type { Server, Socket } from 'socket.io'
import type { SessionUser } from '~/lib/auth/session-user'
import type { CommentView } from '~/lib/comments/comment'
import type {
  QuizAck,
  QuizGuessInput,
  QuizHostInput,
  QuizMyGuesses,
  QuizStartInput,
  QuizState,
} from '~/lib/quiz/quiz'
import type { ActionType, GameState, Position } from '~/lib/santorini/game'
import type { RoomActionError } from '~/lib/santorini/room'
import type { PlayedOutcome } from '~/lib/taboo/game'
import type {
  RoomActionError as TabooRoomActionError,
  RoomView as TabooRoomView,
} from '~/lib/taboo/room'

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

/**
 * A Tabu channel is `lobby` (the list of rooms) or a room's code. This is the
 * socket.io room that hears about its changes; being in a room's channel is
 * also what counts as having the room open (presence).
 */
export const tabooRoom = (channel: string) => `taboo:${channel}`

/** At most this many Tabu channels per socket (the list and a room). */
export const MAX_TABOO_ROOMS_PER_SOCKET = 3

/**
 * Every socket of a logged-in reader is in this room, so the server can
 * address a reader (all their tabs) without knowing their sockets. Rooms are
 * server-side only: a client cannot join one by name.
 */
export const userRoom = (userId: number) => `user:${userId}`

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

/**
 * A game after a move, sent to its two players (their `userRoom`s) and to
 * the room's channel, where spectators listen. `version` grows with every
 * write to the room; a page keeps whichever of this and its loader data is
 * newer. A code can be used again once its game is over, so a page about
 * one game checks `roomId`.
 */
export interface SantoriniGameUpdate {
  roomId: number
  roomCode: string
  status: 'PLAYING' | 'FINISHED'
  gameState: GameState
  /** The winner's seat once the game is over. */
  winnerId: number | null
  version: number
}

/** A step of a turn, as the board sends it. */
export interface SantoriniActionInput {
  type: Exclude<ActionType, 'commit_actions'>
  tile: Position
}

/** Answer to the game events: done, or why not (with a message to show). */
export type SantoriniAck = { ok: true } | RoomActionError

/** Sent to a Tabu channel when what it shows changed; carries no data. */
export interface TabooChangedPayload {
  channel: string
}

/** Who has a Tabu room open (seat ids), sent to its channel. */
export interface TabooPresencePayload {
  roomCode: string
  online: number[]
  /** The server's clock, so a page keeps the newest. */
  at: number
}

/** The card on the table and what happened to it. */
export interface TabooCardInput {
  cardId: number
  outcome: PlayedOutcome
}

/** Answer to the Tabu game events. */
export type TabooAck = { ok: true } | TabooRoomActionError

/** Answer to the join and leave events. */
export type RoomAck =
  | { ok: true }
  | { ok: false; reason: 'invalid' | 'unknown_post' | 'too_many_rooms' }

export interface ServerToClientEvents {
  /** A comment was posted on a post this socket has joined. */
  'comment:created': (payload: CommentCreatedPayload) => void
  /** Something changed in a Santorini channel this socket has joined. */
  'santorini:changed': (payload: SantoriniChangedPayload) => void
  /** A move was played in a game this reader is a player of. */
  'santorini:game': (update: SantoriniGameUpdate) => void
  /** Something changed in a Tabu channel this socket has joined. */
  'taboo:changed': (payload: TabooChangedPayload) => void
  /**
   * A Tabu room's new state, as this reader may see it (each player gets
   * their own: the card on the table is only in some of them).
   */
  'taboo:state': (room: TabooRoomView) => void
  /** Who has a Tabu room open, after someone opened or closed it. */
  'taboo:presence': (payload: TabooPresencePayload) => void
  /**
   * The quiz changed (a guess, a reveal, the next print...). Sent to the
   * rooms of the readers who may play, and to nobody else.
   */
  'quiz:state': (state: QuizState) => void
  /** This reader's own picks for the print on screen, to their tabs only. */
  'quiz:mine': (mine: QuizMyGuesses) => void
}

/**
 * What a client can say. The join and leave events only choose which rooms
 * it listens to. The Santorini game events are the moves of a game: they are
 * answered through the ack and, when they change the game, followed by a
 * `santorini:game` to both players. The quiz events work the same way, with
 * `quiz:state` as the push; the reader's role is read from the database for
 * each one. Nothing a client sends is relayed as it is. Everything else
 * (comments, opening and joining rooms) goes through server functions.
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
  /** Adds a step (place, select, move, build) to the player's turn. */
  'santorini:action': (
    roomCode: string,
    action: SantoriniActionInput,
    ack: (response: SantoriniAck) => void,
  ) => void
  /** Ends the player's turn. */
  'santorini:commit': (
    roomCode: string,
    ack: (response: SantoriniAck) => void,
  ) => void
  /** Takes back the steps of the turn that is not committed yet. */
  'santorini:undo': (
    roomCode: string,
    ack: (response: SantoriniAck) => void,
  ) => void
  /** Gives up the game. */
  'santorini:resign': (
    roomCode: string,
    ack: (response: SantoriniAck) => void,
  ) => void
  /** Starts receiving `taboo:changed` (and presence) for a channel. */
  'taboo:join': (channel: string, ack?: (response: RoomAck) => void) => void
  /** Stops receiving them. */
  'taboo:leave': (channel: string, ack?: (response: RoomAck) => void) => void
  /** The speaker starts the clock of their turn. */
  'taboo:start-turn': (
    roomCode: string,
    ack: (response: TabooAck) => void,
  ) => void
  /** The card on the table was guessed, skipped or buzzed. */
  'taboo:card': (
    roomCode: string,
    input: TabooCardInput,
    ack: (response: TabooAck) => void,
  ) => void
  /** This page's timer for turn `turnNumber` reached zero. */
  'taboo:time-up': (
    roomCode: string,
    turnNumber: number,
    ack: (response: TabooAck) => void,
  ) => void
  /** The turn that has not started goes to the speaker's next teammate. */
  'taboo:pass': (
    roomCode: string,
    turnNumber: number,
    ack: (response: TabooAck) => void,
  ) => void
  /** Picks who a slot of the print on screen is (until the reveal). */
  'quiz:guess': (
    input: QuizGuessInput,
    ack: (response: QuizAck) => void,
  ) => void
  /** Host: starts a game. */
  'quiz:start': (
    input: QuizStartInput,
    ack: (response: QuizAck) => void,
  ) => void
  /** Host: reveals the print on screen and locks its guesses. */
  'quiz:reveal': (
    input: QuizHostInput,
    ack: (response: QuizAck) => void,
  ) => void
  /** Host: moves on to the next print, or to the end after the last. */
  'quiz:next': (input: QuizHostInput, ack: (response: QuizAck) => void) => void
  /** Host: ends the game. */
  'quiz:end': (
    input: Pick<QuizHostInput, 'gameId'>,
    ack: (response: QuizAck) => void,
  ) => void
}

export interface InterServerEvents {}

// Per-socket data, filled by the handshake middleware in server/socket.ts.
export interface SocketData {
  /** The signed-in reader from the session cookie, or null for a visitor. */
  user: SessionUser | null
  /**
   * The reader's `User` row id, once it has been looked up (at the handshake,
   * or by the first event that needs it if the database was down then).
   */
  userId: number | null
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
