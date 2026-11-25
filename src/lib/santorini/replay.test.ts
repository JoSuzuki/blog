import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createGameState, passTurn } from './game'
import type { Action, ActionType, GameState } from './game'
import { describeTurn, endReasonOf, replayFrames, turnsOf } from './replay'

// Run with `npm test`.

const A = 1
const B = 2
const step = (
  playerId: number,
  type: ActionType,
  x: number,
  y: number,
): Action => ({ playerId, type, tile: { x, y } })

const PLACEMENT: Action[] = [
  step(A, 'place_worker', 0, 0),
  step(A, 'place_worker', 4, 4),
  step(B, 'place_worker', 0, 4),
  step(B, 'place_worker', 4, 0),
]

const HISTORY: Action[] = [
  ...PLACEMENT,
  step(A, 'select_worker', 0, 0),
  step(A, 'move_worker', 1, 1),
  step(A, 'build_from_worker', 2, 2),
  step(B, 'select_worker', 0, 4),
  step(B, 'move_worker', 1, 3),
  step(B, 'build_from_worker', 2, 2),
]

/** The state the server would hold after playing `history` turn by turn. */
const played = (history: Action[]): GameState => {
  let state = createGameState(A)
  for (const turn of turnsOf(history)) {
    state = passTurn(
      { ...state, currentTurn: turn },
      turn.playerId === A ? B : A,
    )
  }
  return state
}

describe('turnsOf', () => {
  it('groups the steps of one player in a row', () => {
    const turns = turnsOf(HISTORY)
    assert.deepEqual(
      turns.map((t) => [t.playerId, t.actions.length]),
      [
        [A, 2],
        [B, 2],
        [A, 3],
        [B, 3],
      ],
    )
  })

  it('has no turns for an empty history', () => {
    assert.deepEqual(turnsOf([]), [])
  })
})

describe('replayFrames', () => {
  it('starts from the empty board and ends where the game is', () => {
    const frames = replayFrames(HISTORY, [A, B])
    assert.equal(frames.length, 5)
    assert.equal(frames[0].turn, null)
    assert.equal(frames[0].gameState.workers.length, 0)

    const final = played(HISTORY)
    const last = frames.at(-1)!.gameState
    assert.deepEqual(last.board, final.board)
    assert.deepEqual(last.workers, final.workers)
    assert.equal(last.board[2][2].height, 2)
  })

  it('keeps each turn as the frame’s pending steps', () => {
    const frames = replayFrames(HISTORY, [A, B])
    assert.equal(frames[3].gameState.currentTurn.playerId, A)
    assert.deepEqual(
      frames[3].gameState.currentTurn.actions.map((a) => a.type),
      ['select_worker', 'move_worker', 'build_from_worker'],
    )
    // The worker is drawn where it moved to.
    assert.ok(
      frames[3].gameState.workers.some(
        (w) => w.playerId === A && w.position.x === 1 && w.position.y === 1,
      ),
    )
  })
})

describe('describeTurn', () => {
  const frames = replayFrames(HISTORY, [A, B])
  it('names the squares as the board labels them', () => {
    assert.equal(describeTurn(frames[0], 'Ana'), 'Tabuleiro vazio.')
    assert.equal(
      describeTurn(frames[1], 'Ana'),
      'Ana posicionou os trabalhadores em A1 e E5.',
    )
    assert.equal(
      describeTurn(frames[3], 'Ana'),
      'Ana moveu de A1 para B2 e construiu o 1º andar em C3.',
    )
    assert.equal(
      describeTurn(frames[4], 'Bia'),
      'Bia moveu de A5 para B4 e construiu o 2º andar em C3.',
    )
  })
})

describe('endReasonOf', () => {
  it('sees a climb to the third level', () => {
    const state = played(HISTORY)
    state.board[2][1].height = 3
    state.board[1][1].height = 2
    const win = [
      ...state.history,
      step(A, 'select_worker', 1, 1),
      step(A, 'move_worker', 1, 2),
    ]
    assert.equal(endReasonOf({ ...state, history: win }), 'climbed')
  })

  it('sees a player left without moves', () => {
    const state = played(PLACEMENT)
    // Domes all around B's worker in the corner A5 and around the one in E1.
    for (const [x, y] of [
      [0, 3],
      [1, 3],
      [1, 4],
      [3, 0],
      [3, 1],
      [4, 1],
    ]) {
      state.board[y][x].height = 4
    }
    const blocked = { ...state, currentTurn: { playerId: B, actions: [] } }
    assert.equal(endReasonOf(blocked), 'blocked')
  })

  it('takes anything else for a resignation', () => {
    assert.equal(endReasonOf(played(HISTORY)), 'resigned')
  })
})
