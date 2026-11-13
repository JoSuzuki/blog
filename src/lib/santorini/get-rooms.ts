import { createServerFn } from '@tanstack/react-start'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
import type { RoomSummary } from './room'
import { findActiveRoomCode, toDisplayName } from './room.server'

export type GetRoomsResult =
  | {
      ok: true
      /** The room the reader is already sitting in, if any. */
      activeRoomCode: string | null
      /** Rooms waiting for a second player, oldest first. */
      rooms: RoomSummary[]
    }
  | { ok: false; reason: 'login' | 'unavailable' }

/**
 * The list of Santorini rooms, for the rooms page's loader. Sets no error
 * status: during server rendering it runs inside the page's own request.
 */
export const getRooms = createServerFn({ method: 'GET' }).handler(
  async (): Promise<GetRoomsResult> => {
    try {
      const user = await getCurrentUser()
      if (!user) return { ok: false, reason: 'login' }

      const [activeRoomCode, rooms] = await Promise.all([
        findActiveRoomCode(user.id),
        prisma.santoriniRoom.findMany({
          where: { status: 'WAITING' },
          orderBy: { id: 'asc' },
          take: 50,
          select: {
            roomCode: true,
            creator: { select: { name: true } },
            _count: { select: { players: true } },
          },
        }),
      ])
      return {
        ok: true,
        activeRoomCode,
        rooms: rooms.map((room) => ({
          roomCode: room.roomCode,
          creatorName: toDisplayName(room.creator.name),
          playerCount: room._count.players,
        })),
      }
    } catch (error) {
      console.error('Listing Santorini rooms failed:', error)
      return { ok: false, reason: 'unavailable' }
    }
  },
)
