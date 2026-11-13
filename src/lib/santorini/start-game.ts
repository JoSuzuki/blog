import { createServerFn } from '@tanstack/react-start'
import { prisma } from '~/lib/db.server'
import { createGameState } from './game'
import { ROOM_SIZE } from './room'
import type { RoomActionError } from './room'
import {
  ROOM_CHANGED,
  announce,
  findSeat,
  refuse,
  refused,
} from './room.server'

/**
 * Starts the game in a waiting room with both seats taken. Either player can
 * start it; whoever sat down first (the room's creator) plays first.
 */
export const startGame = createServerFn({ method: 'POST' })
  .validator((data: { roomCode: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | RoomActionError> => {
    // 1. The reader's seat in the room.
    const seat = await findSeat(data)
    if ('ok' in seat) return refused(seat)
    const { room } = seat

    // 2. Only a full, waiting room can start.
    if (room.status !== 'WAITING') {
      return refused(refuse('invalid', 'A partida já começou.'))
    }
    if (room.players.length !== ROOM_SIZE) {
      return refused(
        refuse('invalid', 'A partida precisa de exatamente 2 jogadores.'),
      )
    }

    // 3. Start, unless the room changed since it was read (someone left, or
    // the other player started it at the same moment).
    const { count } = await prisma.santoriniRoom.updateMany({
      where: { id: room.id, status: 'WAITING', updatedAt: room.updatedAt },
      data: {
        status: 'PLAYING',
        gameState: createGameState(room.players[0].id) as object,
      },
    })
    if (count === 0) return refused(ROOM_CHANGED)

    // 4. Both players' pages switch to the board; the room leaves the list.
    announce(room.roomCode, true)
    return { ok: true }
  })
