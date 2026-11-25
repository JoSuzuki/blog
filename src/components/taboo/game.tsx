import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import CommonLink from '~/components/common-link/common-link'
import {
  passSpeaker,
  playCard,
  startTurn,
  timeUp,
} from '~/lib/realtime/taboo-socket'
import { otherTeam } from '~/lib/taboo/game'
import type { PlayedOutcome, Team } from '~/lib/taboo/game'
import { joinRoom } from '~/lib/taboo/join-room'
import { leaveRoom } from '~/lib/taboo/leave-room'
import { playAgain } from '~/lib/taboo/play-again'
import { removePlayer } from '~/lib/taboo/remove-player'
import { TABOO_PATH, TEAM_NAMES } from '~/lib/taboo/room'
import type { GameView, RoomView } from '~/lib/taboo/room'
import { TEAM_CLASSES } from './theme'
import type { SceneOutcome } from './scene'
import { isMuted, play as playSound, setMuted } from './sounds'
import {
  ActionBar,
  ActionError,
  BigButton,
  CardHtml,
  OnlineDot,
  PlayedCards,
  Scene,
  TeamName,
  playerName,
} from './ui'
import {
  useReloadTaboo,
  useRoomAction,
  useServerNow,
  useWakeLock,
} from './use-taboo'

interface TabooGameProps {
  room: RoomView
  game: GameView
  online: number[]
  clockOffset: number
}

type Role = 'speaker' | 'guesser' | 'watcher' | 'spectator'

/**
 * A game being played, or its result. Every action is a socket event, and
 * each new state is pushed to every player (see useTabooRoom).
 */
const TabooGame = ({ room, game, online, clockOffset }: TabooGameProps) => {
  const { roomCode, myPlayerId, players } = room
  const navigate = useNavigate()
  const reload = useReloadTaboo()
  const actions = useRoomAction({ reload: false })
  const lifeActions = useRoomAction()
  const { run, pending } = actions

  const myTeam: Team | null =
    myPlayerId === null
      ? null
      : game.teams[0].includes(myPlayerId)
        ? 0
        : game.teams[1].includes(myPlayerId)
          ? 1
          : null
  const role: Role =
    myPlayerId === null || myTeam === null
      ? 'spectator'
      : myPlayerId === game.speakerId
        ? 'speaker'
        : myTeam === game.team
          ? 'guesser'
          : 'watcher'
  const speaker = playerName(players, game.speakerId)
  const over = game.phase === 'over'
  const playing = game.phase === 'playing'

  // Phones: the screen stays on during the game, and the speaker's phone
  // buzzes when their turn comes up.
  useWakeLock(!over)
  const myTurnUp = !over && game.phase === 'ready' && role === 'speaker'
  useEffect(() => {
    if (myTurnUp) navigator.vibrate?.([80, 60, 80])
  }, [myTurnUp, game.turnNumber])

  // The clock.
  const now = useServerNow(clockOffset, playing)
  const totalMs = game.settings.turnSeconds * 1000
  const remainingMs =
    playing && game.endsAt ? Math.max(0, game.endsAt - now) : null
  const seconds = remainingMs === null ? null : Math.ceil(remainingMs / 1000)

  // When the clock runs out, every seated page tells the server (the first
  // one ends the turn), and keeps trying until the turn has moved on.
  useEffect(() => {
    if (!playing || !game.endsAt || myPlayerId === null) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    let attempts = 0
    const fire = async () => {
      if (cancelled) return
      attempts += 1
      const answer = await timeUp(roomCode, game.turnNumber)
      if (cancelled) return
      // Pushed state replaces this effect when the turn ends; if nothing has
      // come after a moment, ask again (and read the room again).
      timer = setTimeout(
        () => {
          if (!answer.ok || attempts % 3 === 0) void reload()
          void fire()
        },
        answer.ok ? 2500 : 700,
      )
    }
    const wait = game.endsAt - (Date.now() + clockOffset) + 150
    timer = setTimeout(() => void fire(), Math.max(0, wait))
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [
    playing,
    game.endsAt,
    game.turnNumber,
    roomCode,
    myPlayerId,
    clockOffset,
    reload,
  ])

  // Sounds: what happened to the last card, turns starting and ending, the
  // last seconds ticking.
  const [muted, setMutedState] = useState(false)
  useEffect(() => setMutedState(isMuted()), [])
  const previous = useRef({
    serial: game.cardSerial,
    phase: game.phase,
    turn: game.turnNumber,
  })
  useEffect(() => {
    const before = previous.current
    previous.current = {
      serial: game.cardSerial,
      phase: game.phase,
      turn: game.turnNumber,
    }
    if (before.turn === game.turnNumber && game.cardSerial > before.serial) {
      const last = game.played.at(-1)?.outcome
      if (last === 'correct') playSound('correct')
      else if (last === 'taboo') {
        playSound('taboo')
        navigator.vibrate?.(200)
      } else if (last === 'skipped') playSound('skip')
    }
    if (before.phase !== 'playing' && game.phase === 'playing')
      playSound('start')
    if (before.phase === 'playing' && game.phase !== 'playing') playSound('end')
  }, [game.cardSerial, game.phase, game.turnNumber, game.played])
  const lastTick = useRef<number | null>(null)
  useEffect(() => {
    if (seconds === null || seconds > 5 || seconds <= 0) return
    if (lastTick.current === seconds) return
    lastTick.current = seconds
    playSound('tick')
  }, [seconds])

  // Actions.
  const cardId = game.card?.id ?? null
  const mark = (outcome: PlayedOutcome) => {
    if (cardId === null) return
    void run(() => playCard(roomCode, { cardId, outcome }))
  }
  const start = () => void run(() => startTurn(roomCode))

  // Keyboard: the speaker uses → / Enter (guessed) and ← / S (skip), the other
  // team T or Space (Tabu!), and Space starts a turn.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable]')) return
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key.toLowerCase()
      if (
        game.phase === 'ready' &&
        role === 'speaker' &&
        (key === ' ' || key === 'enter')
      ) {
        event.preventDefault()
        start()
      } else if (playing && role === 'speaker') {
        if (key === 'arrowright' || key === 'enter') {
          event.preventDefault()
          mark('correct')
        } else if (key === 'arrowleft' || key === 's') {
          event.preventDefault()
          mark('skipped')
        }
      } else if (
        playing &&
        role === 'watcher' &&
        (key === 't' || key === ' ')
      ) {
        event.preventDefault()
        mark('taboo')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // What the table shows.
  const tableKey = playing ? `${game.turnNumber}:${game.cardSerial}` : null
  const tableCardId = game.card?.id ?? null
  const tableCard = useMemo(
    () => (tableKey === null ? null : { key: tableKey, card: game.card }),
    // A pushed view is a new object even when the card is the same one.
    [tableKey, tableCardId],
  )
  const outcomes = useMemo<SceneOutcome[]>(() => {
    const list: SceneOutcome[] = game.played.map((p, i) => ({
      key: `${game.turnNumber}:${i}`,
      card: p.card,
      outcome: p.outcome,
    }))
    if (game.lastTurn) {
      const t = game.lastTurn
      t.cards.forEach((p, i) =>
        list.push({
          key: `${t.number}:${i}`,
          card: p.card,
          outcome: p.outcome,
        }),
      )
    }
    return list
  }, [game.played, game.turnNumber, game.lastTurn])

  const handleLeave = async () => {
    if (
      !over &&
      !window.confirm('Sair da partida? Seu time continua sem você.')
    )
      return
    const result = await lifeActions.run(() =>
      leaveRoom({ data: { roomCode } }),
    )
    if (result?.ok) await navigate({ to: TABOO_PATH })
  }

  const isHost = myPlayerId !== null && myPlayerId === room.hostId
  const turnLabel = over
    ? 'Fim de jogo'
    : `Turno ${Math.min(game.turnNumber + 1, game.totalTurns)} de ${game.totalTurns}`

  return (
    <div
      data-testid="taboo-game"
      className="flex flex-col gap-sm tablet:gap-md"
    >
      <Scoreboard
        game={game}
        seconds={seconds}
        turnLabel={turnLabel}
        myTeam={myTeam}
      />

      <div
        className="relative -mx-sm h-[min(52svh,30rem)] min-h-64 overflow-hidden border-y-2 border-accent bg-accent-background tablet:mx-0 tablet:h-[min(58vh,34rem)] tablet:min-h-72 tablet:border-2"
        data-testid="taboo-table"
      >
        <Scene
          mode={over ? 'over' : playing ? 'playing' : 'ready'}
          tableCard={tableCard}
          outcomes={outcomes}
          speakingTeam={game.team}
          scores={game.scores}
          timeLeft={remainingMs === null ? null : remainingMs / totalMs}
          winner={game.winner}
          fallback={<CardHtml card={game.card} team={game.team} />}
        />
        <button
          type="button"
          onClick={() => {
            setMuted(!muted)
            setMutedState(!muted)
          }}
          className="pressable absolute top-sm right-sm border border-accent bg-background px-sm py-xs text-sm"
          aria-label={muted ? 'Ligar o som' : 'Desligar o som'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        {game.card && (
          // The same card, for screen readers.
          <div className="sr-only" aria-live="polite">
            Carta: {game.card.word}. Proibidas: {game.card.taboo.join(', ')}.
          </div>
        )}
      </div>

      <div
        className="flex flex-col items-center gap-sm text-center"
        data-testid="taboo-controls"
      >
        {over ? (
          <Result room={room} game={game} />
        ) : (
          <RoleBanner role={role} game={game} speaker={speaker} />
        )}
        <ActionBar>
          {!over && game.phase === 'ready' && role === 'speaker' && (
            <BigButton
              wide
              tone="good"
              onClick={start}
              disabled={pending}
              hint="espaço"
              testId="taboo-start-turn"
            >
              Começar meu turno
            </BigButton>
          )}
          {!over &&
            game.phase === 'ready' &&
            role !== 'speaker' &&
            role !== 'spectator' &&
            !online.includes(game.speakerId) &&
            game.teams[game.team].length > 1 && (
              <BigButton
                wide
                tone="plain"
                onClick={() =>
                  void run(() => passSpeaker(roomCode, game.turnNumber))
                }
                disabled={pending}
                testId="taboo-pass"
              >
                {speaker} saiu: passar a vez
              </BigButton>
            )}
          {playing && role === 'speaker' && (
            <>
              <BigButton
                wide
                tone="plain"
                onClick={() => mark('skipped')}
                disabled={pending || cardId === null}
                hint="←"
                testId="taboo-skip"
              >
                Pular
              </BigButton>
              <BigButton
                wide
                tone="good"
                onClick={() => mark('correct')}
                disabled={pending || cardId === null}
                hint="→"
                testId="taboo-correct"
              >
                Acertou!
              </BigButton>
            </>
          )}
          {playing && role === 'watcher' && (
            <BigButton
              wide
              tone="bad"
              onClick={() => mark('taboo')}
              disabled={pending || cardId === null}
              hint="T"
              testId="taboo-buzz"
            >
              TABU!
            </BigButton>
          )}
          {role === 'spectator' && !over && myPlayerId === null && (
            <BigButton
              wide
              onClick={() =>
                void lifeActions.run(() => joinRoom({ data: { roomCode } }))
              }
              disabled={lifeActions.pending}
              testId="taboo-join"
            >
              Entrar no jogo
            </BigButton>
          )}
          {over && myPlayerId !== null && (
            <BigButton
              wide
              tone="good"
              onClick={() =>
                void lifeActions.run(() => playAgain({ data: { roomCode } }))
              }
              disabled={lifeActions.pending}
              testId="taboo-play-again"
            >
              Jogar de novo
            </BigButton>
          )}
        </ActionBar>
        <ActionError message={actions.error ?? lifeActions.error} />
        {playing && game.played.length > 0 && (
          <div className="flex flex-col items-center gap-xs">
            <p className="text-xs text-accent">Neste turno</p>
            <PlayedCards cards={game.played} />
          </div>
        )}
        {!playing && !over && game.lastTurn && (
          <div
            className="flex flex-col items-center gap-xs"
            data-testid="taboo-last-turn"
          >
            <p className="text-sm">
              {playerName(players, game.lastTurn.speakerId)} (
              {TEAM_NAMES[game.lastTurn.team]}) fez{' '}
              <strong>{formatPoints(game.lastTurn.points)}</strong> no último
              turno.
            </p>
            <PlayedCards cards={game.lastTurn.cards} />
          </div>
        )}
      </div>

      <div className="grid gap-sm tablet:grid-cols-2">
        {([0, 1] as const).map((team) => (
          <TeamPanel
            key={team}
            team={team}
            room={room}
            game={game}
            online={online}
            canRemove={isHost}
            pending={lifeActions.pending}
            onRemove={(playerId, name) => {
              if (!window.confirm(`Tirar ${name} da partida?`)) return
              void lifeActions.run(() =>
                removePlayer({ data: { roomCode, playerId } }),
              )
            }}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-sm text-sm">
        <CommonLink href={TABOO_PATH}>← Salas</CommonLink>
        {myPlayerId !== null && (
          <button
            type="button"
            className="pressable border border-accent px-sm py-xs disabled:opacity-50"
            onClick={() => void handleLeave()}
            disabled={lifeActions.pending}
          >
            Sair da sala
          </button>
        )}
      </div>
    </div>
  )
}

const formatPoints = (points: number) =>
  `${points > 0 ? '+' : points < 0 ? '−' : ''}${Math.abs(points)} ${Math.abs(points) === 1 ? 'ponto' : 'pontos'}`

const ScoreCell = ({
  team,
  game,
  myTeam,
}: {
  team: Team
  game: GameView
  myTeam: Team | null
}) => {
  const active = !game.winner && game.team === team
  return (
    <div
      className={
        // Phones stack the name over the score, so "Vermelho" fits.
        'flex min-w-0 flex-col-reverse gap-xs border-2 px-sm py-xs text-white transition-[opacity,box-shadow] tablet:flex-row tablet:items-center tablet:gap-sm tablet:px-md tablet:py-sm ' +
        TEAM_CLASSES[team].from +
        (team === 1
          ? ' items-end text-right tablet:flex-row-reverse'
          : ' items-start') +
        (active ? ' shadow-[3px_3px_0_0_var(--colors-accent)]' : ' opacity-75')
      }
      style={{
        background: `linear-gradient(${team === 0 ? 135 : 225}deg, var(--colors-team-${team === 0 ? 'blue' : 'red'}), var(--colors-team-${team === 0 ? 'blue' : 'red'}-dark))`,
      }}
    >
      <span
        className="text-lg leading-none tabular-nums wght-bold"
        data-testid={`taboo-score-${team}`}
      >
        {game.scores[team]}
      </span>
      <span className="max-w-full min-w-0 truncate text-xs leading-tight tablet:text-sm">
        {TEAM_NAMES[team]}
        {myTeam === team && (
          <span className="hidden text-xs tablet:block">
            {' '}
            seu time
          </span>
        )}
      </span>
    </div>
  )
}

const Scoreboard = ({
  game,
  seconds,
  turnLabel,
  myTeam,
}: {
  game: GameView
  seconds: number | null
  turnLabel: string
  myTeam: Team | null
}) => (
  <div
    className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-sm tablet:gap-md"
    data-testid="taboo-scoreboard"
  >
    <ScoreCell team={0} game={game} myTeam={myTeam} />
    <div className="flex min-w-xl flex-col items-center justify-center border-2 border-accent px-sm py-xs tablet:px-md">
      <span
        className={
          'text-lg leading-none tabular-nums wght-bold ' +
          (seconds !== null && seconds <= 10 ? 'text-team-red' : '')
        }
        data-testid="taboo-timer"
        aria-live="off"
      >
        {seconds === null ? '—' : seconds}
      </span>
      <span
        className="text-xs whitespace-nowrap text-accent"
        data-testid="taboo-turn"
      >
        {turnLabel}
      </span>
    </div>
    <ScoreCell team={1} game={game} myTeam={myTeam} />
  </div>
)

const RoleBanner = ({
  role,
  game,
  speaker,
}: {
  role: Role
  game: GameView
  speaker: string
}) => {
  const ready = game.phase === 'ready'
  const text = (() => {
    switch (role) {
      case 'speaker':
        return ready
          ? 'Sua vez de falar! Quando seu time estiver pronto, comece o turno.'
          : 'Faça seu time adivinhar, sem dizer as palavras proibidas.'
      case 'guesser':
        return ready
          ? `${speaker} vai falar para o seu time. Prepare-se!`
          : `Adivinhe! ${speaker} está falando.`
      case 'watcher':
        return ready
          ? `${speaker} (${TEAM_NAMES[game.team]}) vai falar. Você fiscaliza.`
          : `Fique de olho: ${speaker} não pode dizer as palavras da carta.`
      default:
        return ready
          ? `${speaker} vai falar pelo time ${TEAM_NAMES[game.team]}.`
          : `${speaker} está falando pelo time ${TEAM_NAMES[game.team]}.`
    }
  })()
  return (
    <p
      className="max-w-[40ch] text-sm leading-snug wght-semibold tablet:text-md"
      role="status"
      data-testid="taboo-role"
    >
      {text}
    </p>
  )
}

const Result = ({ room, game }: { room: RoomView; game: GameView }) => {
  const myTeam =
    room.myPlayerId === null
      ? null
      : game.teams[0].includes(room.myPlayerId)
        ? 0
        : game.teams[1].includes(room.myPlayerId)
          ? 1
          : null
  const best = game.history.reduce<GameView['history'][number] | null>(
    (top, turn) => (!top || turn.points > top.points ? turn : top),
    null,
  )
  return (
    <div
      className="flex flex-col items-center gap-xs"
      data-testid="taboo-result"
    >
      <p className="text-lg wght-bold">
        {game.winner === 'tie' ? (
          'Empate!'
        ) : game.winner !== null ? (
          <>
            {myTeam === game.winner ? 'Vocês venceram! ' : ''}
            Vitória do <TeamName team={game.winner} />
          </>
        ) : (
          'Fim de jogo'
        )}
      </p>
      <p className="text-sm">
        {game.scores[0]} × {game.scores[1]}
        {best && best.points > 0 && (
          <>
            {' '}
            · melhor turno: {playerName(room.players, best.speakerId)} com{' '}
            {formatPoints(best.points)}
          </>
        )}
      </p>
    </div>
  )
}

const TeamPanel = ({
  team,
  room,
  game,
  online,
  canRemove,
  pending,
  onRemove,
}: {
  team: Team
  room: RoomView
  game: GameView
  online: number[]
  canRemove: boolean
  pending: boolean
  onRemove: (playerId: number, name: string) => void
}) => {
  const turns = game.history.filter((t) => t.team === team)
  const spoke = (id: number) =>
    game.history.filter((t) => t.speakerId === id).length
  return (
    <section
      className={`border-2 p-sm ${TEAM_CLASSES[team].border}`}
      data-testid={`taboo-panel-${team}`}
    >
      <h2
        className={`-mx-sm -mt-sm mb-sm flex items-baseline justify-between px-sm py-xs text-md text-white wght-bold ${TEAM_CLASSES[team].bg}`}
      >
        {TEAM_NAMES[team]}
        <span className="text-xs">
          {turns.length} {turns.length === 1 ? 'turno' : 'turnos'}
        </span>
      </h2>
      <ul className="flex flex-col gap-xs">
        {game.teams[team].length === 0 && (
          <li className="text-sm text-accent">Ninguém mais neste time</li>
        )}
        {game.teams[team].map((id) => {
          const name = playerName(room.players, id)
          const speaking = game.phase !== 'over' && game.speakerId === id
          const next =
            game.phase !== 'over' && game.upNext[team] === id && !speaking
          return (
            <li key={id} className="flex items-center gap-xs text-sm">
              <OnlineDot online={online.includes(id)} />
              <span className={id === room.myPlayerId ? 'wght-bold' : ''}>
                {name}
              </span>
              {id === room.myPlayerId && (
                <span className="text-accent">(você)</span>
              )}
              {speaking && (
                <span
                  className={`px-xs text-xs text-white ${TEAM_CLASSES[team].bg}`}
                >
                  falando
                </span>
              )}
              {next && (
                <span className="border border-accent px-xs text-xs text-accent">
                  próximo
                </span>
              )}
              <span
                className="ml-auto text-xs text-accent"
                title="Vezes que falou"
              >
                {spoke(id)}×
              </span>
              {canRemove && id !== room.myPlayerId && !online.includes(id) && (
                <button
                  type="button"
                  title={`Tirar ${name} da partida`}
                  className="border border-accent px-xs text-xs text-accent hover:bg-accent hover:text-background"
                  disabled={pending}
                  onClick={() => onRemove(id, name)}
                >
                  ✕
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {otherTeam(team) === game.team && game.phase === 'playing' && (
        <p className="mt-xs text-xs text-accent">
          De olho nas palavras proibidas.
        </p>
      )}
    </section>
  )
}

export default TabooGame
