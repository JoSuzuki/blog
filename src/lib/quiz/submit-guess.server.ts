import { z } from 'zod'
import type { CurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
import { QUIZ_PEOPLE, QUIZ_SLOT_PATTERN } from './quiz'
import type { QuizAck, QuizMyGuesses } from './quiz'
import {
  GAME_CHANGED,
  INVALID,
  findLatestGame,
  readSlots,
  refuse,
  sendMyGuesses,
  sendQuizState,
} from './quiz.server'

const guessSchema = z.object({
  gameId: z.number().int().positive(),
  printId: z.number().int().positive(),
  slot: z.string().regex(QUIZ_SLOT_PATTERN),
  person: z.enum(QUIZ_PEOPLE),
})

const ALREADY_REVEALED = refuse(
  'conflict',
  'As respostas deste print já foram reveladas.',
)

/**
 * The `quiz:guess` socket event: a player picks who a slot of the print on
 * screen is, or changes their pick. Allowed until the print is revealed.
 */
export const submitGuess = async (
  user: CurrentUser,
  input: unknown,
): Promise<QuizAck> => {
  // 1. Validate: a known person, for a slot of the print that is on screen.
  const parsed = guessSchema.safeParse(input)
  if (!parsed.success) return INVALID
  const { gameId, printId, slot, person } = parsed.data

  const game = await findLatestGame()
  if (!game || game.id !== gameId) return GAME_CHANGED
  if (game.printIds[game.position] !== printId) return GAME_CHANGED
  if (game.phase !== 'GUESSING') return ALREADY_REVEALED
  const print = await prisma.quizPrint.findUnique({
    where: { id: printId },
    select: { slots: true },
  })
  if (!print || !readSlots(print.slots).some((s) => s.label === slot)) {
    return INVALID
  }

  // 2. Store it. The write to the game row comes first and takes its lock,
  // so a guess and the reveal cannot cross: whichever commits first wins,
  // and a guess that comes second finds the phase changed and stores nothing.
  const mine = await prisma.$transaction(
    async (tx): Promise<QuizMyGuesses | null> => {
      const { count } = await tx.quizGame.updateMany({
        where: { id: gameId, phase: 'GUESSING', position: game.position },
        data: { version: { increment: 1 } },
      })
      if (count === 0) return null
      const where = { gameId, printId, userId: user.id }
      await tx.quizGuess.upsert({
        where: { gameId_printId_slot_userId: { ...where, slot } },
        update: { person },
        create: { ...where, slot, person },
      })
      const [guesses, written] = await Promise.all([
        tx.quizGuess.findMany({ where, select: { slot: true, person: true } }),
        tx.quizGame.findUniqueOrThrow({
          where: { id: gameId },
          select: { version: true },
        }),
      ])
      return {
        gameId,
        printId,
        version: written.version,
        picks: Object.fromEntries(guesses.map((g) => [g.slot, g.person])),
      }
    },
  )
  if (!mine) return ALREADY_REVEALED

  // 3. The player's tabs get their picks; everyone gets who has answered.
  sendMyGuesses(user.id, mine)
  void sendQuizState()
  return { ok: true }
}
