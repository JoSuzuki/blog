import { setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'
import type { CurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
import { santoriniRoom, userRoom } from '~/lib/realtime/events'
import type { SantoriniGameUpdate } from '~/lib/realtime/events'
import { getIO } from '~/lib/realtime/io.server'
import type { GameState } from './game'
import { ROOM_CODE_PATTERN } from './room'
import type { RoomActionError, RoomView } from './room'

// What the Santorini actions share: finding the room and the seat of the
// reader who is acting, turning a row into what the page gets, writing a move
// without overwriting someone else's, and telling the other browsers. Used
// both by server functions (the room's life: open, join, leave, start) and by
// the socket's game events (the moves), so nothing here reads the request:
// the caller says who the reader is.

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
  unavailable: 503,
} as const

/**
 * Answers a server function with a refusal and the matching HTTP status. Not
 * for the functions loaders call: during server rendering those run inside
 * the page's request, where the status would become the page's.
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

export const toRoomView = (
  room: RoomRow,
  user: Pick<CurrentUser, 'id'>,
): RoomView => ({
  roomCode: room.roomCode,
  status: room.status,
  players: room.players.map((player) => ({
    id: player.id,
    name: toDisplayName(player.user.name),
    winner: player.winner,
  })),
  myPlayerId: room.players.find((p) => p.userId === user.id)?.id ?? null,
  gameState: room.gameState as GameState | null,
  version: room.updatedAt.getTime(),
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
  room: RoomRow
  /** The reader's seat in the room. */
  playerId: number
  /** The other seat, once someone sits there. */
  opponentId: number | undefined
}

/**
 * The room called `roomCode` and the seat `user` has in it, or the refusal
 * to answer with: not logged in, no such room, not sitting in it.
 */
export const findSeat = async (
  user: Pick<CurrentUser, 'id'> | null,
  roomCode: unknown,
): Promise<Seat | RoomActionError> => {
  if (!user) return LOGIN_REQUIRED
  const code = roomCodeSchema.safeParse(roomCode)
  if (!code.success) return ROOM_NOT_FOUND
  const room = await findRoom(code.data)
  const playerId = room?.players.find((p) => p.userId === user.id)?.id
  if (!room || playerId === undefined) return ROOM_NOT_FOUND
  return {
    room,
    playerId,
    opponentId: room.players.find((p) => p.id !== playerId)?.id,
  }
}

/** A seat in a room whose game is being played, with the game. */
export const findSeatInGame = async (
  user: Pick<CurrentUser, 'id'> | null,
  roomCode: unknown,
): Promise<
  (Seat & { gameState: GameState; opponentId: number }) | RoomActionError
> => {
  const seat = await findSeat(user, roomCode)
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
 * Writes the game back to the room it was read from and returns what to
 * send the players, unless the room was written in between (two clicks in a
 * row, both players at once): then nothing is written and the answer is
 * null. With `winnerId` the game is over and that seat is marked as the
 * winner.
 */
export const saveGame = async (
  room: RoomRow,
  gameState: GameState,
  winnerId?: number,
): Promise<SantoriniGameUpdate | null> => {
  // `updatedAt` is the room's version: always later than the one read.
  const version = Math.max(Date.now(), room.updatedAt.getTime() + 1)
  const status = winnerId === undefined ? 'PLAYING' : 'FINISHED'
  const saved = await prisma.$transaction(async (tx) => {
    const { count } = await tx.santoriniRoom.updateMany({
      where: { id: room.id, updatedAt: room.updatedAt, status: 'PLAYING' },
      data: {
        gameState: gameState as object,
        status,
        updatedAt: new Date(version),
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
  if (!saved) return null
  return {
    roomCode: room.roomCode,
    status,
    gameState,
    winnerId: winnerId ?? null,
    version,
  }
}

/**
 * Pushes a game's new state to its two players, in every tab they have
 * open, and to nobody else. Never throws: a player who misses it gets the
 * state from the loader the next time their socket connects.
 */
export const sendToPlayers = (room: RoomRow, update: SantoriniGameUpdate) => {
  try {
    getIO()
      .to(room.players.map((player) => userRoom(player.userId)))
      .emit('santorini:game', update)
  } catch (error) {
    if (globalThis.__blogSocketIO) {
      console.error('Sending a Santorini game update failed:', error)
    }
  }
}

/**
 * Tells the browsers showing a room (and, with `lobby`, the list of rooms)
 * that it changed, so they load it again. This is for the room's life
 * (opened, joined, left, started), which anyone looking at the list may
 * hear about, so the event carries no data. Never throws: without a
 * socket.io server the pages are just not live.
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
