import { buttonClass } from '~/components/button/button'
import { useState } from 'react'
import CommonLink from '~/components/common-link/common-link'
import { ErrorMessage } from '~/components/notice/notice'
import { QUIZ_PATH } from '~/lib/quiz/quiz'
import type { QuizState } from '~/lib/quiz/quiz'
import {
  endGame,
  nextPrint,
  revealPrint,
  startGame,
} from '~/lib/realtime/quiz-socket'
import PrintImage from './print-image'
import { Answered, Reveal, Scoreboard } from './results'
import { useQuiz, useQuizAction } from './use-quiz'
import type { LoadedQuiz } from './use-quiz'

const buttonClassName = `${buttonClass()} min-h-12`

/**
 * The shared screen, and the host's controls: the print as large as the
 * screen allows, who has answered, then the reveal. It shows nothing a
 * player's page does not, so it can be on a TV the whole time.
 */
const QuizHost = ({ loaded }: { loaded: LoadedQuiz }) => {
  const { state } = useQuiz(loaded)
  const { run, pending, error } = useQuizAction()
  const print = state?.print
  const running = state !== null && state.phase !== 'FINISHED' && print

  const handleEnd = (game: QuizState) => {
    if (!window.confirm('Encerrar o jogo agora? O placar fica como está.')) {
      return
    }
    void run(() => endGame({ gameId: game.gameId }))
  }

  return (
    <div data-testid="quiz-host" data-phase={state?.phase ?? 'NONE'}>
      <ErrorMessage message={error} testId="quiz-error" />
      {!running || !state || !print ? (
        <div className="mx-auto max-w-container">
          {state?.phase === 'FINISHED' && (
            <div className="mb-lg">
              <Scoreboard players={state.players} title="Placar final" />
            </div>
          )}
          <StartForm
            printCount={loaded.printCount ?? 0}
            pending={pending}
            onStart={(count) => void run(() => startGame({ count }))}
          />
          <p className="mt-lg text-xs">
            Quem joga abre{' '}
            <CommonLink href={QUIZ_PATH}>a página do jogo</CommonLink> no
            celular.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-md tablet:flex-row">
          <div className="min-w-0 flex-1">
            <div
              className="h-[45vh] border border-accent tablet:h-[78vh]"
              data-testid="quiz-screen"
            >
              <PrintImage
                key={print.id}
                print={print}
                kind={state.reveal ? 'original' : 'censurada'}
                variant="screen"
              />
            </div>
          </div>
          <div className="flex flex-col gap-md tablet:w-[22rem] tablet:shrink-0">
            <p className="text-md wght-bold" data-testid="quiz-progress">
              Print {state.position + 1} de {state.total}
            </p>
            {state.reveal ? (
              <Reveal
                print={print}
                reveal={state.reveal}
                players={state.players}
              />
            ) : (
              <Answered players={state.players} />
            )}
            <div className="flex flex-wrap gap-md">
              {state.phase === 'GUESSING' ? (
                <button
                  type="button"
                  className={buttonClassName}
                  disabled={pending}
                  onClick={() =>
                    void run(() =>
                      revealPrint({
                        gameId: state.gameId,
                        position: state.position,
                      }),
                    )
                  }
                  data-testid="quiz-reveal-button"
                >
                  Revelar
                </button>
              ) : (
                <button
                  type="button"
                  className={buttonClassName}
                  disabled={pending}
                  onClick={() =>
                    void run(() =>
                      nextPrint({
                        gameId: state.gameId,
                        position: state.position,
                      }),
                    )
                  }
                  data-testid="quiz-next-button"
                >
                  {state.position + 1 >= state.total
                    ? 'Ver o placar final'
                    : 'Próximo print'}
                </button>
              )}
              <button
                type="button"
                className={buttonClassName}
                disabled={pending}
                onClick={() => handleEnd(state)}
                data-testid="quiz-end-button"
              >
                Encerrar jogo
              </button>
            </div>
            <Scoreboard players={state.players} title="Placar" />
          </div>
        </div>
      )}
    </div>
  )
}

interface StartFormProps {
  printCount: number
  pending: boolean
  onStart: (count: number) => void
}

const StartForm = ({ printCount, pending, onStart }: StartFormProps) => {
  // Empty means all of them.
  const [count, setCount] = useState('')
  if (printCount === 0) {
    return (
      <p data-testid="quiz-no-prints">
        Nenhum print foi carregado no banco de dados ainda (veja o README).
      </p>
    )
  }
  const chosen = count === '' ? printCount : Number(count)
  const valid = Number.isInteger(chosen) && chosen >= 1 && chosen <= printCount
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) onStart(chosen)
      }}
      data-testid="quiz-start"
    >
      <h2 className="mb-sm">Novo jogo</h2>
      <label className="mb-md block">
        Quantos prints? (há {printCount}; em branco, todos)
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={printCount}
          value={count}
          placeholder={String(printCount)}
          onChange={(event) => setCount(event.target.value)}
          className="mt-xs block min-h-12 w-32 border border-accent bg-background px-sm text-text"
          data-testid="quiz-count"
        />
      </label>
      <button
        type="submit"
        className={buttonClassName}
        disabled={pending || !valid}
        data-testid="quiz-start-button"
      >
        Começar
      </button>
    </form>
  )
}

export default QuizHost
