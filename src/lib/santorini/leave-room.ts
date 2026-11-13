import { createServerFn } from '@tanstack/react-start'
import { prisma } from '~/lib/db.server'
import type { RoomActionError } from './room'
import { announce, findSeat, refuse, refused } from './room.server'

/**
 * Gets the reader up from a room that is still waiting. The room is deleted
 * when its last player leaves. Once the game has started the way out is
 * `resign`.
 */
export const leaveRoom = createServerFn({ method: 'POST' })
  .validator((data: { roomCode: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | RoomActionError> => {
    // 1. The reader's seat in the room.
    const seat = await findSeat(data)
    if ('ok' in seat) return refused(seat)
    if (seat.room.status !== 'WAITING') {
      return refused(
        refuse('invalid', 'A partida já começou. Use Desistir para sair.'),
      )
    }

    // 2. Give up the seat; an empty room goes away with it.
    await prisma.$transaction(async (tx) => {
      await tx.santoriniRoomPlayer.delete({ where: { id: seat.playerId } })
      const left = await tx.santoriniRoomPlayer.count({
        where: { roomId: seat.room.id },
      })
      if (left === 0) {
        await tx.santoriniRoom.delete({ where: { id: seat.room.id } })
      }
    })

    // 3. The room and the list of rooms changed.
    announce(seat.room.roomCode, true)
    return { ok: true }
  })
