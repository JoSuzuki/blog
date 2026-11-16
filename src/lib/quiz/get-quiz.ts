import { createServerFn } from '@tanstack/react-start'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { canPlayQuiz, isAdmin } from '~/lib/auth/roles'
import { prisma } from '~/lib/db.server'
import type { QuizMyGuesses, QuizState } from './quiz'
import { loadMyGuesses, loadQuizState } from './quiz.server'

export type GetQuizResult =
  | {
      ok: true
      /** The newest game, or null if none was ever started. */
      state: QuizState | null
      /** The reader's own picks for the print on screen. */
      mine: QuizMyGuesses | null
      userId: number
      /** Whether the reader may conduct the game (start, reveal, next, end). */
      host: boolean
      /** How many prints a game can have. Only told to the host. */
      printCount: number | null
    }
  | { ok: false; reason: 'not_found' | 'unavailable' }

/**
 * The quiz as the reader may see it, for the loaders of its pages. To anyone
 * whose role (read from the database now) does not let them play, it does not
 * exist. Sets no error status: during server rendering it runs inside the
 * page's request.
 */
export const getQuiz = createServerFn({ method: 'GET' }).handler(
  async (): Promise<GetQuizResult> => {
    try {
      const user = await getCurrentUser()
      if (!user || !canPlayQuiz(user.role)) {
        return { ok: false, reason: 'not_found' }
      }
      const host = isAdmin(user.role)
      const state = await loadQuizState()
      const [mine, printCount] = await Promise.all([
        state ? loadMyGuesses(user.id, state) : null,
        host
          ? prisma.quizPrint.count({ where: { image: { isNot: null } } })
          : null,
      ])
      return { ok: true, state, mine, userId: user.id, host, printCount }
    } catch (error) {
      console.error('Loading the quiz failed:', error)
      return { ok: false, reason: 'unavailable' }
    }
  },
)
