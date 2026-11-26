import { createServerFn } from '@tanstack/react-start'
import { displayNameOf } from '~/lib/users/display-name'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
import { MAX_PLAYERS } from './game'
import type { RoomSummary } from './room'
import { findActiveRoomCode } from './room.server'

export type GetRoomsResult =
  | {
      ok: true
      /** The room the reader is already sitting in, if any. */
      activeRoomCode: string | null
      /** Rooms that take players, oldest first. */
      rooms: RoomSummary[]
    }
  | { ok: false; reason: 'login' | 'unavailable' }

/**
 * The list of open Tabu rooms (waiting, or playing with a free seat), for the
 * rooms page's loader. Sets no error status: during server rendering it runs
 * inside the page's own request.
 */
export const getRooms = createServerFn({ method: 'GET' }).handler(
  async (): Promise<GetRoomsResult> => {
    try {
      const user = await getCurrentUser()
      if (!user) return { ok: false, reason: 'login' }

      const [activeRoomCode, rooms] = await Promise.all([
        findActiveRoomCode(user.id),
        prisma.tabooRoom.findMany({
          where: { status: { in: ['WAITING', 'PLAYING'] } },
          orderBy: { id: 'asc' },
          take: 50,
          select: {
            roomCode: true,
            status: true,
            players: {
              orderBy: { id: 'asc' },
              select: { user: { select: { name: true, nickname: true } } },
            },
          },
        }),
      ])
      return {
        ok: true,
        activeRoomCode,
        rooms: rooms
          .filter((room) => room.players.length < MAX_PLAYERS)
          .map((room) => ({
            roomCode: room.roomCode,
            status: room.status as RoomSummary['status'],
            hostName: room.players[0]
              ? displayNameOf(room.players[0].user)
              : '',
            playerCount: room.players.length,
          })),
      }
    } catch (error) {
      console.error('Listing Tabu rooms failed:', error)
      return { ok: false, reason: 'unavailable' }
    }
  },
)
