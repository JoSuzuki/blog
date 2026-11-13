import type { GameState } from './game'

// What the pages get about a Santorini room, shared by the room actions and
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
}

/** A room in the list of rooms waiting for players. */
export interface RoomSummary {
  roomCode: string
  creatorName: string
  playerCount: number
}

export const ROOM_SIZE = 2

/** Room codes are six characters of A-Z and 0-9. */
export const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/

/** Why a room action was refused; `message` is ready to show. */
export interface RoomActionError {
  ok: false
  error: 'login' | 'not_found' | 'invalid' | 'conflict' | 'rate_limited'
  message: string
}
