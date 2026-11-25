import { useEffect, useMemo, useState } from 'react'
import { buttonClass } from '~/components/button/button'
import type { GameState } from '~/lib/santorini/game'
import { describeTurn, replayFrames } from '~/lib/santorini/replay'
import type { RoomPlayerView } from '~/lib/santorini/room'
import { PlayerColors, ReadOnlyBoard } from './board-view'

/** Seconds per turn when playing the game back. */
const PLAY_INTERVAL_MS = 1200

interface ReplayProps {
  gameState: GameState
  players: RoomPlayerView[]
  redPlayerId: number
}

/**
 * A finished game, turn by turn from its history: the board after each turn
 * (the worker that moved marked), a line saying what was played, and controls
 * to step, jump or play it back. Opens on the final position.
 */
const SantoriniReplay = ({ gameState, players, redPlayerId }: ReplayProps) => {
  const frames = useMemo(
    () =>
      replayFrames(gameState.history, [
        players[0]?.id ?? 0,
        players[1]?.id ?? 0,
      ]),
    [gameState.history, players],
  )
  const last = frames.length - 1
  const [index, setIndex] = useState(last)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    if (index >= last) {
      setPlaying(false)
      return
    }
    const timer = setTimeout(() => setIndex((i) => i + 1), PLAY_INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [playing, index, last])

  const go = (to: number) => {
    setPlaying(false)
    setIndex(Math.max(0, Math.min(last, to)))
  }
  const togglePlay = () => {
    if (playing) return setPlaying(false)
    if (index >= last) setIndex(0)
    setPlaying(true)
  }

  // Arrow keys step through the game, as on any player.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select')) return
      if (event.key === 'ArrowLeft') go(index - 1)
      else if (event.key === 'ArrowRight') go(index + 1)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const frame = frames[index]
  const name = (id: number | undefined) =>
    players.find((p) => p.id === id)?.name ?? 'Alguém'

  const control = buttonClass()

  return (
    <div data-testid="santorini-replay">
      <ReadOnlyBoard gameState={frame.gameState} redPlayerId={redPlayerId} />
      <PlayerColors players={players} redPlayerId={redPlayerId} />

      <p
        className="mt-sm min-h-[3em]"
        aria-live="polite"
        data-testid="santorini-replay-turn"
      >
        <span className="text-xs">
          Jogada {index} de {last}
        </span>
        <br />
        {describeTurn(frame, name(frame.turn?.playerId))}
      </p>

      <input
        type="range"
        min={0}
        max={last}
        value={index}
        onChange={(event) => go(Number(event.target.value))}
        aria-label="Jogada"
        className="my-sm block w-full accent-[var(--colors-accent)]"
      />
      <div className="grid grid-cols-5 gap-sm">
        <button
          type="button"
          className={control}
          onClick={() => go(0)}
          disabled={index === 0}
          aria-label="Início"
        >
          <Icon path="M6 5v14M19 5l-9 7 9 7z" />
        </button>
        <button
          type="button"
          className={control}
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Jogada anterior"
        >
          <Icon path="M16 5l-9 7 9 7z" />
        </button>
        <button
          type="button"
          className={control}
          onClick={togglePlay}
          disabled={last === 0}
          aria-label={playing ? 'Pausar' : 'Reproduzir'}
        >
          <Icon
            path={playing ? 'M7 5v14M17 5v14' : 'M3 5l8 7-8 7zM13 5l8 7-8 7z'}
          />
        </button>
        <button
          type="button"
          className={control}
          onClick={() => go(index + 1)}
          disabled={index === last}
          aria-label="Próxima jogada"
        >
          <Icon path="M8 5l9 7-9 7z" />
        </button>
        <button
          type="button"
          className={control}
          onClick={() => go(last)}
          disabled={index === last}
          aria-label="Fim"
        >
          <Icon path="M18 5v14M5 5l9 7-9 7z" />
        </button>
      </div>
    </div>
  )
}

/** A square-cornered control glyph in the text color. */
const Icon = ({ path }: { path: string }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    className="mx-auto block h-[1.25em] w-[1.25em]"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinejoin="miter"
  >
    <path d={path} />
  </svg>
)

export default SantoriniReplay
