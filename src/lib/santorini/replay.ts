import {
  DOME_HEIGHT,
  WINNING_HEIGHT,
  applyTurnActions,
  createGameState,
  passTurn,
  verifyCurrentPlayerCanAct,
} from './game'
import type { Action, GameState, Position } from './game'

// Reviewing a game from its `history` (every step of every committed turn,
// in order). Pure functions shared by the review page and the tests; they
// only read the rules in ./game, never change them.

/** One committed turn: who played and its steps. */
export interface Turn {
  playerId: number
  actions: Action[]
}

/** The board after a turn, with that turn's steps still marked as its own. */
export interface ReplayFrame {
  /**
   * The state to draw: the turn's steps are played on the board and kept as
   * `currentTurn.actions`, so the board marks the worker that moved. Frame 0
   * is the empty board before anyone plays.
   */
  gameState: GameState
  turn: Turn | null
}

/** Splits the history into turns: the steps of one player in a row. */
export const turnsOf = (history: Action[]): Turn[] => {
  const turns: Turn[] = []
  for (const action of history) {
    const last = turns.at(-1)
    if (last && last.playerId === action.playerId) last.actions.push(action)
    else turns.push({ playerId: action.playerId, actions: [action] })
  }
  return turns
}

/**
 * Every position of the game, one per turn, from the empty board to the
 * final one. `playerIds` are the two seats in the order they sat down; the
 * first one played first.
 */
export const replayFrames = (
  history: Action[],
  playerIds: [number, number],
): ReplayFrame[] => {
  const turns = turnsOf(history)
  let committed = createGameState(turns[0]?.playerId ?? playerIds[0])
  const frames: ReplayFrame[] = [{ gameState: committed, turn: null }]
  for (const turn of turns) {
    const playing: GameState = { ...committed, currentTurn: turn }
    frames.push({ gameState: applyTurnActions(playing), turn })
    const next = turn.playerId === playerIds[0] ? playerIds[1] : playerIds[0]
    committed = passTurn(playing, next)
  }
  return frames
}

/** How a finished game ended. */
export type EndReason = 'climbed' | 'blocked' | 'resigned'

/**
 * Why a finished game ended, from its final state: the winner's last step
 * took a worker up to the third level, or the loser had no move left when
 * their turn came, or else somebody resigned.
 */
export const endReasonOf = (gameState: GameState): EndReason => {
  const last = gameState.history.at(-1)
  if (
    last?.type === 'move_worker' &&
    gameState.board[last.tile.y][last.tile.x].height === WINNING_HEIGHT
  ) {
    return 'climbed'
  }
  return verifyCurrentPlayerCanAct(gameState) ? 'resigned' : 'blocked'
}

/** A square as the board labels it: column A-E, then row 1-5. */
export const squareName = ({ x, y }: Position) => `${'ABCDE'[x] ?? '?'}${y + 1}`

/**
 * One line about a turn, for the replay: where the workers went, or where
 * the worker moved and what it built. `frame` is the frame of that turn.
 */
export const describeTurn = (frame: ReplayFrame, name: string): string => {
  const { turn, gameState } = frame
  if (!turn) return 'Tabuleiro vazio.'
  const tiles = (type: Action['type']) =>
    turn.actions.filter((a) => a.type === type).map((a) => a.tile)

  const placed = tiles('place_worker')
  if (placed.length > 0) {
    return `${name} posicionou os trabalhadores em ${placed.map(squareName).join(' e ')}.`
  }
  const [from] = tiles('select_worker')
  const [to] = tiles('move_worker')
  const [built] = tiles('build_from_worker')
  if (!from || !to) return `${name} jogou.`
  const heightAt = (tile: Position) => gameState.board[tile.y][tile.x].height
  const move = `${name} moveu de ${squareName(from)} para ${squareName(to)}`
  if (!built) {
    return heightAt(to) === WINNING_HEIGHT
      ? `${move}, subiu ao 3º andar e venceu.`
      : `${move}.`
  }
  const height = heightAt(built)
  return height >= DOME_HEIGHT
    ? `${move} e pôs uma cúpula em ${squareName(built)}.`
    : `${move} e construiu o ${height}º andar em ${squareName(built)}.`
}
