import { createServerFn } from '@tanstack/react-start'
import { displayNameOf } from '~/lib/users/display-name'
import { z } from 'zod'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
import type { Prisma } from '~/generated/prisma/client'
import { ROOM_CODE_PATTERN } from './room'
import type { GameSummary } from './room'

/** Finished games per page. */
export const GAMES_PAGE_SIZE = 20

const inputSchema = z.object({
  /** Only the games played under this code (codes are reused over time). */
  code: z.string().regex(ROOM_CODE_PATTERN).optional(),
  /** Only the reader's own games. */
  mine: z.boolean().optional(),
  /** The next page: finished games older than this id. */
  before: z.number().int().positive().optional(),
})

export type GetGamesInput = z.input<typeof inputSchema>

export type GetGamesResult =
  | {
      ok: true
      /** Games being played now, newest first (on the first page only). */
      live: GameSummary[]
      /** Finished games, newest first. */
      finished: GameSummary[]
      /** The `before` of the next page, if there is one. */
      nextBefore: number | null
      loggedIn: boolean
    }
  | { ok: false; reason: 'invalid' | 'unavailable' }

const summarySelect = {
  id: true,
  roomCode: true,
  status: true,
  updatedAt: true,
  players: {
    orderBy: { id: 'asc' },
    select: { winner: true, user: { select: { name: true, nickname: true } } },
  },
} as const satisfies Prisma.SantoriniRoomSelect

type SummaryRow = Prisma.SantoriniRoomGetPayload<{
  select: typeof summarySelect
}>

const toSummary = (room: SummaryRow): GameSummary => ({
  id: room.id,
  roomCode: room.roomCode,
  status: room.status === 'FINISHED' ? 'FINISHED' : 'PLAYING',
  players: room.players.map((player) => ({
    name: displayNameOf(player.user),
    winner: player.winner,
  })),
  updatedAt: room.updatedAt.toISOString(),
})

/**
 * Every Santorini game that has been played or is being played, for the
 * history page's loader. Public: anyone may look. Sets no error status:
 * during server rendering it runs inside the page's request.
 */
export const getGames = createServerFn({ method: 'GET' })
  .validator((data: GetGamesInput) => data)
  .handler(async ({ data }): Promise<GetGamesResult> => {
    const input = inputSchema.safeParse(data ?? {})
    if (!input.success) return { ok: false, reason: 'invalid' }
    const { code, mine, before } = input.data

    try {
      const user = await getCurrentUser()
      const filter: Prisma.SantoriniRoomWhereInput = {
        ...(code && { roomCode: code }),
        ...(mine && { players: { some: { userId: user?.id ?? -1 } } }),
      }
      const [live, finished] = await Promise.all([
        before
          ? []
          : prisma.santoriniRoom.findMany({
              where: { ...filter, status: 'PLAYING' },
              orderBy: { id: 'desc' },
              take: 50,
              select: summarySelect,
            }),
        prisma.santoriniRoom.findMany({
          where: {
            ...filter,
            status: 'FINISHED',
            ...(before && { id: { lt: before } }),
          },
          orderBy: { id: 'desc' },
          take: GAMES_PAGE_SIZE + 1,
          select: summarySelect,
        }),
      ])
      const page = finished.slice(0, GAMES_PAGE_SIZE)
      return {
        ok: true,
        live: live.map(toSummary),
        finished: page.map(toSummary),
        nextBefore:
          finished.length > GAMES_PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
        loggedIn: !!user,
      }
    } catch (error) {
      console.error('Listing Santorini games failed:', error)
      return { ok: false, reason: 'unavailable' }
    }
  })
