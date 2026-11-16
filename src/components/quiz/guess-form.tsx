import { useState } from 'react'
import { QUIZ_PEOPLE } from '~/lib/quiz/quiz'
import type { QuizPrintView } from '~/lib/quiz/quiz'
import { submitGuess } from '~/lib/realtime/quiz-socket'

interface GuessFormProps {
  gameId: number
  print: QuizPrintView
  /** The reader's picks as the server has them. */
  picks: Record<string, string>
}

/**
 * Picking who each slot is: one slot at a time, A first, moving to the next
 * empty one after each pick. A pick is sent at once and can be changed until
 * the reveal by going back to its slot. Mount it with the print's id as key.
 */
const GuessForm = ({ gameId, print, picks }: GuessFormProps) => {
  // What was tapped and is not confirmed yet, so the tap shows at once.
  const [sending, setSending] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const shown = { ...picks, ...sending }

  const firstEmpty = (from: Record<string, string>) =>
    print.slots.find((slot) => !from[slot])
  const [active, setActive] = useState(
    () => firstEmpty(picks) ?? print.slots[0],
  )
  const complete = print.slots.every((slot) => shown[slot])

  const pick = async (slot: string, person: string) => {
    if (shown[slot] === person) {
      setActive(firstEmpty(shown) ?? slot)
      return
    }
    setError(null)
    setSending((current) => ({ ...current, [slot]: person }))
    setActive(firstEmpty({ ...shown, [slot]: person }) ?? slot)
    const result = await submitGuess({
      gameId,
      printId: print.id,
      slot,
      person,
    })
    // Answered: the server's picks (pushed just before the answer) take
    // over, unless the same slot was tapped again meanwhile.
    setSending((current) => {
      if (current[slot] !== person) return current
      const { [slot]: _done, ...rest } = current
      return rest
    })
    if (!result.ok) setError(result.message)
  }

  return (
    <div data-testid="quiz-guess">
      {print.slots.length > 1 && (
        <div className="mb-sm flex flex-wrap gap-sm" role="tablist">
          {print.slots.map((slot) => (
            <button
              key={slot}
              type="button"
              role="tab"
              aria-selected={slot === active}
              onClick={() => setActive(slot)}
              className={
                'min-h-12 flex-1 border border-accent px-sm text-left text-xs ' +
                (slot === active ? 'bg-accent text-background' : 'text-text')
              }
              data-testid={`quiz-slot-${slot}`}
            >
              <span className="block wght-semibold">Pessoa {slot}</span>
              <span className="block">{shown[slot] ?? 'escolher…'}</span>
            </button>
          ))}
        </div>
      )}
      <p className="mb-sm wght-semibold" id="quiz-question">
        Quem é a Pessoa {active}?
      </p>
      <div
        className="grid grid-cols-3 gap-sm"
        role="radiogroup"
        aria-labelledby="quiz-question"
      >
        {QUIZ_PEOPLE.map((person) => {
          const selected = shown[active] === person
          return (
            <button
              key={person}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => void pick(active, person)}
              className={
                'min-h-14 touch-manipulation border border-accent px-xs text-sm ' +
                (selected ? 'bg-accent text-background wght-bold' : 'text-text')
              }
              data-testid={`quiz-person-${person}`}
            >
              {person}
            </button>
          )
        })}
      </div>
      {error && (
        <p role="alert" className="my-sm text-accent" data-testid="quiz-error">
          {error}
        </p>
      )}
      <p
        className="mt-sm text-xs"
        role="status"
        data-testid="quiz-guess-status"
      >
        {complete
          ? 'Resposta enviada. Dá para mudar até a revelação.'
          : print.slots.length > 1
            ? 'Escolha alguém para cada pessoa do print.'
            : 'Escolha alguém.'}
      </p>
    </div>
  )
}

export default GuessForm
