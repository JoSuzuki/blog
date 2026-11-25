import { createServerFn } from '@tanstack/react-start'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
import type { RoomActionError } from './room'
import {
  DB_NULL,
  ROOM_CHANGED,
  announce,
  findSeat,
  nextVersion,
  refuse,
  refused,
} from './room.server'

/**
 * After the last turn, takes the room back to the lobby with the same
 * players, teams and settings for a rematch. Anyone who meanwhile sat down in
 * another room loses their seat here, so nobody is in two games.
 */
export const playAgain = createServerFn({ method: 'POST' })
  .validator((data: { roomCode: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | RoomActionError> => {
    // 1. The reader's seat in a finished room.
    const seat = await findSeat(await getCurrentUser(), data?.roomCode)
    if ('ok' in seat) return refused(seat)
    const { room } = seat
    if (room.status !== 'FINISHED') {
      return refused(refuse('invalid', 'A partida ainda não acabou.'))
    }

    // 2. Back to the lobby, without those who moved on.
    const busy = await prisma.tabooRoomPlayer.findMany({
      where: {
        userId: { in: room.players.map((p) => p.userId) },
        roomId: { not: room.id },
        room: { status: { in: ['WAITING', 'PLAYING'] } },
      },
      select: { userId: true },
    })
    const me = room.players.find((p) => p.id === seat.playerId)
    if (busy.some((b) => b.userId === me?.userId)) {
      return refused(refuse('invalid', 'Você já está em outra sala.'))
    }
    const reset = await prisma.$transaction(async (tx) => {
      const { count } = await tx.tabooRoom.updateMany({
        where: { id: room.id, status: 'FINISHED', updatedAt: room.updatedAt },
        data: {
          status: 'WAITING',
          gameState: DB_NULL,
          updatedAt: nextVersion(room.updatedAt),
        },
      })
      if (count === 0) return false
      await tx.tabooRoomPlayer.deleteMany({
        where: {
          roomId: room.id,
          userId: { in: busy.map((b) => b.userId) },
        },
      })
      return true
    })
    if (!reset) return refused(ROOM_CHANGED)

    // 3. Everybody's page goes back to the lobby.
    announce(room.roomCode, true)
    return { ok: true }
  })
