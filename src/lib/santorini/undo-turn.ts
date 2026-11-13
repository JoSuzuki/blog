import { createServerFn } from '@tanstack/react-start'
import type { RoomActionError } from './room'
import {
  NOT_YOUR_TURN,
  ROOM_CHANGED,
  announce,
  findSeatInGame,
  refused,
  saveGame,
} from './room.server'

/** Takes back every step of the reader's turn that is not committed yet. */
export const undoTurn = createServerFn({ method: 'POST' })
  .validator((data: { roomCode: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | RoomActionError> => {
    // 1. The reader's seat in the running game, on their turn.
    const seat = await findSeatInGame(data)
    if ('ok' in seat) return refused(seat)
    const { room, gameState, playerId } = seat
    if (gameState.currentTurn.playerId !== playerId) {
      return refused(NOT_YOUR_TURN)
    }

    // 2. Empty the turn.
    const saved = await saveGame(room, {
      ...gameState,
      currentTurn: { ...gameState.currentTurn, actions: [] },
    })
    if (!saved) return refused(ROOM_CHANGED)

    // 3. Both players' boards load the new state.
    announce(room.roomCode)
    return { ok: true }
  })
