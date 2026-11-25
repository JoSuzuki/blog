import { randomInt } from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
import { shuffle } from './game'
import type { RoomActionError } from './room'
import {
  NOT_HOST,
  announce,
  findSeat,
  hostOf,
  nextVersion,
  refuse,
  refused,
} from './room.server'

/** The host draws new teams of (nearly) equal size while the room waits. */
export const shuffleTeams = createServerFn({ method: 'POST' })
  .validator((data: { roomCode: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | RoomActionError> => {
    // 1. The reader's seat; host only, before the game.
    const seat = await findSeat(await getCurrentUser(), data?.roomCode)
    if ('ok' in seat) return refused(seat)
    if (hostOf(seat.room)?.id !== seat.playerId) return refused(NOT_HOST)
    if (seat.room.status !== 'WAITING') {
      return refused(
        refuse('invalid', 'Os times se escolhem antes de começar.'),
      )
    }

    // 2. Shuffle and deal alternately.
    const random = () => randomInt(1_000_000) / 1_000_000
    const order = shuffle(seat.room.players, random)
    await prisma.$transaction([
      ...order.map((player, index) =>
        prisma.tabooRoomPlayer.update({
          where: { id: player.id },
          data: { team: index % 2 },
        }),
      ),
      prisma.tabooRoom.update({
        where: { id: seat.room.id },
        data: { updatedAt: nextVersion(seat.room.updatedAt) },
      }),
    ])
    announce(seat.room.roomCode)
    return { ok: true }
  })
