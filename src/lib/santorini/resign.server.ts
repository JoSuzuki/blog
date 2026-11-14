import type { SantoriniAck } from '~/lib/realtime/events'
import {
  ROOM_CHANGED,
  findSeatInGame,
  saveGame,
  sendToPlayers,
} from './room.server'

/**
 * The `santorini:resign` socket event: gives up the game. It ends and the
 * opponent wins. Allowed on either player's turn. Steps of a turn that was
 * not committed are dropped.
 */
export const resign = async (
  userId: number,
  roomCode: unknown,
): Promise<SantoriniAck> => {
  // 1. The player's seat in the running game.
  const seat = await findSeatInGame({ id: userId }, roomCode)
  if ('ok' in seat) return seat
  const { room, gameState, opponentId } = seat

  // 2. End the game in the opponent's favour.
  const update = await saveGame(
    room,
    { ...gameState, currentTurn: { ...gameState.currentTurn, actions: [] } },
    opponentId,
  )
  if (!update) return ROOM_CHANGED

  // 3. Both players' pages show the result.
  sendToPlayers(room, update)
  return { ok: true }
}
