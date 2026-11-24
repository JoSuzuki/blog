import { createServerFn } from '@tanstack/react-start'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
import { MAX_PLAYERS, addPlayer } from './game'
import type { TabooGameState, Team } from './game'
import type { RoomActionError } from './room'
import {
  LOGIN_REQUIRED,
  ROOM_CHANGED,
  ROOM_NOT_FOUND,
  announce,
  findActiveRoomCode,
  findRoom,
  nextVersion,
  refuse,
  refused,
  roomCodeSchema,
  sendToPlayers,
} from './room.server'

const ROOM_FULL = refuse('invalid', `Sala cheia (${MAX_PLAYERS} jogadores).`)

/**
 * Sits the reader in a room, on the team with fewer players. Rooms take
 * players while waiting and also during the game (a friend who arrives late
 * joins the smaller team and speaks when the rotation reaches them). Already
 * sitting there is a success too. Refused when the room is full or over, or
 * when the reader has another unfinished room.
 */
export const joinRoom = createServerFn({ method: 'POST' })
  .validator((data: { roomCode: string }) => data)
  .handler(async ({ data }): Promise<{ ok: true } | RoomActionError> => {
    // 1. Validate, and who is asking.
    const roomCode = roomCodeSchema.safeParse(data?.roomCode)
    if (!roomCode.success) return refused(ROOM_NOT_FOUND)
    const user = await getCurrentUser()
    if (!user) return refused(LOGIN_REQUIRED)

    // 2. The room, and whether there is a seat for this reader.
    const room = await findRoom(roomCode.data)
    if (!room) return refused(ROOM_NOT_FOUND)
    if (room.players.some((player) => player.userId === user.id)) {
      return { ok: true }
    }
    if (room.status === 'FINISHED') {
      return refused(refuse('invalid', 'Essa partida já acabou.'))
    }
    if (room.players.length >= MAX_PLAYERS) return refused(ROOM_FULL)
    if (await findActiveRoomCode(user.id)) {
      return refused(
        refuse('invalid', 'Você já está em outra sala. Saia dela antes.'),
      )
    }

    // 3. The smaller team (by the game's teams once it is running).
    const gameState =
      room.status === 'PLAYING'
        ? (room.gameState as TabooGameState | null)
        : null
    const sizes = gameState
      ? [gameState.teams[0].length, gameState.teams[1].length]
      : [0, 1].map((t) => room.players.filter((p) => p.team === t).length)
    const team: Team = sizes[0] <= sizes[1] ? 0 : 1

    // 4. Sit down. The room's version guards against a crossing write (two
    // readers taking the last seat, a card played meanwhile), and the unique
    // (room, reader) pair against a double click.
    const version = nextVersion(room.updatedAt)
    const seated = await prisma
      .$transaction(async (tx) => {
        const seat = await tx.tabooRoomPlayer.create({
          data: { roomId: room.id, userId: user.id, team },
        })
        const nextGame = gameState ? addPlayer(gameState, seat.id, team) : null
        const { count } = await tx.tabooRoom.updateMany({
          where: { id: room.id, updatedAt: room.updatedAt },
          data: {
            updatedAt: version,
            ...(nextGame ? { gameState: nextGame as object } : {}),
          },
        })
        const total = await tx.tabooRoomPlayer.count({
          where: { roomId: room.id },
        })
        if (count === 0 || total > MAX_PLAYERS) {
          throw new SeatTaken(count === 0)
        }
        return nextGame
      })
      .catch((error: unknown) => {
        if (error instanceof SeatTaken) return error
        throw error
      })
    if (seated instanceof SeatTaken) {
      return refused(seated.changed ? ROOM_CHANGED : ROOM_FULL)
    }

    // 5. The room and the list of rooms changed; the players in a running
    // game get the new teams right away.
    announce(room.roomCode, true)
    if (seated) {
      const updated = await findRoom(room.roomCode)
      if (updated) {
        await sendToPlayers(updated, {
          status: 'PLAYING',
          gameState: seated,
          version: version.getTime(),
        })
      }
    }
    return { ok: true }
  })

/** Rolls the transaction back when the seat cannot be kept. */
class SeatTaken extends Error {
  constructor(readonly changed: boolean) {
    super('seat taken')
  }
}
