import { z } from 'zod'
import type { TabooAck } from '~/lib/realtime/events'
import {
  LATE_PLAY_GRACE_MS,
  endTurn,
  otherTeam,
  playCard as play,
} from './game'
import { commitGame, findSeatInGame, refuse, secureRandom } from './room.server'

const inputSchema = z.object({
  cardId: z.number().int().min(0),
  outcome: z.enum(['correct', 'skipped', 'taboo']),
})

/**
 * The `taboo:card` socket event: the card on the table was guessed or
 * skipped (the speaker says so) or a forbidden word was said (someone on the
 * other team buzzes). The card is named, so a buzz that arrives after the
 * speaker moved on cannot hit the next card.
 */
export const playCard = async (
  userId: number,
  roomCode: unknown,
  input: unknown,
): Promise<TabooAck> => {
  // 1. Validate, and the player's seat in the running game.
  const parsed = inputSchema.safeParse(input)
  if (!parsed.success) return refuse('invalid', 'Jogada inválida.')
  const seat = await findSeatInGame({ id: userId }, roomCode)
  if ('ok' in seat) return seat
  const { room, gameState, playerId } = seat
  const { cardId, outcome } = parsed.data

  // 2. A turn must be running, on this very card.
  if (gameState.phase !== 'playing' || gameState.endsAt === null) {
    return refuse('invalid', 'O turno não está rolando.')
  }
  if (gameState.cardId !== cardId) {
    return refuse('conflict', 'Essa carta já saiu da mesa.')
  }

  // 3. Who may do what: the speaker scores and skips, the other team buzzes.
  if (outcome === 'taboo') {
    if (!gameState.teams[otherTeam(gameState.team)].includes(playerId)) {
      return refuse('invalid', 'Só o outro time pode apertar Tabu.')
    }
  } else if (gameState.speakerId !== playerId) {
    return refuse('invalid', 'Só quem está falando pode fazer isso.')
  }

  // 4. Too late: the clock ran out, so the turn ends instead.
  if (Date.now() > gameState.endsAt + LATE_PLAY_GRACE_MS) {
    await commitGame(room, endTurn(gameState))
    return refuse('invalid', 'O tempo acabou.')
  }

  // 5. Score it, draw the next card, push to everyone.
  return commitGame(room, play(gameState, outcome, secureRandom))
}
