import type { GameState } from './game'

// What the pages get about a Santorini room or game, shared by the actions and
// the components. No server code here: the browser bundle imports this module.

export type RoomStatus = 'WAITING' | 'PLAYING' | 'FINISHED'

export interface RoomPlayerView {
  /** The seat's id, which is the `playerId` inside the game state. */
  id: number
  /** First name only: it is shown to whoever else is in the room. */
  name: string
  winner: boolean
}

export interface RoomView {
  roomCode: string
  status: RoomStatus
  players: RoomPlayerView[]
  /** The viewer's seat, or null for a reader who has not joined (yet). */
  myPlayerId: number | null
  /** Null until the game starts. */
  gameState: GameState | null
  /** Grows with every write to the room (see SantoriniGameUpdate). */
  version: number
}

/** A game in the history: being played or finished. */
export interface GameSummary {
  /** The game's permanent id: codes are reused once a game is over. */
  id: number
  roomCode: string
  status: 'PLAYING' | 'FINISHED'
  players: Omit<RoomPlayerView, 'id'>[]
  /** When the last move was written (the end, for a finished game). */
  updatedAt: string
}

/** One game as anyone may see it, to spectate or review. */
export interface GameView {
  id: number
  roomCode: string
  status: RoomStatus
  players: RoomPlayerView[]
  /** The viewer's seat, if they played this game (it is over then). */
  myPlayerId: number | null
  /** Null while the room is still waiting for its game to start. */
  gameState: GameState | null
  createdAt: string
  updatedAt: string
  /** See RoomView. */
  version: number
}

/** A room in the list of rooms waiting for players. */
export interface RoomSummary {
  roomCode: string
  /** Whoever has been in the room the longest (its creator, unless they left). */
  hostName: string
  playerCount: number
}

export const ROOM_SIZE = 2

/** Room codes are six characters of A-Z and 0-9. */
export const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/

/** Why a room action was refused; `message` is ready to show. */
export interface RoomActionError {
  ok: false
  error:
    | 'login'
    | 'not_found'
    | 'invalid'
    | 'conflict'
    | 'rate_limited'
    | 'unavailable'
  message: string
}
