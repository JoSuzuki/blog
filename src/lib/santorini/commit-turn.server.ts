import type { SantoriniAck } from '~/lib/realtime/events'
import { getNextActionType, passTurn, verifyCurrentPlayerCanAct } from './game'
import {
  NOT_YOUR_TURN,
  ROOM_CHANGED,
  findSeatInGame,
  refuse,
  saveGame,
  sendToPlayers,
} from './room.server'

/**
 * The `santorini:commit` socket event: ends the player's turn. Its steps are
 * played for good and the turn passes to the opponent. If the opponent then
 * has no worker that can move, they have lost and the game ends.
 */
export const commitTurn = async (
  userId: number,
  roomCode: unknown,
): Promise<SantoriniAck> => {
  // 1. The player's seat in the running game.
  const seat = await findSeatInGame({ id: userId }, roomCode)
  if ('ok' in seat) return seat
  const { room, gameState, playerId, opponentId } = seat

  // 2. Only a complete turn of the player whose turn it is can be ended.
  const nextActionType = getNextActionType(gameState, playerId)
  if (nextActionType === null) return NOT_YOUR_TURN
  if (nextActionType !== 'commit_actions') {
    return refuse('invalid', 'A jogada ainda não está completa.')
  }

  // 3. Pass the turn. An opponent who cannot move loses.
  const next = passTurn(gameState, opponentId)
  const update = await saveGame(
    room,
    next,
    verifyCurrentPlayerCanAct(next) ? undefined : playerId,
  )
  if (!update) return ROOM_CHANGED

  // 4. Both players' boards get the new state.
  sendToPlayers(room, update)
  return { ok: true }
}
