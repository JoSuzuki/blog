import { createServerFn } from '@tanstack/react-start'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { MAX_PLAYERS } from './game'
import type { RoomView } from './room'
import { findOnline, findRoom, roomCodeSchema, toRoomView } from './room.server'

export type GetRoomResult =
  | { ok: true; room: RoomView }
  | { ok: false; reason: 'login' | 'not_found' | 'unavailable' }

/**
 * One Tabu room as the reader may see it, for the room page's loader: its
 * players see their own view of everything; anyone else logged in sees it
 * while it still takes players (that is how a shared link lets a friend in,
 * even mid-game). Sets no error status: during server rendering it runs
 * inside the page's request.
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

      const seated = room.players.some((p) => p.userId === user.id)
      const canJoin =
        room.status !== 'FINISHED' && room.players.length < MAX_PLAYERS
      if (!seated && !canJoin) return { ok: false, reason: 'not_found' }
      return {
        ok: true,
        room: toRoomView(room, user.id, await findOnline(room)),
      }
    } catch (error) {
      console.error('Loading a Tabu room failed:', error)
      return { ok: false, reason: 'unavailable' }
    }
  })
