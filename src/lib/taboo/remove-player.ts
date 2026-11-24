import { createServerFn } from '@tanstack/react-start'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { removePlayer as removeFromGame } from './game'
import type { RoomActionError } from './room'
import {
  NOT_HOST,
  ROOM_CHANGED,
  announce,
  findRoom,
  findSeat,
  hostOf,
  refuse,
  refused,
  removeSeat,
  sendToPlayers,
} from './room.server'

/**
 * The host takes someone else's seat away: a friend who closed the tab and is
 * not coming back, so the rotation does not keep waiting for them. Works like
 * that player leaving (see leave-room).
 */
export const removePlayer = createServerFn({ method: 'POST' })
  .validator((data: { roomCode: string; playerId: number }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | RoomActionError> => {
    // 1. The reader's seat, and they must be the host.
    const seat = await findSeat(await getCurrentUser(), data?.roomCode)
    if ('ok' in seat) return refused(seat)
    if (hostOf(seat.room)?.id !== seat.playerId) return refused(NOT_HOST)

    // 2. The other seat.
    const target = seat.room.players.find((p) => p.id === data?.playerId)
    if (!target || target.id === seat.playerId) {
      return refused(refuse('invalid', 'Jogador não encontrado.'))
    }

    // 3. Take it away.
    const result = await removeSeat(seat.room, target.id, removeFromGame)
    if (!result) return refused(ROOM_CHANGED)

    // 4. Everyone catches up.
    announce(seat.room.roomCode, true)
    if (result.state) {
      const room = await findRoom(seat.room.roomCode)
      if (room) await sendToPlayers(room, result.state)
    }
    return { ok: true }
  })
