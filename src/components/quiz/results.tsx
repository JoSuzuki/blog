import type {
  QuizPlayerView,
  QuizPrintView,
  QuizRevealView,
} from '~/lib/quiz/quiz'

/** Who has answered the print on screen (never what). */
export const Answered = ({ players }: { players: QuizPlayerView[] }) => {
  const answered = players.filter((player) => player.answered).length
  // By name, so that nobody jumps around as the scores change.
  const byName = [...players].sort((a, b) => a.name.localeCompare(b.name, 'pt'))
  return (
    <div data-testid="quiz-answered">
      <p className="mb-xs text-xs wght-semibold">
        Já responderam: {answered}
        {players.length > 0 && ` de ${players.length}`}
      </p>
      <ul className="flex flex-wrap gap-xs text-xs">
        {byName.map((player) => (
          <li
            key={player.userId}
            className={
              'border border-accent px-sm py-xs ' +
              (player.answered ? 'bg-accent text-background' : 'opacity-60')
            }
            data-answered={player.answered}
          >
            {player.name} {player.answered ? '✓' : '…'}
          </li>
        ))}
      </ul>
    </div>
  )
}

interface ScoreboardProps {
  players: QuizPlayerView[]
  /** The reader, to mark their own line. */
  userId?: number
  title: string
}

export const Scoreboard = ({ players, userId, title }: ScoreboardProps) => (
  <div data-testid="quiz-scoreboard">
    <h2 className="mb-xs">{title}</h2>
    {players.length === 0 ? (
      <p className="text-sm">Ninguém respondeu ainda.</p>
    ) : (
      <ol>
        {players.map((player, index) => (
          <li
            key={player.userId}
            className={
              'flex justify-between gap-md border-b border-accent py-xs ' +
              (player.userId === userId ? 'wght-bold' : '')
            }
            data-testid={`quiz-score-${player.userId}`}
          >
            <span>
              {/* Equal scores share a place. */}
              {players.findIndex((other) => other.score === player.score) + 1}º{' '}
              {player.name}
              {player.userId === userId && ' (você)'}
              {index === 0 && player.score > 0 && ' 🏆'}
            </span>
            <span data-testid="quiz-score-value">{player.score}</span>
          </li>
        ))}
      </ol>
    )}
  </div>
)

interface RevealProps {
  print: QuizPrintView
  reveal: QuizRevealView
  players: QuizPlayerView[]
  userId?: number
}

/** The answers of the print on screen, and what everybody picked. */
export const Reveal = ({ print, reveal, players, userId }: RevealProps) => {
  const nameOf = (id: number) =>
    players.find((player) => player.userId === id)?.name ?? '?'
  const guesses = [...reveal.guesses].sort((a, b) =>
    nameOf(a.userId).localeCompare(nameOf(b.userId), 'pt'),
  )
  return (
    <div data-testid="quiz-reveal">
      <ul className="mb-md flex flex-wrap gap-sm">
        {print.slots.map((slot) => (
          <li
            key={slot}
            className="border border-accent px-sm py-xs"
            data-testid={`quiz-answer-${slot}`}
          >
            Pessoa {slot}:{' '}
            <strong className="text-accent wght-bold">
              {reveal.answers[slot]}
            </strong>
          </li>
        ))}
      </ul>
      {guesses.length === 0 ? (
        <p className="text-sm">Ninguém respondeu este print.</p>
      ) : (
        <div className="overflow-auto">
          <table
            className="w-full table-auto text-left text-xs"
            data-testid="quiz-guesses"
          >
            <thead>
              <tr>
                <th className="pr-sm">Quem</th>
                {print.slots.map((slot) => (
                  <th key={slot} className="pr-sm">
                    {slot}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {guesses.map((guess) => (
                <tr
                  key={guess.userId}
                  className={guess.userId === userId ? 'wght-bold' : ''}
                  data-testid={`quiz-guesses-${guess.userId}`}
                >
                  <td className="pr-sm">
                    {nameOf(guess.userId)}
                    {guess.userId === userId && ' (você)'}
                  </td>
                  {print.slots.map((slot) => {
                    const pick = guess.picks[slot]
                    const right = pick === reveal.answers[slot]
                    return (
                      <td
                        key={slot}
                        className={'pr-sm ' + (right ? 'text-accent' : '')}
                        data-right={right}
                      >
                        {pick ? `${pick} ${right ? '✓' : '✗'}` : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
