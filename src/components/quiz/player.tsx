import CommonLink from '~/components/common-link/common-link'
import { QUIZ_PATH } from '~/lib/quiz/quiz'
import GuessForm from './guess-form'
import PrintImage from './print-image'
import { Answered, Reveal, Scoreboard } from './results'
import { useQuiz } from './use-quiz'
import type { LoadedQuiz } from './use-quiz'

/** The quiz on a player's phone: the print, the picks, then the reveal. */
const QuizPlayer = ({ loaded }: { loaded: LoadedQuiz }) => {
  const { state, picks } = useQuiz(loaded)
  const { userId } = loaded
  const print = state?.print

  return (
    <div data-testid="quiz-player" data-phase={state?.phase ?? 'NONE'}>
      {loaded.host && (
        <p className="mb-md text-xs">
          <CommonLink href={`${QUIZ_PATH}/telao`}>
            Conduzir o jogo (telão) →
          </CommonLink>
        </p>
      )}
      {!state ? (
        <p data-testid="quiz-waiting">
          Nenhum jogo em andamento. Quando começar, o primeiro print aparece
          aqui sozinho.
        </p>
      ) : state.phase === 'FINISHED' || !print ? (
        <>
          <p className="mb-md" data-testid="quiz-finished">
            Fim de jogo! Quando outro começar, ele aparece aqui sozinho.
          </p>
          <Scoreboard
            players={state.players}
            userId={userId}
            title="Placar final"
          />
        </>
      ) : (
        <>
          <p
            className="mb-sm text-xs wght-semibold"
            data-testid="quiz-progress"
          >
            Print {state.position + 1} de {state.total}
          </p>
          <div className="mb-md">
            <PrintImage
              key={print.id}
              print={print}
              kind={state.reveal ? 'original' : 'censurada'}
              variant="fit"
            />
          </div>
          {state.reveal ? (
            <>
              <MyResult
                print={print.slots}
                picks={picks}
                state={state.reveal}
              />
              <div className="mb-lg">
                <Reveal
                  print={print}
                  reveal={state.reveal}
                  players={state.players}
                  userId={userId}
                />
              </div>
              <Scoreboard
                players={state.players}
                userId={userId}
                title="Placar"
              />
            </>
          ) : (
            <>
              <div className="mb-lg">
                <GuessForm
                  key={`${state.gameId}:${print.id}`}
                  gameId={state.gameId}
                  print={print}
                  picks={picks}
                />
              </div>
              <Answered players={state.players} />
            </>
          )}
        </>
      )}
    </div>
  )
}

interface MyResultProps {
  print: string[]
  picks: Record<string, string>
  state: { answers: Record<string, string> }
}

const MyResult = ({ print: slots, picks, state }: MyResultProps) => {
  const right = slots.filter((slot) => picks[slot] === state.answers[slot])
  const answered = slots.some((slot) => picks[slot])
  return (
    <p
      className="mb-md wght-semibold"
      role="status"
      data-testid="quiz-my-result"
    >
      {!answered
        ? 'Você não respondeu este print.'
        : slots.length === 1
          ? right.length === 1
            ? 'Você acertou!'
            : 'Você errou.'
          : `Você acertou ${right.length} de ${slots.length}.`}
    </p>
  )
}

export default QuizPlayer
