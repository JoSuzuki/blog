// The rules of Santorini, ported from mazeps (app/lib/santorini.ts). Pure
// functions over a JSON-serialisable state, shared by the server actions
// (which decide what is legal) and the board in the browser (which uses the
// same checks to show what can be clicked). No server code here.
//
// A turn is a list of pending actions the player can still undo. While the
// workers are being placed it is two `place_worker`; afterwards it is
// `select_worker`, `move_worker`, `build_from_worker`. Nothing is written to
// `workers` or `board` until the turn is committed: applyTurnActions gives the
// board as it looks with the pending actions played.

export const BOARD_SIZE = 5
/** Levels 1 to 3 are floors; the fourth build on a tile is a dome. */
export const DOME_HEIGHT = 4
export const WINNING_HEIGHT = 3

export interface Position {
  x: number
  y: number
}

export type ActionType =
  | 'place_worker'
  | 'select_worker'
  | 'move_worker'
  | 'build_from_worker'
  | 'commit_actions'

export interface Action {
  type: ActionType
  tile: Position
  /** The seat (SantoriniRoomPlayer id) of whoever played it. */
  playerId: number
}

export interface Tile {
  height: number
}

export interface Worker {
  playerId: number
  position: Position
}

/** `board[y][x]`, five rows of five tiles. */
export type Board = Tile[][]

export interface GameState {
  phase: 'placement' | 'move_and_build'
  currentTurn: {
    playerId: number
    actions: Action[]
  }
  workers: Worker[]
  board: Board
  history: Action[]
}

export const createGameState = (firstPlayerId: number): GameState => ({
  phase: 'placement',
  currentTurn: { playerId: firstPlayerId, actions: [] },
  workers: [],
  board: Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => ({ height: 0 })),
  ),
  history: [],
})

const samePosition = (a: Position, b: Position) => a.x === b.x && a.y === b.y

const withinBoard = ({ x, y }: Position) =>
  Number.isInteger(x) &&
  Number.isInteger(y) &&
  x >= 0 &&
  x < BOARD_SIZE &&
  y >= 0 &&
  y < BOARD_SIZE

/** Next to `from`, diagonals included, and not `from` itself. */
const adjacent = (from: Position, to: Position) =>
  Math.abs(to.x - from.x) <= 1 &&
  Math.abs(to.y - from.y) <= 1 &&
  !samePosition(from, to)

const workerAt = (gameState: GameState, tile: Position) =>
  gameState.workers.find((worker) => samePosition(worker.position, tile))

const heightAt = (gameState: GameState, tile: Position) =>
  gameState.board[tile.y][tile.x].height

const countActions = (gameState: GameState, type: ActionType) =>
  gameState.currentTurn.actions.filter((action) => action.type === type).length

/**
 * What `playerId` has to do next in the current turn, `commit_actions` once
 * the turn is complete, or null when it is not their turn.
 */
export const getNextActionType = (
  gameState: GameState,
  playerId: number,
): ActionType | null => {
  if (gameState.currentTurn.playerId !== playerId) return null

  if (gameState.phase === 'placement') {
    return countActions(gameState, 'place_worker') < 2
      ? 'place_worker'
      : 'commit_actions'
  }
  if (countActions(gameState, 'select_worker') === 0) return 'select_worker'
  if (countActions(gameState, 'move_worker') === 0) return 'move_worker'
  if (countActions(gameState, 'build_from_worker') === 0) {
    return 'build_from_worker'
  }
  return 'commit_actions'
}

/**
 * Whether `action` is legal now. `gameState` must already have the turn's
 * pending actions applied (applyTurnActions), so that a second worker cannot
 * be placed on the first and a build sees where the worker moved to.
 * `nextActionType` is getNextActionType for the same player.
 */
export const canExecuteAction = (
  gameState: GameState,
  action: Action,
  nextActionType: ActionType | null,
): boolean => {
  if (gameState.currentTurn.playerId !== action.playerId) return false
  if (nextActionType !== action.type) return false
  if (action.type === 'commit_actions') return true
  if (!withinBoard(action.tile)) return false

  switch (action.type) {
    case 'place_worker':
      return !workerAt(gameState, action.tile)
    case 'select_worker':
      return workerAt(gameState, action.tile)?.playerId === action.playerId
    case 'move_worker': {
      // The pending move has not happened yet, so the selected worker still
      // stands where it was selected.
      const from = gameState.currentTurn.actions.find(
        (a) => a.type === 'select_worker',
      )?.tile
      if (!from) return false
      return (
        adjacent(from, action.tile) &&
        heightAt(gameState, action.tile) - heightAt(gameState, from) <= 1 &&
        heightAt(gameState, action.tile) < DOME_HEIGHT &&
        !workerAt(gameState, action.tile)
      )
    }
    case 'build_from_worker': {
      const from = gameState.currentTurn.actions.find(
        (a) => a.type === 'move_worker',
      )?.tile
      if (!from) return false
      return (
        adjacent(from, action.tile) &&
        heightAt(gameState, action.tile) < DOME_HEIGHT &&
        !workerAt(gameState, action.tile)
      )
    }
  }
}

/**
 * The state with the current turn's pending actions played on the workers
 * and the board. Returns a copy; the turn itself is left as it is.
 */
export const applyTurnActions = (gameState: GameState): GameState => {
  const applied = structuredClone(gameState)
  let selected: Position | undefined
  for (const action of applied.currentTurn.actions) {
    switch (action.type) {
      case 'place_worker':
        applied.workers.push({
          playerId: action.playerId,
          position: action.tile,
        })
        break
      case 'select_worker':
        selected = action.tile
        break
      case 'move_worker': {
        const worker = selected && workerAt(applied, selected)
        if (worker) worker.position = action.tile
        break
      }
      case 'build_from_worker':
        applied.board[action.tile.y][action.tile.x].height += 1
        break
    }
  }
  return applied
}

/** A worker that has just moved onto the third level wins on the spot. */
export const verifyWinningMove = (gameState: GameState): boolean => {
  const lastAction = gameState.currentTurn.actions.at(-1)
  return (
    lastAction?.type === 'move_worker' &&
    heightAt(gameState, lastAction.tile) === WINNING_HEIGHT
  )
}

const adjacentTiles = ({ x, y }: Position): Position[] =>
  [-1, 0, 1]
    .flatMap((dx) => [-1, 0, 1].map((dy) => ({ x: x + dx, y: y + dy })))
    .filter((tile) => withinBoard(tile) && !samePosition(tile, { x, y }))

export const canMoveWorker = (gameState: GameState, worker: Worker) =>
  adjacentTiles(worker.position).some(
    (tile) =>
      heightAt(gameState, tile) < DOME_HEIGHT &&
      heightAt(gameState, tile) - heightAt(gameState, worker.position) <= 1 &&
      !workerAt(gameState, tile),
  )

/**
 * Whether the player whose turn it is can move at all. One who cannot loses.
 * (A worker that can move can always build: the tile it left is free.)
 */
export const verifyCurrentPlayerCanAct = (gameState: GameState): boolean => {
  if (gameState.phase === 'placement') return true
  return gameState.workers
    .filter((worker) => worker.playerId === gameState.currentTurn.playerId)
    .some((worker) => canMoveWorker(gameState, worker))
}

/**
 * Ends the current turn: its actions are played for good, recorded in the
 * history, and the turn passes to `nextPlayerId`. Once all four workers are
 * on the board the game leaves the placement phase.
 */
export const passTurn = (
  gameState: GameState,
  nextPlayerId: number,
): GameState => {
  const applied = applyTurnActions(gameState)
  return {
    ...applied,
    phase: applied.workers.length === 4 ? 'move_and_build' : 'placement',
    currentTurn: { playerId: nextPlayerId, actions: [] },
    history: [...applied.history, ...applied.currentTurn.actions],
  }
}
