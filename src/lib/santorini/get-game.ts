import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
import type { GameState } from './game'
import type { GameView } from './room'
import { toDisplayName } from './room.server'

export type GetGameResult =
  | { ok: true; game: GameView }
  /** The reader plays this game: its room page is where they play it. */
  | { ok: false; reason: 'play'; roomCode: string }
  | { ok: false; reason: 'not_found' | 'unavailable' }

const gameIdSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(2 ** 31 - 1)

/**
 * One Santorini game by its id, for the game page's loader: anyone, logged in
 * or not, may watch a game being played or review a finished one. Its moves
 * are its `history`; there is nothing secret in a Santorini game. Sets no
 * error status: during server rendering it runs inside the page's request.
 */
export const getGame = createServerFn({ method: 'GET' })
  .validator((data: { gameId: string }) => data)
  .handler(async ({ data }): Promise<GetGameResult> => {
    const gameId = gameIdSchema.safeParse(data?.gameId)
    if (!gameId.success) return { ok: false, reason: 'not_found' }

    try {
      const [user, room] = await Promise.all([
        getCurrentUser(),
        prisma.santoriniRoom.findUnique({
          where: { id: gameId.data },
          include: {
            players: {
              orderBy: { id: 'asc' },
              select: {
                id: true,
                userId: true,
                winner: true,
                user: { select: { name: true } },
              },
            },
          },
        }),
      ])
      if (!room) return { ok: false, reason: 'not_found' }

      const myPlayerId =
        room.players.find((p) => user && p.userId === user.id)?.id ?? null
      if (myPlayerId !== null && room.status !== 'FINISHED') {
        return { ok: false, reason: 'play', roomCode: room.roomCode }
      }
      return {
        ok: true,
        game: {
          id: room.id,
          roomCode: room.roomCode,
          status: room.status,
          players: room.players.map((player) => ({
            id: player.id,
            name: toDisplayName(player.user.name),
            winner: player.winner,
          })),
          myPlayerId,
          gameState: room.gameState as GameState | null,
          createdAt: room.createdAt.toISOString(),
          updatedAt: room.updatedAt.toISOString(),
          version: room.updatedAt.getTime(),
        },
      }
    } catch (error) {
      console.error('Loading a Santorini game failed:', error)
      return { ok: false, reason: 'unavailable' }
    }
  })
