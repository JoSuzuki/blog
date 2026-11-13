import { setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import type { CurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
import { santoriniRoom } from '~/lib/realtime/events'
import { getIO } from '~/lib/realtime/io.server'
import type { GameState } from './game'
import { ROOM_CODE_PATTERN } from './room'
import type { RoomActionError, RoomView } from './room'

// What the Santorini actions share: finding the room for the reader making
// the request, turning a row into what the page gets, writing a move without
// overwriting someone else's, and telling the other browsers.

export const roomCodeSchema = z.string().regex(ROOM_CODE_PATTERN)

export const refuse = (
  error: RoomActionError['error'],
  message: string,
): RoomActionError => ({ ok: false, error, message })

const REFUSAL_STATUS = {
  login: 401,
  not_found: 404,
  invalid: 400,
  conflict: 409,
  rate_limited: 429,
} as const

/**
 * Answers a mutation with a refusal and the matching HTTP status. Not for
 * the functions loaders call: during server rendering those run inside the
 * page's request, where the status would become the page's.
 */
export const refused = (refusal: RoomActionError): RoomActionError => {
  setResponseStatus(REFUSAL_STATUS[refusal.error])
  return refusal
}

export const LOGIN_REQUIRED = refuse('login', 'Faça login para jogar.')
export const ROOM_NOT_FOUND = refuse('not_found', 'Sala não encontrada.')
export const NOT_YOUR_TURN = refuse('invalid', 'Não é a sua vez.')
export const GAME_NOT_RUNNING = refuse(
  'invalid',
  'A partida não está em andamento.',
)
/** The room changed between reading it and writing; the page reloads it. */
export const ROOM_CHANGED = refuse(
  'conflict',
  'A sala mudou enquanto isso. Tente de novo.',
)

const roomInclude = {
  players: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      userId: true,
      winner: true,
      user: { select: { name: true } },
    },
  },
} as const

/** A room row with its seats, in the order the players sat down. */
export const findRoom = (roomCode: string) =>
  prisma.santoriniRoom.findUnique({ where: { roomCode }, include: roomInclude })

export type RoomRow = NonNullable<Awaited<ReturnType<typeof findRoom>>>

/** What other players see of a reader: the first name only. */
export const toDisplayName = (name: string) =>
  name.trim().split(/\s+/)[0] || name

export const toRoomView = (room: RoomRow, user: CurrentUser): RoomView => ({
  roomCode: room.roomCode,
  status: room.status,
  players: room.players.map((player) => ({
    id: player.id,
    name: toDisplayName(player.user.name),
    winner: player.winner,
  })),
  myPlayerId: room.players.find((p) => p.userId === user.id)?.id ?? null,
  gameState: room.gameState as GameState | null,
})

/** The room a reader is sitting in that has not finished, if any. */
export const findActiveRoomCode = async (
  userId: number,
): Promise<string | null> => {
  const room = await prisma.santoriniRoom.findFirst({
    where: {
      status: { in: ['WAITING', 'PLAYING'] },
      players: { some: { userId } },
    },
    select: { roomCode: true },
  })
  return room?.roomCode ?? null
}

export interface Seat {
  user: CurrentUser
  room: RoomRow
  /** The reader's seat in the room. */
  playerId: number
  /** The other seat, once someone sits there. */
  opponentId: number | undefined
}

/**
 * The room `input` names and the seat of the reader making the request, or
 * the refusal to answer with: not logged in, no such room, not sitting in it.
 */
export const findSeat = async (
  input: unknown,
): Promise<Seat | RoomActionError> => {
  const parsed = z.object({ roomCode: roomCodeSchema }).safeParse(input)
  if (!parsed.success) return ROOM_NOT_FOUND
  const user = await getCurrentUser()
  if (!user) return LOGIN_REQUIRED
  const room = await findRoom(parsed.data.roomCode)
  const playerId = room?.players.find((p) => p.userId === user.id)?.id
  if (!room || playerId === undefined) return ROOM_NOT_FOUND
  return {
    user,
    room,
    playerId,
    opponentId: room.players.find((p) => p.id !== playerId)?.id,
  }
}

/** A seat in a room whose game is being played, with the game. */
export const findSeatInGame = async (
  input: unknown,
): Promise<
  (Seat & { gameState: GameState; opponentId: number }) | RoomActionError
> => {
  const seat = await findSeat(input)
  if ('ok' in seat) return seat
  const gameState = seat.room.gameState as GameState | null
  if (
    seat.room.status !== 'PLAYING' ||
    !gameState ||
    seat.opponentId === undefined
  ) {
    return GAME_NOT_RUNNING
  }
  return { ...seat, gameState, opponentId: seat.opponentId }
}

/**
 * Writes the game back to the room it was read from, unless the room was
 * written in between (two clicks in a row, both players at once): then
 * nothing is written and the answer is false. With `winnerId` the game is
 * over and that seat is marked as the winner.
 */
export const saveGame = async (
  room: RoomRow,
  gameState: GameState,
  winnerId?: number,
): Promise<boolean> =>
  prisma.$transaction(async (tx) => {
    const { count } = await tx.santoriniRoom.updateMany({
      where: { id: room.id, updatedAt: room.updatedAt, status: 'PLAYING' },
      data: {
        gameState: gameState as object,
        ...(winnerId === undefined ? {} : { status: 'FINISHED' as const }),
      },
    })
    if (count === 0) return false
    if (winnerId !== undefined) {
      await tx.santoriniRoomPlayer.update({
        where: { id: winnerId },
        data: { winner: true },
      })
    }
    return true
  })

/**
 * Tells the browsers showing a room (and, with `lobby`, the list of rooms)
 * that it changed, so they load it again. The event carries no data. Never
 * throws: without a socket.io server the pages are just not live.
 */
export const announce = (roomCode: string | null, lobby = false) => {
  try {
    const io = getIO()
    const channels = [
      ...(roomCode ? [roomCode] : []),
      ...(lobby ? ['lobby'] : []),
    ]
    for (const channel of channels) {
      io.to(santoriniRoom(channel)).emit('santorini:changed', { channel })
    }
  } catch (error) {
    if (globalThis.__blogSocketIO) {
      console.error('Announcing a Santorini change failed:', error)
    }
  }
}
