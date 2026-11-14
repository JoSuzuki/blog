import { useNavigate } from '@tanstack/react-router'
import Button from '~/components/button/button'
import { joinRoom } from '~/lib/santorini/join-room'
import { leaveRoom } from '~/lib/santorini/leave-room'
import { ROOM_SIZE } from '~/lib/santorini/room'
import type { RoomView } from '~/lib/santorini/room'
import { startGame } from '~/lib/santorini/start-game'
import { ActionError } from './notices'
import { useRoomAction } from './use-room-actions'

/** A room that is still waiting: who is in, and joining, leaving, starting. */
const SantoriniLobby = ({ room }: { room: RoomView }) => {
  const navigate = useNavigate()
  const { run, pending, error } = useRoomAction()
  const { roomCode } = room
  const seated = room.myPlayerId !== null
  const full = room.players.length === ROOM_SIZE

  const handleLeave = async () => {
    const result = await run(() => leaveRoom({ data: { roomCode } }))
    if (result?.ok) await navigate({ to: '/games/santorini' })
  }

  return (
    <div data-testid="santorini-lobby">
      <p className="mb-md">
        Sala <strong className="text-accent wght-bold">{roomCode}</strong>.{' '}
        {full
          ? 'Os dois jogadores estão na sala.'
          : 'Esperando o segundo jogador: mande o endereço desta página para quem vai jogar com você.'}
      </p>
      <h2 className="mb-sm">Jogadores</h2>
      <ol className="mb-md" data-testid="santorini-players">
        {room.players.map((player) => (
          <li key={player.id}>
            {player.name}
            {player.id === room.myPlayerId && ' (você)'}
          </li>
        ))}
      </ol>
      <ActionError message={error} />
      <div className="flex flex-wrap gap-md">
        {!seated && (
          <Button
            type="button"
            disabled={pending}
            onClick={() => void run(() => joinRoom({ data: { roomCode } }))}
          >
            Entrar na sala
          </Button>
        )}
        {seated && full && (
          <Button
            type="button"
            disabled={pending}
            onClick={() => void run(() => startGame({ data: { roomCode } }))}
          >
            Iniciar
          </Button>
        )}
        {seated && (
          <Button
            type="button"
            disabled={pending}
            onClick={() => void handleLeave()}
          >
            Sair da sala
          </Button>
        )}
      </div>
    </div>
  )
}

export default SantoriniLobby
