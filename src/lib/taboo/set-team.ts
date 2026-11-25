import { createServerFn } from '@tanstack/react-start'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
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

/**
 * Moves a player to a team while the room waits. Anyone can change their own
 * team; the host can move anyone.
 */
export const setTeam = createServerFn({ method: 'POST' })
  .validator(
    (data: { roomCode: string; team: number; playerId?: number }) => data,
  )
  .handler(async ({ data }): Promise<{ ok: true } | RoomActionError> => {
    // 1. Validate, and the reader's seat.
    const team = data?.team
    if (team !== 0 && team !== 1) {
      return refused(refuse('invalid', 'Time inválido.'))
    }
    const seat = await findSeat(await getCurrentUser(), data?.roomCode)
    if ('ok' in seat) return refused(seat)
    if (seat.room.status !== 'WAITING') {
      return refused(
        refuse('invalid', 'Os times se escolhem antes de começar.'),
      )
    }

    // 2. Whose team: their own, or anyone's for the host.
    const playerId = data.playerId ?? seat.playerId
    if (playerId !== seat.playerId && hostOf(seat.room)?.id !== seat.playerId) {
      return refused(NOT_HOST)
    }
    if (!seat.room.players.some((p) => p.id === playerId)) {
      return refused(refuse('invalid', 'Jogador não encontrado.'))
    }

    // 3. Move them.
    await prisma.$transaction([
      prisma.tabooRoomPlayer.update({
        where: { id: playerId },
        data: { team },
      }),
      prisma.tabooRoom.update({
        where: { id: seat.room.id },
        data: { updatedAt: nextVersion(seat.room.updatedAt) },
      }),
    ])
    announce(seat.room.roomCode)
    return { ok: true }
  })
