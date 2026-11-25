import type { TabooAck } from '~/lib/realtime/events'
import { startTurn as start } from './game'
import { commitGame, findSeatInGame, refuse, secureRandom } from './room.server'

/**
 * The `taboo:start-turn` socket event: the speaker is ready and starts the
 * clock. The first card goes on the table for them and the other team.
 */
export const startTurn = async (
  userId: number,
  roomCode: unknown,
): Promise<TabooAck> => {
  // 1. The player's seat in the running game.
  const seat = await findSeatInGame({ id: userId }, roomCode)
  if ('ok' in seat) return seat
  const { room, gameState, playerId } = seat

  // 2. Only the speaker, only before their turn has started.
  if (gameState.phase !== 'ready') {
    return refuse('invalid', 'O turno já começou.')
  }
  if (gameState.speakerId !== playerId) {
    return refuse('invalid', 'Não é a sua vez de falar.')
  }

  // 3. Start the clock and push it to everyone.
  return commitGame(room, start(gameState, Date.now(), secureRandom))
}
