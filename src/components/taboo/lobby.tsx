import { useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  MAX_PLAYERS,
  MIN_TEAM_SIZE,
  ROUNDS_PER_PLAYER_OPTIONS,
  TURN_SECONDS_OPTIONS,
  canStart,
  countTurns,
} from '~/lib/taboo/game'
import type { TabooSettings, Team } from '~/lib/taboo/game'
import { joinRoom } from '~/lib/taboo/join-room'
import { leaveRoom } from '~/lib/taboo/leave-room'
import { removePlayer } from '~/lib/taboo/remove-player'
import { TABOO_PATH, TEAM_NAMES } from '~/lib/taboo/room'
import type { RoomView } from '~/lib/taboo/room'
import { setTeam } from '~/lib/taboo/set-team'
import { shuffleTeams } from '~/lib/taboo/shuffle-teams'
import { startGame } from '~/lib/taboo/start-game'
import { updateSettings } from '~/lib/taboo/update-settings'
import { TEAM_CLASSES } from './theme'
import {
  ActionBar,
  ActionError,
  BigButton,
  CardHtml,
  OnlineDot,
  Scene,
} from './ui'
import { useRoomAction } from './use-taboo'

interface LobbyProps {
  room: RoomView
  online: number[]
}

/** A room that is waiting: teams, settings, and the way in and out. */
const TabooLobby = ({ room, online }: LobbyProps) => {
  const navigate = useNavigate()
  const { run, pending, error } = useRoomAction()
  const { roomCode, myPlayerId, hostId, settings } = room
  const seated = myPlayerId !== null
  const isHost = seated && myPlayerId === hostId
  const me = room.players.find((p) => p.id === myPlayerId)

  const teams = ([0, 1] as const).map((team) =>
    room.players.filter((p) => p.team === team),
  ) as [typeof room.players, typeof room.players]
  const ready = canStart([teams[0].length, teams[1].length])
  const turns = countTurns(
    [teams[0].map((p) => p.id), teams[1].map((p) => p.id)],
    settings.roundsPerPlayer,
  )
  const minutes = Math.max(
    1,
    Math.round((turns * (settings.turnSeconds + 15)) / 60),
  )

  const handleLeave = async () => {
    const result = await run(() => leaveRoom({ data: { roomCode } }))
    if (result?.ok) await navigate({ to: TABOO_PATH })
  }
  const handleSettings = (change: Partial<TabooSettings>) =>
    void run(() =>
      updateSettings({
        data: { roomCode, settings: { ...settings, ...change } },
      }),
    )

  return (
    <div
      data-testid="taboo-lobby"
      className="grid gap-lg tablet:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
    >
      <div className="flex flex-col gap-md">
        <div className="-mx-sm h-44 tablet:mx-0 tablet:h-80">
          <Scene
            mode="lobby"
            tableCard={null}
            outcomes={[]}
            speakingTeam={0}
            scores={[0, 0]}
            timeLeft={null}
            winner={null}
            fallback={<CardHtml card={null} team={0} />}
          />
        </div>
        <InviteBox roomCode={roomCode} />
        <div className="text-sm leading-relaxed">
          <p className="mb-xs wght-semibold">Como se joga</p>
          <p>
            Na sua vez, faça seu time adivinhar a palavra da carta sem dizer
            nenhuma das cinco palavras proibidas. Cada acerto vale 1 ponto. O
            outro time vê a carta e aperta <strong>Tabu!</strong> se você
            escorregar: menos 1 ponto. Pular não custa nada além de tempo.
          </p>
        </div>
      </div>

      <div className="order-first flex flex-col gap-md tablet:order-none">
        <div className="grid grid-cols-2 gap-sm">
          {([0, 1] as const).map((team) => (
            <TeamColumn
              key={team}
              team={team}
              players={teams[team]}
              online={online}
              myPlayerId={myPlayerId}
              hostId={hostId}
              canMoveHere={seated && me?.team !== team}
              isHost={isHost}
              pending={pending}
              onJoinTeam={() =>
                void run(() => setTeam({ data: { roomCode, team } }))
              }
              onMove={(playerId) =>
                void run(() =>
                  setTeam({
                    data: { roomCode, team: team === 0 ? 1 : 0, playerId },
                  }),
                )
              }
              onRemove={(playerId, name) => {
                if (!window.confirm(`Tirar ${name} da sala?`)) return
                void run(() => removePlayer({ data: { roomCode, playerId } }))
              }}
            />
          ))}
        </div>
        {isHost && room.players.length > 1 && (
          <div>
            <button
              type="button"
              className="pressable border border-accent px-sm py-xs text-sm disabled:opacity-50"
              disabled={pending}
              onClick={() =>
                void run(() => shuffleTeams({ data: { roomCode } }))
              }
            >
              Sortear times
            </button>
          </div>
        )}

        <fieldset
          className="border-2 border-accent p-md"
          data-testid="taboo-settings"
          disabled={!isHost || pending}
        >
          <legend className="px-xs text-sm wght-semibold">
            Configuração{' '}
            {isHost
              ? ''
              : `(quem escolhe é ${room.players.find((p) => p.id === hostId)?.name ?? 'o anfitrião'})`}
          </legend>
          <Segmented
            label="Vezes que cada um fala"
            options={ROUNDS_PER_PLAYER_OPTIONS}
            value={settings.roundsPerPlayer}
            format={(n) => `${n}×`}
            onChange={(roundsPerPlayer) => handleSettings({ roundsPerPlayer })}
            testId="taboo-rounds"
          />
          <Segmented
            label="Tempo por turno"
            options={TURN_SECONDS_OPTIONS}
            value={settings.turnSeconds}
            format={(n) => `${n}s`}
            onChange={(turnSeconds) => handleSettings({ turnSeconds })}
            testId="taboo-seconds"
          />
          <p className="mt-sm text-sm" data-testid="taboo-summary">
            {turns > 0
              ? `${turns} turnos de ${settings.turnSeconds} s, uns ${minutes} min de jogo.`
              : 'Os turnos dependem de quantos jogadores entrarem.'}
          </p>
        </fieldset>

        <ActionError message={error} />
        <ActionBar>
          {seated && (
            <BigButton
              tone="plain"
              onClick={() => void handleLeave()}
              disabled={pending}
            >
              Sair da sala
            </BigButton>
          )}
          {!seated && (
            <BigButton
              wide
              onClick={() => void run(() => joinRoom({ data: { roomCode } }))}
              disabled={pending || room.players.length >= MAX_PLAYERS}
              testId="taboo-join"
            >
              Entrar na sala
            </BigButton>
          )}
          {seated && (
            <BigButton
              wide
              tone="good"
              onClick={() => void run(() => startGame({ data: { roomCode } }))}
              disabled={pending || !ready}
              testId="taboo-start"
            >
              Começar partida
            </BigButton>
          )}
        </ActionBar>
        {seated && !ready && (
          <p className="text-sm" data-testid="taboo-need-players">
            Cada time precisa de pelo menos {MIN_TEAM_SIZE} jogadores para
            começar: um fala, os outros adivinham.
          </p>
        )}
      </div>
    </div>
  )
}

interface TeamColumnProps {
  team: Team
  players: RoomView['players']
  online: number[]
  myPlayerId: number | null
  hostId: number | null
  canMoveHere: boolean
  isHost: boolean
  pending: boolean
  onJoinTeam: () => void
  onMove: (playerId: number) => void
  onRemove: (playerId: number, name: string) => void
}

const TeamColumn = ({
  team,
  players,
  online,
  myPlayerId,
  hostId,
  canMoveHere,
  isHost,
  pending,
  onJoinTeam,
  onMove,
  onRemove,
}: TeamColumnProps) => (
  <section
    className={`flex flex-col border-2 p-sm ${TEAM_CLASSES[team].border}`}
    data-testid={`taboo-team-${team}`}
  >
    <h2
      className={`-mx-sm -mt-sm mb-sm flex items-center justify-between px-sm py-xs text-md text-white wght-bold ${TEAM_CLASSES[team].bg}`}
    >
      {TEAM_NAMES[team]} <span className="text-sm">{players.length}</span>
    </h2>
    <ul className="mb-sm flex flex-1 flex-col gap-xs">
      {players.length === 0 && (
        <li className="text-sm text-accent">Ninguém ainda</li>
      )}
      {players.map((player) => (
        <li key={player.id} className="flex items-center gap-xs text-sm">
          <OnlineDot online={online.includes(player.id)} />
          <span className={player.id === myPlayerId ? 'wght-bold' : ''}>
            {player.name}
          </span>
          {player.id === hostId && (
            <span title="Anfitrião" aria-label="anfitrião">
              ★
            </span>
          )}
          {player.id === myPlayerId && (
            <span className="text-accent">(você)</span>
          )}
          {isHost && player.id !== myPlayerId && (
            <span className="ml-auto flex gap-xs">
              <button
                type="button"
                title={`Mudar ${player.name} de time`}
                className="border border-accent px-xs text-accent hover:bg-accent hover:text-background"
                disabled={pending}
                onClick={() => onMove(player.id)}
              >
                ⇄
              </button>
              <button
                type="button"
                title={`Tirar ${player.name} da sala`}
                className="border border-accent px-xs text-accent hover:bg-accent hover:text-background"
                disabled={pending}
                onClick={() => onRemove(player.id, player.name)}
              >
                ✕
              </button>
            </span>
          )}
        </li>
      ))}
    </ul>
    {canMoveHere && (
      <BigButton
        tone={team}
        onClick={onJoinTeam}
        disabled={pending}
        testId={`taboo-join-team-${team}`}
      >
        Ir pro {TEAM_NAMES[team]}
      </BigButton>
    )}
  </section>
)

const Segmented = <T extends number>({
  label,
  options,
  value,
  format,
  onChange,
  testId,
}: {
  label: string
  options: readonly T[]
  value: number
  format: (value: T) => string
  onChange: (value: T) => void
  testId: string
}) => (
  <div
    className="mb-sm"
    role="radiogroup"
    aria-label={label}
    data-testid={testId}
  >
    <p className="mb-xs text-sm">{label}</p>
    <div className="flex flex-wrap gap-xs">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          onClick={() => onChange(option)}
          className={
            'min-w-xl border-2 px-sm py-xs text-sm transition-colors wght-semibold disabled:cursor-default ' +
            (option === value
              ? 'border-accent bg-accent text-background'
              : 'border-accent-background hover:border-accent')
          }
        >
          {format(option)}
        </button>
      ))}
    </div>
  </div>
)

/** The room's code and link, with a copy button. */
const InviteBox = ({ roomCode }: { roomCode: string }) => {
  const [url, setUrl] = useState(`${TABOO_PATH}/${roomCode}`)
  const [copied, setCopied] = useState(false)
  useEffect(() => setUrl(window.location.href), [])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // The link is on screen to copy by hand.
    }
  }
  return (
    <div className="flex items-center gap-sm border-2 border-accent p-sm">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-accent">Sala</p>
        <p
          className="text-lg leading-none tracking-[0.2em] text-accent wght-bold"
          data-testid="taboo-room-code"
        >
          {roomCode}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        className="pressable border border-accent px-sm py-xs text-sm"
      >
        {copied ? 'Link copiado!' : 'Copiar link'}
      </button>
    </div>
  )
}

export default TabooLobby
