import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import Article from '~/components/article/article'
import Button from '~/components/button/button'
import Footer from '~/components/footer/footer'
import Navbar from '~/components/navbar/navbar'
import {
  ActionError,
  LoginRequired,
  Unavailable,
} from '~/components/santorini/notices'
import {
  useLiveSantorini,
  useRoomAction,
} from '~/components/santorini/use-room-actions'
import { createRoom } from '~/lib/santorini/create-room'
import { getRooms } from '~/lib/santorini/get-rooms'
import type { GetRoomsResult } from '~/lib/santorini/get-rooms'
import { joinRoom } from '~/lib/santorini/join-room'
import { ROOM_SIZE } from '~/lib/santorini/room'

export const Route = createFileRoute('/games/santorini/')({
  loader: async () => {
    const result = await getRooms().catch((): GetRoomsResult => ({
      ok: false,
      reason: 'unavailable',
    }))
    // A reader with an unfinished room goes straight back to it.
    if (result.ok && result.activeRoomCode) {
      throw redirect({
        to: '/games/santorini/$roomCode',
        params: { roomCode: result.activeRoomCode },
      })
    }
    return result
  },
  head: () => ({ meta: [{ title: 'Santorini | JoSuzuki' }] }),
  component: SantoriniRooms,
})

function SantoriniRooms() {
  const result = Route.useLoaderData()
  return (
    <>
      <Navbar />
      <Article>
        <h1>Santorini</h1>
        <p className="mb-md">
          Cada jogador tem dois trabalhadores. Na sua vez, mova um deles para
          uma casa vizinha (subindo no máximo um andar) e depois construa um
          andar ao lado dele. Vence quem subir primeiro ao terceiro andar, ou
          quem deixar o adversário sem movimentos.
        </p>
        {result.ok ? (
          <Rooms rooms={result.rooms} />
        ) : result.reason === 'login' ? (
          <LoginRequired />
        ) : (
          <Unavailable>Não foi possível carregar as salas agora.</Unavailable>
        )}
        <Footer />
      </Article>
    </>
  )
}

type RoomsProps = Pick<Extract<GetRoomsResult, { ok: true }>, 'rooms'>

function Rooms({ rooms }: RoomsProps) {
  useLiveSantorini('lobby')
  const navigate = useNavigate()
  const { run, pending, error } = useRoomAction()

  const enter = (roomCode: string) =>
    navigate({ to: '/games/santorini/$roomCode', params: { roomCode } })

  const handleCreate = async () => {
    const result = await run(() => createRoom())
    if (result?.ok) await enter(result.roomCode)
  }
  const handleJoin = async (roomCode: string) => {
    const result = await run(() => joinRoom({ data: { roomCode } }))
    if (result?.ok) await enter(roomCode)
  }

  return (
    <div data-testid="santorini-rooms">
      <Button
        type="button"
        disabled={pending}
        onClick={() => void handleCreate()}
      >
        Criar nova sala
      </Button>
      <ActionError message={error} />
      <h2 className="mt-lg mb-sm">Salas disponíveis ({rooms.length})</h2>
      {rooms.length === 0 ? (
        <p>Nenhuma sala esperando jogadores. Crie a primeira.</p>
      ) : (
        <ul>
          {rooms.map((room) => (
            <li
              key={room.roomCode}
              className="mb-sm flex flex-wrap items-center gap-md"
            >
              <span className="text-accent wght-bold">{room.roomCode}</span>
              <span>
                de {room.hostName} - {room.playerCount}/{ROOM_SIZE}
              </span>
              <Button
                type="button"
                disabled={pending}
                onClick={() => void handleJoin(room.roomCode)}
              >
                Entrar
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
