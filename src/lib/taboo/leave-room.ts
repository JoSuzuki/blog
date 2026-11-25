import { createServerFn } from '@tanstack/react-start'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { removePlayer } from './game'
import type { RoomActionError } from './room'
import {
  ROOM_CHANGED,
  announce,
  findRoom,
  findSeat,
  refused,
  removeSeat,
  sendToPlayers,
} from './room.server'

/**
 * Gets the reader up from a room, at any point. During a game they leave it
 * too: their teammate speaks in their place, and a team left empty ends the
 * game. The room is deleted when its last player leaves.
 */
export const leaveRoom = createServerFn({ method: 'POST' })
  .validator((data: { roomCode: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | RoomActionError> => {
    // 1. The reader's seat in the room.
    const seat = await findSeat(await getCurrentUser(), data?.roomCode)
    if ('ok' in seat) return refused(seat)

    // 2. Give it up (and their place in the game).
    const result = await removeSeat(seat.room, seat.playerId, removePlayer)
    if (!result) return refused(ROOM_CHANGED)

    // 3. The room and the list of rooms changed.
    announce(seat.room.roomCode, true)
    if (result.state) {
      const room = await findRoom(seat.room.roomCode)
      if (room) await sendToPlayers(room, result.state)
    }
    return { ok: true }
  })
