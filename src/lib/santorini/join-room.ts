import { createServerFn } from '@tanstack/react-start'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
import { ROOM_SIZE } from './room'
import type { RoomActionError } from './room'
import {
  LOGIN_REQUIRED,
  ROOM_NOT_FOUND,
  announce,
  findActiveRoomCode,
  findRoom,
  refuse,
  refused,
  roomCodeSchema,
} from './room.server'

/**
 * Sits the reader in the free seat of a waiting room. Already sitting there
 * is a success too. Refused when the room is full or already playing, or
 * when the reader has another unfinished room.
 */
export const joinRoom = createServerFn({ method: 'POST' })
  .validator((data: { roomCode: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | RoomActionError> => {
    // 1. Validate, and who is asking.
    const roomCode = roomCodeSchema.safeParse(data?.roomCode)
    if (!roomCode.success) return refused(ROOM_NOT_FOUND)
    const user = await getCurrentUser()
    if (!user) return refused(LOGIN_REQUIRED)

    // 2. The room, and whether there is a seat for this reader.
    const room = await findRoom(roomCode.data)
    if (!room) return refused(ROOM_NOT_FOUND)
    if (room.players.some((player) => player.userId === user.id)) {
      return { ok: true }
    }
    if (room.status !== 'WAITING') {
      return refused(refuse('invalid', 'Sala não disponível.'))
    }
    if (room.players.length >= ROOM_SIZE) {
      return refused(refuse('invalid', 'Sala cheia.'))
    }
    if (await findActiveRoomCode(user.id)) {
      return refused(
        refuse('invalid', 'Você já está em outra sala. Saia dela antes.'),
      )
    }

    // 3. Sit down. The unique (room, reader) pair and the recount inside the
    // transaction keep two readers from taking the last seat together.
    const seated = await prisma.$transaction(async (tx) => {
      await tx.santoriniRoomPlayer.create({
        data: { roomId: room.id, userId: user.id },
      })
      const count = await tx.santoriniRoomPlayer.count({
        where: { roomId: room.id },
      })
      if (count > ROOM_SIZE) {
        await tx.santoriniRoomPlayer.delete({
          where: { roomId_userId: { roomId: room.id, userId: user.id } },
        })
        return false
      }
      return true
    })
    if (!seated) return refused(refuse('invalid', 'Sala cheia.'))

    // 4. The room and the list of rooms changed.
    announce(room.roomCode, true)
    return { ok: true }
  })
