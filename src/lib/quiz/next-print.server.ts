import type { CurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
import type { QuizAck } from './quiz'
import {
  GAME_CHANGED,
  INVALID,
  findLatestGame,
  hostInputSchema,
  refuse,
  refuseUnlessHost,
  sendQuizState,
} from './quiz.server'

/**
 * The `quiz:next` socket event: after a reveal, the host moves on to the
 * next print. After the last one the game is over.
 */
export const nextPrint = async (
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
  if (game.phase === 'GUESSING') {
    return refuse('invalid', 'Revele as respostas antes de seguir.')
  }
  if (game.phase !== 'REVEALED') return GAME_CHANGED

  // 2. Move on, unless the game changed since it was read.
  const last = position + 1 >= game.printIds.length
  const { count } = await prisma.quizGame.updateMany({
    where: { id: gameId, phase: 'REVEALED', position },
    data: last
      ? { phase: 'FINISHED', version: { increment: 1 } }
      : {
          phase: 'GUESSING',
          position: position + 1,
          version: { increment: 1 },
        },
  })
  if (count === 0) return GAME_CHANGED

  // 3. Everyone sees the next print, or the final scores.
  await sendQuizState()
  return { ok: true }
}
