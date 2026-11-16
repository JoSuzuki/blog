import { useCallback, useEffect, useRef, useState } from 'react'
import type { GetQuizResult } from '~/lib/quiz/get-quiz'
import { QUIZ_PATH, isNewerQuiz } from '~/lib/quiz/quiz'
import type { QuizAck, QuizMyGuesses, QuizState } from '~/lib/quiz/quiz'
import { subscribeToQuiz } from '~/lib/realtime/quiz-socket'
import { useReload } from '~/lib/use-reload'

export type LoadedQuiz = Extract<GetQuizResult, { ok: true }>

const EMPTY_PICKS: Record<string, string> = {}

/**
 * The quiz, live. The loader's data is where the page starts from (and comes
 * back to whenever the socket connects again); from then on the newer of it
 * and what the server pushed is shown. `picks` are the reader's own for the
 * print on screen.
 */
export const useQuiz = (loaded: LoadedQuiz) => {
  const reload = useReload(QUIZ_PATH)
  const [pushed, setPushed] = useState<QuizState | null>(null)
  const [pushedMine, setPushedMine] = useState<QuizMyGuesses | null>(null)

  useEffect(
    () =>
      subscribeToQuiz({
        onState: (state) =>
          setPushed((current) =>
            current && !isNewerQuiz(state, current) ? current : state,
          ),
        onMine: (mine) =>
          setPushedMine((current) =>
            current && !isNewerQuiz(mine, current) ? current : mine,
          ),
        onSync: () => void reload(),
      }),
    [reload],
  )

  const state =
    pushed && (!loaded.state || isNewerQuiz(pushed, loaded.state))
      ? pushed
      : loaded.state
  const mine =
    pushedMine && (!loaded.mine || isNewerQuiz(pushedMine, loaded.mine))
      ? pushedMine
      : loaded.mine
  const picks =
    state?.print &&
    mine &&
    mine.gameId === state.gameId &&
    mine.printId === state.print.id
      ? mine.picks
      : EMPTY_PICKS

  return { state, picks }
}

/**
 * Runs the host's events one at a time (a click while one is in flight is
 * dropped) and keeps the last refusal's message for the page to show. Nothing
 * is reloaded afterwards: the result is pushed.
 */
export const useQuizAction = () => {
  const running = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (action: () => Promise<QuizAck>) => {
    if (running.current) return null
    running.current = true
    setPending(true)
    setError(null)
    try {
      const result = await action()
      if (!result.ok) setError(result.message)
      return result
    } finally {
      running.current = false
      setPending(false)
    }
  }, [])

  return { run, pending, error }
}
