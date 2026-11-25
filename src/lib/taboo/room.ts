import type { CardOutcome, TabooSettings, Team, TurnPhase } from './game'

// What the pages get about a Tabu room, shared by the room actions, the socket
// events and the components. No server code here: the browser bundle imports
// this module.

export const TABOO_PATH = '/games/tabu'

export type RoomStatus = 'WAITING' | 'PLAYING' | 'FINISHED'

export interface CardFace {
  /** 0-based index in the deck file, shown as the card's number. */
  id: number
  word: string
  taboo: string[]
}

export interface PlayedCard {
  card: CardFace
  outcome: CardOutcome
}

export interface RoomPlayerView {
  /** The seat's id, which is the player id inside the game state. */
  id: number
  /** First name only: it is shown to whoever else is in the room. */
  name: string
  team: Team
}

export interface TurnView {
  number: number
  team: Team
  speakerId: number
  points: number
  cards: PlayedCard[]
}

/**
 * The game as one player may see it. The deck never leaves the server, and
 * the card on the table only reaches the speaker and the other team.
 */
export interface GameView {
  settings: TabooSettings
  teams: [number[], number[]]
  turnNumber: number
  totalTurns: number
  scores: [number, number]
  phase: TurnPhase
  team: Team
  speakerId: number
  /** Epoch milliseconds on the server's clock, while playing. */
  endsAt: number | null
  /** The card on the table, if this player may see it. */
  card: CardFace | null
  /** Grows with every card played this turn, for everyone (animations). */
  cardSerial: number
  /** Cards already played this turn, open to everyone. */
  played: PlayedCard[]
  /** The turn that ended last, for the summary between turns. */
  lastTurn: TurnView | null
  /** Points per finished turn, oldest first. */
  history: Array<{ team: Team; speakerId: number; points: number }>
  /** Who speaks next for each team. */
  upNext: [number | null, number | null]
  winner: Team | 'tie' | null
}

export interface RoomView {
  roomCode: string
  status: RoomStatus
  players: RoomPlayerView[]
  /** Whoever has been in the room the longest: changes the settings. */
  hostId: number | null
  /** The viewer's seat, or null for a reader who has not joined (yet). */
  myPlayerId: number | null
  settings: TabooSettings
  /** Null until the game starts. */
  game: GameView | null
  /** Seats with the room open in some tab right now. */
  online: number[]
  /** Grows with every write to the room. */
  version: number
  /** The server's clock when this view was made, to line up the timer. */
  serverNow: number
}

/** A room in the list of open rooms. */
export interface RoomSummary {
  roomCode: string
  hostName: string
  playerCount: number
  status: Extract<RoomStatus, 'WAITING' | 'PLAYING'>
}

/** Room codes are six characters of A-Z and 0-9. */
export const ROOM_CODE_PATTERN = /^[A-Z0-9]{6}$/

/** Why an action was refused; `message` is ready to show. */
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

export const TEAM_NAMES: Record<Team, string> = { 0: 'Azul', 1: 'Vermelho' }
