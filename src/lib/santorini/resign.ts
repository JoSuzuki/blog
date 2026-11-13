import { createServerFn } from '@tanstack/react-start'
import type { RoomActionError } from './room'
import {
  ROOM_CHANGED,
  announce,
  findSeatInGame,
  refused,
  saveGame,
} from './room.server'

/**
 * Gives up the game: it ends and the opponent wins. Allowed on either
 * player's turn. Steps of a turn that was not committed are dropped.
 */
export const resign = createServerFn({ method: 'POST' })
  .validator((data: { roomCode: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | RoomActionError> => {
    // 1. The reader's seat in the running game.
    const seat = await findSeatInGame(data)
    if ('ok' in seat) return refused(seat)
    const { room, gameState, opponentId } = seat

    // 2. End the game in the opponent's favour.
    const saved = await saveGame(
      room,
      { ...gameState, currentTurn: { ...gameState.currentTurn, actions: [] } },
      opponentId,
    )
    if (!saved) return refused(ROOM_CHANGED)

    // 3. Both players' pages show the result.
    announce(room.roomCode)
    return { ok: true }
  })
