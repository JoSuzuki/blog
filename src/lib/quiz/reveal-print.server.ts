import type { CurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
import type { QuizAck } from './quiz'
import {
  GAME_CHANGED,
  INVALID,
  findLatestGame,
  hostInputSchema,
  readSlots,
  refuseUnlessHost,
  sendQuizState,
} from './quiz.server'

/**
 * The `quiz:reveal` socket event: the host reveals the print on screen. From
 * here on its guesses are locked, its original image can be fetched, and the
 * state the players get carries the answers and everybody's picks.
 */
export const revealPrint = async (
  user: CurrentUser,
  input: unknown,
): Promise<QuizAck> => {
  // 1. Validate, only the host, and the print the host was looking at.
  const notHost = refuseUnlessHost(user)
  if (notHost) return notHost
  const parsed = hostInputSchema.safeParse(input)
  if (!parsed.success) return INVALID
  const { gameId, position } = parsed.data

  const game = await findLatestGame()
  if (!game || game.id !== gameId || game.position !== position) {
    return GAME_CHANGED
  }
  // A second click on the same print: already done.
  if (game.phase === 'REVEALED') return { ok: true }
  if (game.phase !== 'GUESSING') return GAME_CHANGED
  const printId = game.printIds[position]
  const print = await prisma.quizPrint.findUnique({
    where: { id: printId },
    select: { slots: true },
  })

  // 2. Lock the guesses and mark the right ones, in one transaction. The
  // write to the game row waits for any guess being stored and stops the
  // ones that come after (see submitGuess).
  const revealed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.quizGame.updateMany({
      where: { id: gameId, phase: 'GUESSING', position },
      data: {
        phase: 'REVEALED',
        revealedCount: position + 1,
        version: { increment: 1 },
      },
    })
    if (count === 0) return false
    for (const slot of readSlots(print?.slots)) {
      await tx.quizGuess.updateMany({
        where: { gameId, printId, slot: slot.label, person: slot.person },
        data: { correct: true },
      })
    }
    return true
  })
  if (!revealed) return GAME_CHANGED

  // 3. Everyone sees the answers and the scores.
  await sendQuizState()
  return { ok: true }
}
