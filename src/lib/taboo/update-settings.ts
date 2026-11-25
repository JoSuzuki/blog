import { createServerFn } from '@tanstack/react-start'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
import type { TabooSettings } from './game'
import type { RoomActionError } from './room'
import {
  NOT_HOST,
  announce,
  findSeat,
  hostOf,
  nextVersion,
  refuse,
  refused,
  settingsSchema,
} from './room.server'

/**
 * The host chooses how the game will go (rounds per player, turn length)
 * while the room waits. Everybody in the room sees the change.
 */
export const updateSettings = createServerFn({ method: 'POST' })
  .validator((data: { roomCode: string; settings: TabooSettings }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | RoomActionError> => {
    // 1. Validate, and the reader's seat; host only, before the game.
    const settings = settingsSchema.safeParse(data?.settings)
    if (!settings.success) {
      return refused(refuse('invalid', 'Configuração inválida.'))
    }
    const seat = await findSeat(await getCurrentUser(), data?.roomCode)
    if ('ok' in seat) return refused(seat)
    if (hostOf(seat.room)?.id !== seat.playerId) return refused(NOT_HOST)
    if (seat.room.status !== 'WAITING') {
      return refused(refuse('invalid', 'A partida já começou.'))
    }

    // 2. Store them.
    await prisma.tabooRoom.update({
      where: { id: seat.room.id },
      data: {
        settings: settings.data,
        updatedAt: nextVersion(seat.room.updatedAt),
      },
    })
    announce(seat.room.roomCode)
    return { ok: true }
  })
