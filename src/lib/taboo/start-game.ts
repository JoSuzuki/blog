import { randomInt } from 'node:crypto'
import { createServerFn } from '@tanstack/react-start'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
import { CARD_COUNT } from './cards.server'
import { MIN_TEAM_SIZE, canStart, createGame } from './game'
import type { Team } from './game'
import type { RoomActionError } from './room'
import {
  ROOM_CHANGED,
  announce,
  findSeat,
  nextVersion,
  parseSettings,
  refuse,
  refused,
} from './room.server'

/**
 * Starts the game in a waiting room with the teams and settings chosen in
 * the lobby. Anyone sitting in the room can start it. Team Azul's first
 * player speaks first.
 */
export const startGame = createServerFn({ method: 'POST' })
  .validator((data: { roomCode: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | RoomActionError> => {
    // 1. The reader's seat in the room.
    const seat = await findSeat(await getCurrentUser(), data?.roomCode)
    if ('ok' in seat) return refused(seat)
    const { room } = seat
    if (room.status !== 'WAITING') {
      return refused(refuse('invalid', 'A partida já começou.'))
    }

    // 2. Both teams need someone to speak and someone to guess.
    const teams: [number[], number[]] = [[], []]
    for (const player of room.players) {
      teams[(player.team === 1 ? 1 : 0) as Team].push(player.id)
    }
    if (!canStart([teams[0].length, teams[1].length])) {
      return refused(
        refuse(
          'invalid',
          `Cada time precisa de pelo menos ${MIN_TEAM_SIZE} jogadores.`,
        ),
      )
    }

    // 3. Deal, unless the room changed since it was read.
    const gameState = createGame({
      settings: parseSettings(room.settings),
      teams,
      cardCount: CARD_COUNT,
      random: () => randomInt(1_000_000_000) / 1_000_000_000,
    })
    const { count } = await prisma.tabooRoom.updateMany({
      where: { id: room.id, status: 'WAITING', updatedAt: room.updatedAt },
      data: {
        status: 'PLAYING',
        gameState: gameState as object,
        updatedAt: nextVersion(room.updatedAt),
      },
    })
    if (count === 0) return refused(ROOM_CHANGED)

    // 4. Every page in the room switches to the game.
    announce(room.roomCode, true)
    return { ok: true }
  })
