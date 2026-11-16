import { z } from 'zod'
import type { CurrentUser } from '~/lib/auth/current-user.server'
import { isAdmin } from '~/lib/auth/roles'
import { prisma } from '~/lib/db.server'
import { userRoom } from '~/lib/realtime/events'
import { getIO } from '~/lib/realtime/io.server'
import { QUIZ_SLOT_PATTERN } from './quiz'
import type {
  QuizActionError,
  QuizMyGuesses,
  QuizPlayerView,
  QuizState,
} from './quiz'

// What the quiz's loader, image route and socket events share: reading the
// newest game as the players may see it, sending it to them, and the guarded
// write the host's events use. Nothing here reads the request; the caller
// says who is asking, and has already checked that they may play (the role
// read from the database for that very call: `getCurrentUser` or
// `findOrCreateUser`).

export const refuse = (
  error: QuizActionError['error'],
  message: string,
): QuizActionError => ({ ok: false, error, message })

/** To whoever may not play, the quiz does not exist. */
export const QUIZ_NOT_FOUND = refuse('not_found', 'Jogo não encontrado.')
export const HOST_ONLY = refuse(
  'forbidden',
  'Só quem está conduzindo o jogo pode fazer isso.',
)
export const INVALID = refuse('invalid', 'Pedido inválido.')
/** The game moved on between the click and its arrival; the page catches up. */
export const GAME_CHANGED = refuse(
  'conflict',
  'O jogo mudou enquanto isso. Tente de novo.',
)

/** The refusal for a host event from someone who is not an admin, or null. */
export const refuseUnlessHost = (user: CurrentUser): QuizActionError | null =>
  isAdmin(user.role) ? null : HOST_ONLY

export const hostInputSchema = z.object({
  gameId: z.number().int().positive(),
  position: z.number().int().min(0),
})

/** What other players see of a reader: the first name only. */
const toDisplayName = (name: string) => name.trim().split(/\s+/)[0] || name

const slotsSchema = z.array(
  z.object({ label: z.string().regex(QUIZ_SLOT_PATTERN), person: z.string() }),
)

export interface PrintSlot {
  label: string
  person: string
}

/** The slots of a print as stored (`QuizPrint.slots`), answers included. */
export const readSlots = (slots: unknown): PrintSlot[] => {
  const parsed = slotsSchema.safeParse(slots)
  return parsed.success ? parsed.data : []
}

/** The newest game: the one being played, or the last one played. */
export const findLatestGame = () =>
  prisma.quizGame.findFirst({ orderBy: { id: 'desc' } })

export type GameRow = NonNullable<Awaited<ReturnType<typeof findLatestGame>>>

/**
 * The newest game as every player may see it, or null if none was ever
 * started. The answers of the print on screen are read here but only put in
 * the result once the game says the print is revealed.
 */
export const loadQuizState = async (): Promise<QuizState | null> => {
  const game = await findLatestGame()
  if (!game) return null

  const printId =
    game.phase === 'FINISHED' ? undefined : game.printIds[game.position]
  const [print, currentGuesses, scores, participants] = await Promise.all([
    printId === undefined
      ? null
      : prisma.quizPrint.findUnique({
          where: { id: printId },
          select: { id: true, width: true, height: true, slots: true },
        }),
    printId === undefined
      ? []
      : prisma.quizGuess.findMany({
          where: { gameId: game.id, printId },
          select: { userId: true, slot: true, person: true },
        }),
    prisma.quizGuess.groupBy({
      by: ['userId'],
      where: { gameId: game.id, correct: true },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { quizGuesses: { some: { gameId: game.id } } },
      select: { id: true, name: true },
    }),
  ])

  const slots = print ? readSlots(print.slots) : []
  const labels = slots.map((slot) => slot.label)
  const picksByUser = new Map<number, Record<string, string>>()
  for (const guess of currentGuesses) {
    if (!labels.includes(guess.slot)) continue
    const picks = picksByUser.get(guess.userId) ?? {}
    picks[guess.slot] = guess.person
    picksByUser.set(guess.userId, picks)
  }
  const scoreByUser = new Map(scores.map((s) => [s.userId, s._count._all]))

  const players: QuizPlayerView[] = participants
    .map((user) => ({
      userId: user.id,
      name: toDisplayName(user.name),
      score: scoreByUser.get(user.id) ?? 0,
      answered:
        labels.length > 0 &&
        labels.every((label) => picksByUser.get(user.id)?.[label]),
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'pt'))

  const revealed = game.phase === 'REVEALED' && print !== null
  return {
    gameId: game.id,
    version: game.version,
    phase: game.phase,
    position: game.position,
    total: game.printIds.length,
    print: print
      ? {
          id: print.id,
          width: print.width,
          height: print.height,
          slots: labels,
        }
      : null,
    players,
    reveal: revealed
      ? {
          answers: Object.fromEntries(slots.map((s) => [s.label, s.person])),
          guesses: [...picksByUser].map(([userId, picks]) => ({
            userId,
            picks,
          })),
        }
      : null,
  }
}

/** A player's own picks for the print on screen of `state`'s game. */
export const loadMyGuesses = async (
  userId: number,
  state: Pick<QuizState, 'gameId' | 'version' | 'print'>,
): Promise<QuizMyGuesses | null> => {
  if (!state.print) return null
  const guesses = await prisma.quizGuess.findMany({
    where: { gameId: state.gameId, printId: state.print.id, userId },
    select: { slot: true, person: true },
  })
  return {
    gameId: state.gameId,
    printId: state.print.id,
    version: state.version,
    picks: Object.fromEntries(guesses.map((g) => [g.slot, g.person])),
  }
}

/**
 * The ids of everyone who may play right now. A push goes to their rooms
 * (`user:<id>`, joined at the handshake) and to nobody else, so who receives
 * the game is decided by the roles stored at the moment of each push: there
 * is no room to stay in after a role was taken away.
 */
const findPlayerIds = async () => {
  const users = await prisma.user.findMany({
    where: { role: { in: ['SQUALI', 'ADMIN'] } },
    select: { id: true },
  })
  return users.map((user) => user.id)
}

/**
 * Pushes the newest game to every tab of everyone who may play. Never
 * throws: a page that misses it loads the state the next time its socket
 * connects.
 */
export const sendQuizState = async () => {
  try {
    const [state, playerIds] = await Promise.all([
      loadQuizState(),
      findPlayerIds(),
    ])
    if (!state || playerIds.length === 0) return
    getIO().to(playerIds.map(userRoom)).emit('quiz:state', state)
  } catch (error) {
    if (globalThis.__blogSocketIO) {
      console.error('Sending the quiz state failed:', error)
    }
  }
}

/** Pushes a player's own picks to their tabs, and to nobody else. */
export const sendMyGuesses = (userId: number, mine: QuizMyGuesses) => {
  try {
    getIO().to(userRoom(userId)).emit('quiz:mine', mine)
  } catch (error) {
    if (globalThis.__blogSocketIO) {
      console.error('Sending a player their quiz guesses failed:', error)
    }
  }
}

/**
 * How far a reader may see into a print, by the newest game only: its
 * censored image once the game has reached it, its original once the game
 * has revealed it. A print the game has not reached, or one from an older
 * game, gives nothing, so starting a new game hides every original again.
 */
export const findPrintAccess = async (
  printId: number,
): Promise<{ censored: boolean; original: boolean }> => {
  const game = await findLatestGame()
  const index = game ? game.printIds.indexOf(printId) : -1
  if (!game || index === -1) return { censored: false, original: false }
  return {
    censored: index <= game.position,
    original: index < game.revealedCount,
  }
}
