import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addPlayer,
  createGame,
  endTurn,
  passSpeaker,
  playCard,
  removePlayer,
  seesCard,
  startTurn,
  winnerOf,
} from './game'
import type { TabooGameState } from './game'

// Run with `npm test`.

const random = () => 0.42
const game = (
  teams: [number[], number[]] = [
    [1, 2],
    [3, 4],
  ],
  rounds = 1,
) =>
  createGame({
    settings: { roundsPerPlayer: rounds, turnSeconds: 60 },
    teams,
    cardCount: 20,
    random,
  })

const playTurn = (
  state: TabooGameState,
  ...outcomes: Array<'correct' | 'skipped' | 'taboo'>
) => {
  let s = startTurn(state, 0, random)
  for (const o of outcomes) s = playCard(s, o, random)
  return endTurn(s)
}

describe('Tabu rules', () => {
  it('gives every player of the bigger team the chosen number of turns', () => {
    assert.equal(
      game(
        [
          [1, 2],
          [3, 4],
        ],
        2,
      ).totalTurns,
      8,
    )
    assert.equal(
      game(
        [
          [1, 2, 5],
          [3, 4],
        ],
        1,
      ).totalTurns,
      6,
    )
  })

  it('alternates teams and rotates speakers inside each team', () => {
    let s = game(
      [
        [1, 2],
        [3, 4],
      ],
      2,
    )
    const speakers: number[] = []
    while (s.phase !== 'over') {
      speakers.push(s.speakerId)
      s = playTurn(s)
    }
    assert.deepEqual(speakers, [1, 3, 2, 4, 1, 3, 2, 4])
  })

  it('scores guessed cards up and buzzed cards down, for the speaking team', () => {
    let s = playTurn(game(), 'correct', 'correct', 'skipped', 'taboo')
    assert.deepEqual(s.scores, [1, 0])
    assert.equal(s.history[0].points, 1)
    // The card on the table at the buzzer counts nothing.
    assert.equal(s.history[0].results.at(-1)?.outcome, 'timeout')
    s = playTurn(s, 'taboo')
    assert.deepEqual(s.scores, [1, -1])
  })

  it('ends after the last turn with a winner, or a tie', () => {
    let s = game()
    s = playTurn(s, 'correct')
    s = playTurn(s)
    s = playTurn(s)
    assert.equal(winnerOf(s), null)
    s = playTurn(s, 'correct')
    assert.equal(s.phase, 'over')
    assert.equal(winnerOf(s), 'tie')
  })

  it('never deals the same card twice in a row and refills an empty deck', () => {
    let s = startTurn({ ...game(), deck: [7] }, 0, random)
    assert.equal(s.cardId, 7)
    assert.equal(s.deck.length, 0)
    s = playCard(s, 'correct', random)
    assert.notEqual(s.cardId, 7)
    assert.ok(s.cardId !== null && s.cardId >= 0 && s.cardId < 20)
  })

  it('shows the card to the speaker and the other team only', () => {
    const s = startTurn(game(), 0, random)
    assert.equal(seesCard(s, 1), true)
    assert.equal(seesCard(s, 2), false)
    assert.equal(seesCard(s, 3), true)
    assert.equal(seesCard(s, null), false)
  })

  it('passes a turn that has not started to the next teammate', () => {
    const s = passSpeaker(game())
    assert.equal(s?.speakerId, 2)
    assert.equal(passSpeaker(game([[1], [3, 4]])), null)
  })

  it('takes late arrivals into the smaller team', () => {
    const s = addPlayer(
      game([
        [1, 2, 5],
        [3, 4],
      ]),
      9,
    )
    assert.deepEqual(s.teams[1], [3, 4, 9])
  })

  it('hands the turn on when the speaker leaves, and ends a game left without a team', () => {
    let s = removePlayer(game(), 1)
    assert.equal(s.speakerId, 2)
    s = removePlayer(startTurn(game(), 0, random), 1)
    assert.equal(s.phase, 'ready')
    assert.equal(s.speakerId, 3)
    s = removePlayer(removePlayer(game(), 3), 4)
    assert.equal(s.phase, 'over')
  })
})
