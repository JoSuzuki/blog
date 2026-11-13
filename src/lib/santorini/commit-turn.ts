import { createServerFn } from '@tanstack/react-start'
import { getNextActionType, passTurn, verifyCurrentPlayerCanAct } from './game'
import type { RoomActionError } from './room'
import {
  NOT_YOUR_TURN,
  ROOM_CHANGED,
  announce,
  findSeatInGame,
  refuse,
  refused,
  saveGame,
} from './room.server'

/**
 * Ends the reader's turn: its steps are played for good and the turn passes
 * to the opponent. If the opponent then has no worker that can move, they
 * have lost and the game ends.
 */
export const commitTurn = createServerFn({ method: 'POST' })
  .validator((data: { roomCode: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | RoomActionError> => {
    // 1. The reader's seat in the running game.
    const seat = await findSeatInGame(data)
    if ('ok' in seat) return refused(seat)
    const { room, gameState, playerId, opponentId } = seat

    // 2. Only a complete turn of the player whose turn it is can be ended.
    const nextActionType = getNextActionType(gameState, playerId)
    if (nextActionType === null) return refused(NOT_YOUR_TURN)
    if (nextActionType !== 'commit_actions') {
      return refused(refuse('invalid', 'A jogada ainda não está completa.'))
    }

    // 3. Pass the turn. An opponent who cannot move loses.
    const next = passTurn(gameState, opponentId)
    const saved = await saveGame(
      room,
      next,
      verifyCurrentPlayerCanAct(next) ? undefined : playerId,
    )
    if (!saved) return refused(ROOM_CHANGED)

    // 4. Both players' boards load the new state.
    announce(room.roomCode)
    return { ok: true }
  })
