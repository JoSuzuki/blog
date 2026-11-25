import { createFileRoute } from '@tanstack/react-router'
import Footer from '~/components/footer/footer'
import Navbar from '~/components/navbar/navbar'
import TabooGame from '~/components/taboo/game'
import TabooLobby from '~/components/taboo/lobby'
import { LoginRequired, Reconnecting, Unavailable } from '~/components/taboo/ui'
import {
  useConnected,
  useLiveTaboo,
  useTabooRoom,
} from '~/components/taboo/use-taboo'
import { getRoom } from '~/lib/taboo/get-room'
import type { GetRoomResult } from '~/lib/taboo/get-room'
import type { RoomView } from '~/lib/taboo/room'

// One page for a room's whole life: the lobby, the game, the result. Which of
// them shows depends only on the room, so "the game started" is the loader
// running again, and a reload or a dropped connection lands right back here
// with the reader's seat (it belongs to their account, not to the tab).
export const Route = createFileRoute('/games/tabu/$roomCode')({
  loader: ({ params }) =>
    getRoom({ data: { roomCode: params.roomCode } }).catch(
      (): GetRoomResult => ({ ok: false, reason: 'unavailable' }),
    ),
  head: () => ({
    meta: [
      { title: 'Tabu | JoSuzuki' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: TabooRoomPage,
})

function TabooRoomPage() {
  const result = Route.useLoaderData()
  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-[72rem] pb-xl">
        <h1 className="mb-md max-tablet:sr-only">Tabu</h1>
        {result.ok ? (
          <Room room={result.room} />
        ) : result.reason === 'login' ? (
          <LoginRequired />
        ) : result.reason === 'not_found' ? (
          <Unavailable>
            Sala não encontrada: o código está errado, a sala foi fechada ou
            está cheia.
          </Unavailable>
        ) : (
          <Unavailable>Não foi possível carregar a sala agora.</Unavailable>
        )}
        <Footer />
      </main>
    </>
  )
}

function Room({ room: loaderRoom }: { room: RoomView }) {
  useLiveTaboo(loaderRoom.roomCode)
  const connected = useConnected()
  const { room, online, clockOffset } = useTabooRoom(loaderRoom)
  return (
    <>
      {!connected && <Reconnecting />}
      {room.status === 'WAITING' || !room.game ? (
        <TabooLobby room={room} online={online} />
      ) : (
        <TabooGame
          key={room.roomCode}
          room={room}
          game={room.game}
          online={online}
          clockOffset={clockOffset}
        />
      )}
    </>
  )
}
