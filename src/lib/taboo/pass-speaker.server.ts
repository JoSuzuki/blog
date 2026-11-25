import type { TabooAck } from '~/lib/realtime/events'
import { passSpeaker as pass } from './game'
import { commitGame, findSeatInGame, refuse } from './room.server'

/**
 * The `taboo:pass` socket event: the speaker is away (or does not want to
 * speak), so the turn that has not started goes to their next teammate. Any
 * player can do it; the turn itself stays with the same team.
 */
export const passSpeaker = async (
  userId: number,
  roomCode: unknown,
  turnNumber: unknown,
): Promise<TabooAck> => {
  // 1. The player's seat in the running game.
  const seat = await findSeatInGame({ id: userId }, roomCode)
  if ('ok' in seat) return seat
  const { room, gameState } = seat

  // 2. Only a turn that has not started, the one the page was showing.
  if (gameState.turnNumber !== turnNumber || gameState.phase !== 'ready') {
    return refuse('conflict', 'O turno já mudou.')
  }
  const next = pass(gameState)
  if (!next) return refuse('invalid', 'Não há outro jogador nesse time.')

  // 3. Hand it over and push to everyone.
  return commitGame(room, next)
}
