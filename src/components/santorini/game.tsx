import { ClientOnly } from '@tanstack/react-router'
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import Button from '~/components/button/button'
import CommonLink from '~/components/common-link/common-link'
import type { SantoriniGameUpdate } from '~/lib/realtime/events'
import {
  commitTurn,
  playAction,
  resign,
  subscribeToGames,
  undoTurn,
} from '~/lib/realtime/santorini-socket'
import { applyTurnActions, getNextActionType } from '~/lib/santorini/game'
import type {
  ActionType,
  GameState,
  Position,
  Worker,
} from '~/lib/santorini/game'
import type { RoomView } from '~/lib/santorini/room'
import { ActionError } from './notices'
import { useReloadSantorini, useRoomAction } from './use-room-actions'

// three.js is large: the board is its own chunk, fetched only on this page
// and only in the browser.
const SantoriniBoard = lazy(() => import('./board'))

const TURN_HINTS: Record<ActionType, string> = {
  place_worker: 'Sua vez: posicione seus dois trabalhadores.',
  select_worker: 'Sua vez: escolha um dos seus trabalhadores.',
  move_worker: 'Mova o trabalhador para uma casa vizinha.',
  build_from_worker: 'Construa em uma casa vizinha ao trabalhador.',
  commit_actions: 'Confirme a jogada, ou desfaça para jogar de outro jeito.',
}

interface SantoriniGameProps {
  /** The room as the loader read it. */
  room: RoomView
  gameState: GameState
  /** The viewer's seat. */
  playerId: number
}

/**
 * A game being played, or its final position once it is over.
 *
 * The game is played over the socket: a click sends an event, and every new
 * state is pushed to both players. The loader's room is where the page
 * starts from (and comes back to after a reconnection); from then on the
 * newer of the two, by `version`, is what is shown.
 */
const SantoriniGame = (props: SantoriniGameProps) => {
  const { room, playerId } = props
  const { roomCode } = room
  const { run, pending, error } = useRoomAction({ reload: false })
  const reload = useReloadSantorini()

  const [pushed, setPushed] = useState<SantoriniGameUpdate | null>(null)
  useEffect(
    () =>
      subscribeToGames((update) => {
        if (update.roomCode !== roomCode) return
        setPushed((current) =>
          current && current.version >= update.version ? current : update,
        )
        // The end of the game changes more than the board (who won, which
        // rooms the reader is in): let the loaders catch up.
        if (update.status === 'FINISHED') void reload()
      }),
    [roomCode, reload],
  )
  const live = pushed && pushed.version > room.version ? pushed : null

  const gameState = live?.gameState ?? props.gameState
  const playing = (live?.status ?? room.status) === 'PLAYING'
  const winnerId = live
    ? live.winnerId
    : (room.players.find((player) => player.winner)?.id ?? null)
  const myTurn = gameState.currentTurn.playerId === playerId
  const nextActionType = playing ? getNextActionType(gameState, playerId) : null
  // The board shows the turn's pending steps as if they were played.
  const board = useMemo(() => applyTurnActions(gameState), [gameState])

  const opponent = room.players.find((player) => player.id !== playerId)
  const winner = room.players.find((player) => player.id === winnerId)

  const play = (tile: Position) => {
    if (!nextActionType || nextActionType === 'commit_actions') return
    void run(() => playAction(roomCode, { type: nextActionType, tile }))
  }
  const handleWorkerClick = (worker: Worker) => {
    if (worker.playerId === playerId) play(worker.position)
  }
  const handleResign = () => {
    if (!window.confirm('Desistir da partida? O outro jogador vence.')) return
    void run(() => resign(roomCode))
  }

  const status = !playing
    ? winner
      ? `Fim de jogo. ${winner.id === playerId ? 'Você venceu!' : `${winner.name} venceu.`}`
      : 'Fim de jogo.'
    : nextActionType
      ? TURN_HINTS[nextActionType]
      : `Vez de ${opponent?.name ?? 'seu oponente'}.`

  const placeholder = (
    <div className="flex h-full items-center justify-center text-sm">
      Carregando o tabuleiro…
    </div>
  )

  return (
    <div data-testid="santorini-game">
      <p className="mb-sm" role="status" data-testid="santorini-status">
        {status}
      </p>
      <div
        className="h-[min(70vh,34rem)] w-full overflow-hidden border border-accent"
        data-testid="santorini-board"
      >
        <ClientOnly fallback={placeholder}>
          <Suspense fallback={placeholder}>
            <SantoriniBoard
              gameState={board}
              nextActionType={nextActionType}
              playerId={playerId}
              canPerformActions={playing && !pending}
              onTileClick={play}
              onWorkerClick={handleWorkerClick}
            />
          </Suspense>
        </ClientOnly>
      </div>
      <p className="mt-xs text-xs">
        Seus trabalhadores são os vermelhos; os de{' '}
        {opponent?.name ?? 'seu oponente'}, os azuis. Arraste para girar o
        tabuleiro.
      </p>
      <ActionError message={error} />
      <div className="mt-sm flex flex-wrap items-center gap-md">
        {playing && nextActionType === 'commit_actions' && (
          <Button
            type="button"
            disabled={pending}
            onClick={() => void run(() => commitTurn(roomCode))}
          >
            Confirmar jogada
          </Button>
        )}
        {playing && myTurn && gameState.currentTurn.actions.length > 0 && (
          <Button
            type="button"
            disabled={pending}
            onClick={() => void run(() => undoTurn(roomCode))}
          >
            Desfazer jogada
          </Button>
        )}
        {playing && (
          <Button type="button" disabled={pending} onClick={handleResign}>
            Desistir
          </Button>
        )}
        {!playing && (
          <CommonLink href="/games/santorini">
            Voltar para as salas →
          </CommonLink>
        )}
      </div>
    </div>
  )
}

export default SantoriniGame
