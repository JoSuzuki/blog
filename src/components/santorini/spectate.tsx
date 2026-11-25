import { useEffect, useMemo, useState } from 'react'
import Badge from '~/components/badge/badge'
import type { SantoriniGameUpdate } from '~/lib/realtime/events'
import { subscribeToGames } from '~/lib/realtime/santorini-socket'
import { applyTurnActions } from '~/lib/santorini/game'
import type { GameView } from '~/lib/santorini/room'
import { PlayerColors, ReadOnlyBoard } from './board-view'
import { useReloadSantorini } from './use-room-actions'

/**
 * A game being played, for anyone watching. Moves arrive over the socket on
 * the room's channel (the page subscribes to it), exactly as the players get
 * them; the loader's game is where the page starts from. When the game ends
 * the loader runs again and the page turns into the review.
 */
const SantoriniSpectate = ({
  game,
}: {
  game: GameView & { gameState: NonNullable<GameView['gameState']> }
}) => {
  const reload = useReloadSantorini()
  const [pushed, setPushed] = useState<SantoriniGameUpdate | null>(null)
  useEffect(
    () =>
      subscribeToGames((update) => {
        if (update.roomId !== game.id) return
        setPushed((current) =>
          current && current.version >= update.version ? current : update,
        )
        if (update.status === 'FINISHED') void reload()
      }),
    [game.id, reload],
  )
  const live = pushed && pushed.version > game.version ? pushed : null
  const gameState = live?.gameState ?? game.gameState
  // Like the players, watchers see the steps of the turn being played.
  const board = useMemo(() => applyTurnActions(gameState), [gameState])
  const redPlayerId = game.players[0]?.id ?? 0
  const turnOf = game.players.find(
    (p) => p.id === gameState.currentTurn.playerId,
  )

  return (
    <div data-testid="santorini-spectate">
      <p className="mb-sm flex items-center gap-sm" role="status">
        <Badge tone="live">AO VIVO</Badge>
        Vez de {turnOf?.name ?? '…'}.
      </p>
      <ReadOnlyBoard gameState={board} redPlayerId={redPlayerId} />
      <PlayerColors players={game.players} redPlayerId={redPlayerId} />
      <p className="mt-xs text-xs">
        Você está assistindo. Arraste para girar o tabuleiro.
      </p>
    </div>
  )
}

export default SantoriniSpectate
