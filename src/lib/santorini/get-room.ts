import { createServerFn } from '@tanstack/react-start'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { ROOM_SIZE } from './room'
import type { RoomView } from './room'
import { findRoom, roomCodeSchema, toRoomView } from './room.server'

export type GetRoomResult =
  | { ok: true; room: RoomView }
  | { ok: false; reason: 'login' | 'not_found' | 'unavailable' }

/**
 * One Santorini room as the reader may see it, for the room page's loader:
 * its players see everything; anyone else logged in sees it only while it
 * has a free seat (that is how a shared link lets a friend join). Sets no
 * error status: during server rendering it runs inside the page's request.
 */
export const getRoom = createServerFn({ method: 'GET' })
  .validator((data: { roomCode: string }) => data)
  .handler(async ({ data }): Promise<GetRoomResult> => {
    const roomCode = roomCodeSchema.safeParse(data?.roomCode)
    if (!roomCode.success) return { ok: false, reason: 'not_found' }

    try {
      const user = await getCurrentUser()
      if (!user) return { ok: false, reason: 'login' }

      const room = await findRoom(roomCode.data)
      if (!room) return { ok: false, reason: 'not_found' }

      const view = toRoomView(room, user)
      const canJoin =
        room.status === 'WAITING' && room.players.length < ROOM_SIZE
      if (view.myPlayerId === null && !canJoin) {
        return { ok: false, reason: 'not_found' }
      }
      return { ok: true, room: view }
    } catch (error) {
      console.error('Loading a Santorini room failed:', error)
      return { ok: false, reason: 'unavailable' }
    }
  })
