import type { CurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
import type { QuizAck } from './quiz'
import {
  GAME_CHANGED,
  INVALID,
  hostInputSchema,
  refuseUnlessHost,
  sendQuizState,
} from './quiz.server'

const endSchema = hostInputSchema.pick({ gameId: true })

/**
 * The `quiz:end` socket event: the host ends the game wherever it is. The
 * scores stay as they are; a print that was not revealed stays that way.
 */
export const endGame = async (
  user: CurrentUser,
  input: unknown,
): Promise<QuizAck> => {
  // 1. Validate, and only the host.
  const notHost = refuseUnlessHost(user)
  if (notHost) return notHost
  const parsed = endSchema.safeParse(input)
  if (!parsed.success) return INVALID

  // 2. End it, if it is still running.
  const { count } = await prisma.quizGame.updateMany({
    where: { id: parsed.data.gameId, phase: { not: 'FINISHED' } },
    data: { phase: 'FINISHED', version: { increment: 1 } },
  })
  if (count === 0) return GAME_CHANGED

  // 3. Everyone sees the final scores.
  await sendQuizState()
  return { ok: true }
}
