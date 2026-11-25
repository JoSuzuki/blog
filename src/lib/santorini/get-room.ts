import { createServerFn } from '@tanstack/react-start'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
import { ROOM_SIZE } from './room'
import type { RoomView } from './room'
import { findRoom, roomCodeSchema, toRoomView } from './room.server'

export type GetRoomResult =
  | { ok: true; room: RoomView }
  | { ok: false; reason: 'login' | 'not_found' | 'unavailable' }
  /** Not a room the reader plays in: the game's page shows it to anyone. */
  | { ok: false; reason: 'watch'; gameId: number }

/**
 * One Santorini room as the reader may play it, for the room page's loader.
 * Its players get the room; a logged-in reader also gets it while it has a
 * free seat (that is how a shared link lets a friend join). Anyone else is
 * sent to the game's own page to watch it, and so is everyone once the game
 * is over: a code then names the newest finished game that had it, until a
 * new room draws it again. Sets no error status: during server rendering it
 * runs inside the page's request.
 */
export const getRoom = createServerFn({ method: 'GET' })
  .validator((data: { roomCode: string }) => data)
  .handler(async ({ data }): Promise<GetRoomResult> => {
    const roomCode = roomCodeSchema.safeParse(data?.roomCode)
    if (!roomCode.success) return { ok: false, reason: 'not_found' }

    try {
      const [user, room] = await Promise.all([
        getCurrentUser(),
        findRoom(roomCode.data),
      ])

      if (!room) {
        const finished = await prisma.santoriniRoom.findFirst({
          where: { roomCode: roomCode.data, status: 'FINISHED' },
          orderBy: { id: 'desc' },
          select: { id: true },
        })
        return finished
          ? { ok: false, reason: 'watch', gameId: finished.id }
          : { ok: false, reason: 'not_found' }
      }

      const seated = !!user && room.players.some((p) => p.userId === user.id)
      if (seated) return { ok: true, room: toRoomView(room, user) }
      const canJoin =
        room.status === 'WAITING' && room.players.length < ROOM_SIZE
      if (canJoin) {
        return user
          ? { ok: true, room: toRoomView(room, user) }
          : { ok: false, reason: 'login' }
      }
      return { ok: false, reason: 'watch', gameId: room.id }
    } catch (error) {
      console.error('Loading a Santorini room failed:', error)
      return { ok: false, reason: 'unavailable' }
    }
  })
