import { ClientOnly } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'
import type { GameState } from '~/lib/santorini/game'
import type { RoomPlayerView } from '~/lib/santorini/room'

// three.js is large: the board is its own chunk, fetched only by a page that
// shows one and only in the browser.
const SantoriniBoard = lazy(() => import('./board'))

const ignore = () => {}

/**
 * A board nobody can play on: for watching a game or reviewing one.
 * `redPlayerId` is the seat whose workers are drawn red (the viewer's own,
 * on a game they played; otherwise the first player).
 */
export const ReadOnlyBoard = ({
  gameState,
  redPlayerId,
}: {
  gameState: GameState
  redPlayerId: number
}) => {
  const placeholder = (
    <div className="flex h-full items-center justify-center text-sm">
      Carregando o tabuleiro…
    </div>
  )
  return (
    <div
      className="aspect-[11/9] max-h-[30rem] w-full overflow-hidden border border-accent"
      data-testid="santorini-board"
    >
      <ClientOnly fallback={placeholder}>
        <Suspense fallback={placeholder}>
          <SantoriniBoard
            gameState={gameState}
            nextActionType={null}
            playerId={redPlayerId}
            canPerformActions={false}
            onTileClick={ignore}
            onWorkerClick={ignore}
          />
        </Suspense>
      </ClientOnly>
    </div>
  )
}

/** Which color is whose, under a board. */
export const PlayerColors = ({
  players,
  redPlayerId,
}: {
  players: Pick<RoomPlayerView, 'id' | 'name'>[]
  redPlayerId: number
}) => (
  <ul className="mt-xs flex flex-wrap gap-x-md gap-y-xs text-xs">
    {[...players]
      .sort(
        (a, b) => Number(b.id === redPlayerId) - Number(a.id === redPlayerId),
      )
      .map((player) => (
        <li key={player.id} className="flex items-center gap-xs">
          <span
            aria-hidden
            className={`inline-block h-[0.75em] w-[0.75em] ${
              player.id === redPlayerId ? 'bg-team-red-ink' : 'bg-team-blue-ink'
            }`}
          />
          {player.name} ({player.id === redPlayerId ? 'vermelho' : 'azul'})
        </li>
      ))}
  </ul>
)
