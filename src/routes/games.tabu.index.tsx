import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import Article from '~/components/article/article'
import {
  ActionError,
  BigButton,
  LoginRequired,
  Unavailable,
} from '~/components/taboo/ui'
import { useLiveTaboo, useRoomAction } from '~/components/taboo/use-taboo'
import { MAX_PLAYERS } from '~/lib/taboo/game'
import Footer from '~/components/footer/footer'
import Navbar from '~/components/navbar/navbar'
import { createRoom } from '~/lib/taboo/create-room'
import { getRooms } from '~/lib/taboo/get-rooms'
import type { GetRoomsResult } from '~/lib/taboo/get-rooms'
import { joinRoom } from '~/lib/taboo/join-room'

export const Route = createFileRoute('/games/tabu/')({
  loader: async () => {
    const result = await getRooms().catch((): GetRoomsResult => ({
      ok: false,
      reason: 'unavailable',
    }))
    // A reader with an unfinished room goes straight back to it.
    if (result.ok && result.activeRoomCode) {
      throw redirect({
        to: '/games/tabu/$roomCode',
        params: { roomCode: result.activeRoomCode },
      })
    }
    return result
  },
  head: () => ({ meta: [{ title: 'Tabu | JoSuzuki' }] }),
  component: TabooRooms,
})

function TabooRooms() {
  const result = Route.useLoaderData()
  return (
    <>
      <Navbar />
      <Article>
        <h1>Tabu</h1>
        <p className="mb-md">
          Dois times. Na sua vez, faça seu time adivinhar o máximo de palavras
          em um minuto, sem dizer as cinco palavras proibidas de cada carta. O
          outro time está de olho e aperta <strong>Tabu!</strong> quando você
          escorrega. Melhor com todo mundo junto ou numa chamada de vídeo, cada
          um no seu celular.
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
  useLiveTaboo('lobby')
  const navigate = useNavigate()
  const { run, pending, error } = useRoomAction()

  const enter = (roomCode: string) =>
    navigate({ to: '/games/tabu/$roomCode', params: { roomCode } })

  const handleCreate = async () => {
    const result = await run(() => createRoom())
    if (result?.ok) await enter(result.roomCode)
  }
  const handleJoin = async (roomCode: string) => {
    const result = await run(() => joinRoom({ data: { roomCode } }))
    if (result?.ok) await enter(roomCode)
  }

  return (
    <div data-testid="taboo-rooms">
      <BigButton
        tone="good"
        onClick={() => void handleCreate()}
        disabled={pending}
        testId="taboo-create"
      >
        Criar nova sala
      </BigButton>
      <ActionError message={error} />
      <h2 className="mt-lg mb-sm">Salas abertas ({rooms.length})</h2>
      {rooms.length === 0 ? (
        <p>Nenhuma sala aberta. Crie a primeira e mande o link pros amigos.</p>
      ) : (
        <ul>
          {rooms.map((room) => (
            <li
              key={room.roomCode}
              className="mb-sm flex flex-wrap items-center gap-md"
            >
              <span className="tracking-[0.15em] text-accent wght-bold">
                {room.roomCode}
              </span>
              <span>
                de {room.hostName} · {room.playerCount}/{MAX_PLAYERS}
                {room.status === 'PLAYING' && ' · em jogo'}
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => void handleJoin(room.roomCode)}
                className="pressable border border-accent px-sm py-xs text-accent"
              >
                Entrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
