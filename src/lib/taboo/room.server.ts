import { randomInt } from 'node:crypto'
import { setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'
import type { CurrentUser } from '~/lib/auth/current-user.server'
import { Prisma } from '~/generated/prisma/client'
import { prisma } from '~/lib/db.server'
import { tabooRoom, userRoom } from '~/lib/realtime/events'
import type { TabooAck } from '~/lib/realtime/events'
import { getIO } from '~/lib/realtime/io.server'
import { getCard } from './cards.server'
import {
  DEFAULT_SETTINGS,
  ROUNDS_PER_PLAYER_OPTIONS,
  TURN_SECONDS_OPTIONS,
  nextSpeaker,
  seesCard,
  winnerOf,
} from './game'
import type { CardResult, TabooGameState, TabooSettings, Team } from './game'
import { ROOM_CODE_PATTERN } from './room'
import type {
  GameView,
  PlayedCard,
  RoomActionError,
  RoomStatus,
  RoomView,
} from './room'

// What the Tabu actions share: finding the room and the reader's seat, turning
// a row into what one player may see, writing without overwriting someone
// else's write, and telling the browsers. Used both by server functions (the
// room's life) and by the socket's game events, so nothing here reads the
// request: the caller says who the reader is.

export const roomCodeSchema = z.string().regex(ROOM_CODE_PATTERN)

export const settingsSchema = z.object({
  roundsPerPlayer: z
    .number()
    .int()
    .refine((n) =>
      (ROUNDS_PER_PLAYER_OPTIONS as readonly number[]).includes(n),
    ),
  turnSeconds: z
    .number()
    .int()
    .refine((n) => (TURN_SECONDS_OPTIONS as readonly number[]).includes(n)),
})

export const parseSettings = (value: unknown): TabooSettings => {
  const parsed = settingsSchema.safeParse(value)
  return parsed.success ? parsed.data : DEFAULT_SETTINGS
}

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
export const GAME_NOT_RUNNING = refuse(
  'invalid',
  'A partida não está em andamento.',
)
export const NOT_HOST = refuse(
  'invalid',
  'Só quem está há mais tempo na sala pode fazer isso.',
)
/** The room changed between reading it and writing; the page catches up. */
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
      team: true,
      user: { select: { name: true } },
    },
  },
} as const

/** A room row with its seats, in the order the players sat down. */
export const findRoom = (roomCode: string) =>
  prisma.tabooRoom.findUnique({ where: { roomCode }, include: roomInclude })

export type RoomRow = NonNullable<Awaited<ReturnType<typeof findRoom>>>

/** What other players see of a reader: the first name only. */
export const toDisplayName = (name: string) =>
  name.trim().split(/\s+/)[0] || name

/** The seat that has been in the room the longest. */
export const hostOf = (room: Pick<RoomRow, 'players'>) =>
  room.players[0] ?? null

/** The room a reader is sitting in that has not finished, if any. */
export const findActiveRoomCode = async (
  userId: number,
): Promise<string | null> => {
  const room = await prisma.tabooRoom.findFirst({
    where: {
      status: { in: ['WAITING', 'PLAYING'] },
      players: { some: { userId } },
    },
    select: { roomCode: true },
  })
  return room?.roomCode ?? null
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

const toPlayed = (results: CardResult[]): PlayedCard[] =>
  results.map((r) => ({ card: getCard(r.cardId), outcome: r.outcome }))

/** The game as `playerId` may see it (null: someone who is not playing). */
export const toGameView = (
  state: TabooGameState,
  playerId: number | null,
): GameView => {
  const last = state.history.at(-1)
  const upNext = ([0, 1] as const).map((team) => {
    // During a turn, its own team's next speaker comes after this one.
    const turns =
      team === state.team && state.phase !== 'over'
        ? state.teamTurns[team] + 1
        : state.teamTurns[team]
    const counts: [number, number] = [...state.teamTurns]
    counts[team] = turns
    return nextSpeaker(state.teams, counts, team) ?? null
  }) as [number | null, number | null]
  return {
    settings: state.settings,
    teams: state.teams,
    turnNumber: state.turnNumber,
    totalTurns: state.totalTurns,
    scores: state.scores,
    phase: state.phase,
    team: state.team,
    speakerId: state.speakerId,
    endsAt: state.endsAt,
    card:
      state.phase === 'playing' &&
      state.cardId !== null &&
      seesCard(state, playerId)
        ? getCard(state.cardId)
        : null,
    cardSerial: state.results.length,
    played: toPlayed(state.results),
    lastTurn: last
      ? {
          number: last.number,
          team: last.team,
          speakerId: last.speakerId,
          points: last.points,
          cards: toPlayed(last.results),
        }
      : null,
    history: state.history.map((t) => ({
      team: t.team,
      speakerId: t.speakerId,
      points: t.points,
    })),
    upNext,
    winner: winnerOf(state),
  }
}

/** The seats with the room's page open somewhere right now. */
export const findOnline = async (room: RoomRow): Promise<number[]> => {
  try {
    const sockets = await getIO().in(tabooRoom(room.roomCode)).fetchSockets()
    const userIds = new Set(sockets.map((s) => s.data.userId))
    return room.players.filter((p) => userIds.has(p.userId)).map((p) => p.id)
  } catch {
    return []
  }
}

interface RoomState {
  status: RoomStatus
  gameState: TabooGameState | null
  version: number
}

const stateOf = (room: RoomRow): RoomState => ({
  status: room.status,
  gameState: room.gameState as TabooGameState | null,
  version: room.updatedAt.getTime(),
})

export const toRoomView = (
  room: RoomRow,
  userId: number,
  online: number[],
  state: RoomState = stateOf(room),
): RoomView => {
  const myPlayerId = room.players.find((p) => p.userId === userId)?.id ?? null
  const game = state.gameState
  const teamOfSeat = (seatId: number, stored: number): Team =>
    game?.teams[1].includes(seatId)
      ? 1
      : game?.teams[0].includes(seatId)
        ? 0
        : stored === 1
          ? 1
          : 0
  return {
    roomCode: room.roomCode,
    status: state.status,
    players: room.players.map((player) => ({
      id: player.id,
      name: toDisplayName(player.user.name),
      team: teamOfSeat(player.id, player.team),
    })),
    hostId: hostOf(room)?.id ?? null,
    myPlayerId,
    settings: parseSettings(room.settings),
    game: game ? toGameView(game, myPlayerId) : null,
    online,
    version: state.version,
    serverNow: Date.now(),
  }
}

// ---------------------------------------------------------------------------
// Seats
// ---------------------------------------------------------------------------

export interface Seat {
  room: RoomRow
  playerId: number
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
  return { room, playerId }
}

/** A seat in a room whose game is being played, with the game. */
export const findSeatInGame = async (
  user: Pick<CurrentUser, 'id'> | null,
  roomCode: unknown,
): Promise<(Seat & { gameState: TabooGameState }) | RoomActionError> => {
  const seat = await findSeat(user, roomCode)
  if ('ok' in seat) return seat
  const gameState = seat.room.gameState as TabooGameState | null
  if (seat.room.status !== 'PLAYING' || !gameState) return GAME_NOT_RUNNING
  return { ...seat, gameState }
}

// ---------------------------------------------------------------------------
// Writing and telling
// ---------------------------------------------------------------------------

/**
 * Writes the game back to the room it was read from, unless the room was
 * written in between (two clicks at once): then nothing is written and the
 * answer is null. A game whose phase is `over` finishes the room. Seats'
 * stored teams follow the game's, so a rematch starts from them.
 */
export const saveGame = async (
  room: RoomRow,
  gameState: TabooGameState,
): Promise<RoomState | null> => {
  // `updatedAt` is the room's version: always later than the one read.
  const version = Math.max(Date.now(), room.updatedAt.getTime() + 1)
  const status: RoomStatus = gameState.phase === 'over' ? 'FINISHED' : 'PLAYING'
  const { count } = await prisma.tabooRoom.updateMany({
    where: { id: room.id, updatedAt: room.updatedAt, status: 'PLAYING' },
    data: {
      gameState: gameState as object,
      status,
      updatedAt: new Date(version),
    },
  })
  if (count === 0) return null
  return { status, gameState, version }
}

/**
 * Pushes the room's new state to each of its players, each with their own
 * view (the card on the table is only in some of them), in every tab they
 * have open. Never throws: a player who misses it gets the state from the
 * loader the next time their socket connects.
 */
export const sendToPlayers = async (room: RoomRow, state: RoomState) => {
  try {
    const io = getIO()
    const online = await findOnline(room)
    for (const player of room.players) {
      io.to(userRoom(player.userId)).emit(
        'taboo:state',
        toRoomView(room, player.userId, online, state),
      )
    }
  } catch (error) {
    if (globalThis.__blogSocketIO) {
      console.error('Sending a Tabu update failed:', error)
    }
  }
}

/**
 * Tells the browsers showing a room (and, with `lobby`, the list of rooms)
 * that it changed, so they load it again. For the room's life (opened,
 * joined, left, started), so the event carries no data. Never throws.
 */
export const announce = (roomCode: string | null, lobby = false) => {
  try {
    const io = getIO()
    const channels = [
      ...(roomCode ? [roomCode] : []),
      ...(lobby ? ['lobby'] : []),
    ]
    for (const channel of channels) {
      io.to(tabooRoom(channel)).emit('taboo:changed', { channel })
    }
  } catch (error) {
    if (globalThis.__blogSocketIO) {
      console.error('Announcing a Tabu change failed:', error)
    }
  }
}

/**
 * Tells a room's page who has it open, after a socket joined or left its
 * channel. Never throws.
 */
export const announcePresence = async (roomCode: string) => {
  try {
    const room = await findRoom(roomCode)
    if (!room) return
    const online = await findOnline(room)
    getIO()
      .to(tabooRoom(roomCode))
      .emit('taboo:presence', { roomCode, online, at: Date.now() })
  } catch (error) {
    if (globalThis.__blogSocketIO) {
      console.error('Announcing Tabu presence failed:', error)
    }
  }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/** A new version for a room last written at `updatedAt`. */
export const nextVersion = (updatedAt: Date) =>
  new Date(Math.max(Date.now(), updatedAt.getTime() + 1))

/**
 * Takes a seat out of a room, whatever its status. During a game the player
 * leaves the game too (see `removePlayer`), and the game may end because of
 * it. The room goes away with its last player. Null when the room changed
 * since it was read.
 */
export const removeSeat = async (
  room: RoomRow,
  playerId: number,
  removeFromGame: (state: TabooGameState, playerId: number) => TabooGameState,
): Promise<{ deleted: boolean; state: RoomState | null } | null> => {
  const gameState = room.gameState as TabooGameState | null
  const playing = room.status === 'PLAYING' && gameState !== null
  const nextGame = playing ? removeFromGame(gameState, playerId) : gameState
  const status: RoomStatus =
    playing && nextGame?.phase === 'over' ? 'FINISHED' : room.status
  const version = nextVersion(room.updatedAt)
  return prisma.$transaction(async (tx: Tx) => {
    const { count } = await tx.tabooRoom.updateMany({
      where: { id: room.id, updatedAt: room.updatedAt },
      data: {
        status,
        ...(playing ? { gameState: nextGame as object } : {}),
        updatedAt: version,
      },
    })
    if (count === 0) return null
    await tx.tabooRoomPlayer.delete({ where: { id: playerId } })
    const left = await tx.tabooRoomPlayer.count({ where: { roomId: room.id } })
    if (left === 0) {
      await tx.tabooRoom.delete({ where: { id: room.id } })
      return { deleted: true, state: null }
    }
    return {
      deleted: false,
      state: playing
        ? { status, gameState: nextGame, version: version.getTime() }
        : null,
    }
  })
}

/** Writes SQL NULL into a JSON column (a plain `null` is refused there). */
export const DB_NULL = Prisma.DbNull

/** A random number in [0, 1) from the system's secure source, for dealing. */
export const secureRandom = () => randomInt(2 ** 47) / 2 ** 47

/**
 * Writes a game event's new state and pushes it to the players, or answers
 * that the room changed meanwhile (another click got there first).
 */
export const commitGame = async (
  room: RoomRow,
  gameState: TabooGameState,
): Promise<TabooAck> => {
  const state = await saveGame(room, gameState)
  if (!state) return ROOM_CHANGED
  await sendToPlayers(room, state)
  if (state.status === 'FINISHED') announce(room.roomCode, true)
  return { ok: true }
}
