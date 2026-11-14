import type { SantoriniAck } from '~/lib/realtime/events'
import {
  NOT_YOUR_TURN,
  ROOM_CHANGED,
  findSeatInGame,
  saveGame,
  sendToPlayers,
} from './room.server'

/**
 * The `santorini:undo` socket event: takes back every step of the player's
 * turn that is not committed yet.
 */
export const undoTurn = async (
  userId: number,
  roomCode: unknown,
): Promise<SantoriniAck> => {
  // 1. The player's seat in the running game, on their turn.
  const seat = await findSeatInGame({ id: userId }, roomCode)
  if ('ok' in seat) return seat
  const { room, gameState, playerId } = seat
  if (gameState.currentTurn.playerId !== playerId) return NOT_YOUR_TURN

  // 2. Empty the turn.
  const update = await saveGame(room, {
    ...gameState,
    currentTurn: { ...gameState.currentTurn, actions: [] },
  })
  if (!update) return ROOM_CHANGED

  // 3. Both players' boards get the new state.
  sendToPlayers(room, update)
  return { ok: true }
}
