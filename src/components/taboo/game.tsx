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
import { TEAM_COLORS } from './card-art'
import type { SceneOutcome } from './scene'
import { isMuted, play as playSound, setMuted } from './sounds'
import {
  ActionError,
  BigButton,
  CardHtml,
  OnlineDot,
  PlayedCards,
  Scene,
  TeamName,
  playerName,
} from './ui'
import { useReloadTaboo, useRoomAction, useServerNow } from './use-taboo'

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
    <div data-testid="taboo-game" className="flex flex-col gap-md">
      <Scoreboard
        game={game}
        seconds={seconds}
        turnLabel={turnLabel}
        myTeam={myTeam}
      />

      <div
        className="relative h-[min(58vh,34rem)] min-h-72 w-full overflow-hidden rounded-2xl"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 10%, color-mix(in srgb, var(--colors-accent) 22%, transparent), transparent 70%)',
        }}
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
          className="absolute top-sm right-sm rounded-full bg-black/25 px-sm py-xs text-sm text-white backdrop-blur"
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
        <div className="flex flex-wrap justify-center gap-sm">
          {!over && game.phase === 'ready' && role === 'speaker' && (
            <BigButton
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
                tone="plain"
                onClick={() => mark('skipped')}
                disabled={pending || cardId === null}
                hint="←"
                testId="taboo-skip"
              >
                Pular
              </BigButton>
              <BigButton
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
        </div>
        <ActionError message={actions.error ?? lifeActions.error} />
        {playing && game.played.length > 0 && (
          <div className="flex flex-col items-center gap-xs">
            <p className="text-xs opacity-70">Neste turno</p>
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
            className="text-secondary underline disabled:opacity-50"
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
    className="grid grid-cols-[1fr_auto_1fr] items-center gap-sm"
    data-testid="taboo-scoreboard"
  >
    {([0, 1] as const).map((team) => {
      const active = !game.winner && game.team === team
      const cell = (
        <div
          key={team}
          className={
            'flex items-center gap-sm rounded-2xl px-sm py-sm text-white transition-transform tablet:px-md ' +
            (team === 1 ? 'flex-row-reverse text-right' : '') +
            (active ? ' tablet:scale-[1.03]' : ' opacity-80')
          }
          style={{
            background: `linear-gradient(135deg, ${TEAM_COLORS[team].light}, ${TEAM_COLORS[team].dark})`,
            boxShadow: active
              ? `0 0 0 3px var(--colors-background), 0 0 0 5px ${TEAM_COLORS[team].light}`
              : undefined,
          }}
        >
          <span
            className="text-[2.5rem] leading-none tabular-nums wght-bold"
            data-testid={`taboo-score-${team}`}
          >
            {game.scores[team]}
          </span>
          <span className="text-sm leading-tight">
            {TEAM_NAMES[team]}
            {myTeam === team && (
              <span className="block text-xs opacity-80">seu time</span>
            )}
          </span>
        </div>
      )
      return team === 0 ? cell : null
    })}
    <div className="flex min-w-24 flex-col items-center">
      <span
        className={
          'text-[2.25rem] leading-none tabular-nums wght-bold ' +
          (seconds !== null && seconds <= 10 ? 'text-[#E5383B]' : '')
        }
        data-testid="taboo-timer"
        aria-live="off"
      >
        {seconds === null ? '—' : seconds}
      </span>
      <span className="text-xs opacity-70" data-testid="taboo-turn">
        {turnLabel}
      </span>
    </div>
    {([1] as const).map((team) => {
      const active = !game.winner && game.team === team
      return (
        <div
          key={team}
          className={
            'flex flex-row-reverse items-center gap-sm rounded-2xl px-sm py-sm text-right text-white transition-transform tablet:px-md' +
            (active ? ' tablet:scale-[1.03]' : ' opacity-80')
          }
          style={{
            background: `linear-gradient(225deg, ${TEAM_COLORS[team].light}, ${TEAM_COLORS[team].dark})`,
            boxShadow: active
              ? `0 0 0 3px var(--colors-background), 0 0 0 5px ${TEAM_COLORS[team].light}`
              : undefined,
          }}
        >
          <span
            className="text-[2.5rem] leading-none tabular-nums wght-bold"
            data-testid={`taboo-score-${team}`}
          >
            {game.scores[team]}
          </span>
          <span className="text-sm leading-tight">
            {TEAM_NAMES[team]}
            {myTeam === team && (
              <span className="block text-xs opacity-80">seu time</span>
            )}
          </span>
        </div>
      )
    })}
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
      className="max-w-[40ch] text-md wght-semibold"
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
      className="rounded-xl border-2 p-sm"
      style={{ borderColor: TEAM_COLORS[team].light }}
      data-testid={`taboo-panel-${team}`}
    >
      <h2
        className="mb-xs flex items-baseline justify-between text-md wght-bold"
        style={{ color: TEAM_COLORS[team].light }}
      >
        {TEAM_NAMES[team]}
        <span className="text-xs opacity-70">
          {turns.length} {turns.length === 1 ? 'turno' : 'turnos'}
        </span>
      </h2>
      <ul className="flex flex-col gap-xs">
        {game.teams[team].length === 0 && (
          <li className="text-sm opacity-60">Ninguém mais neste time</li>
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
                <span className="opacity-60">(você)</span>
              )}
              {speaking && (
                <span
                  className="rounded-full px-xs text-xs text-white"
                  style={{ background: TEAM_COLORS[team].light }}
                >
                  falando
                </span>
              )}
              {next && <span className="text-xs opacity-60">próximo</span>}
              <span
                className="ml-auto text-xs opacity-60"
                title="Vezes que falou"
              >
                {spoke(id)}×
              </span>
              {canRemove && id !== room.myPlayerId && !online.includes(id) && (
                <button
                  type="button"
                  title={`Tirar ${name} da partida`}
                  className="text-xs opacity-60 hover:opacity-100"
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
        <p className="mt-xs text-xs opacity-70">
          De olho nas palavras proibidas.
        </p>
      )}
    </section>
  )
}

export default TabooGame
