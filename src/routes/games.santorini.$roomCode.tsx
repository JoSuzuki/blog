import { createFileRoute, redirect } from '@tanstack/react-router'
import Article from '~/components/article/article'
import Footer from '~/components/footer/footer'
import Navbar from '~/components/navbar/navbar'
import SantoriniGame from '~/components/santorini/game'
import SantoriniLobby from '~/components/santorini/lobby'
import { LoginRequired, Unavailable } from '~/components/santorini/notices'
import { useLiveSantorini } from '~/components/santorini/use-room-actions'
import { getRoom } from '~/lib/santorini/get-room'
import type { GetRoomResult } from '~/lib/santorini/get-room'
import type { RoomView } from '~/lib/santorini/room'

// One page for a room's whole life: waiting for players, the game, the
// result. Which of them shows depends only on the room the loader returns,
// so "the game started" or "the other player moved" is just the loader
// running again.
export const Route = createFileRoute('/games/santorini/$roomCode')({
  loader: async ({ params }) => {
    const result = await getRoom({ data: { roomCode: params.roomCode } }).catch(
      (): GetRoomResult => ({ ok: false, reason: 'unavailable' }),
    )
    // Someone else's game, or a finished one: its page shows it to anyone.
    if (!result.ok && result.reason === 'watch') {
      throw redirect({
        to: '/games/santorini/partidas/$gameId',
        params: { gameId: String(result.gameId) },
      })
    }
    return result
  },
  head: () => ({
    meta: [
      { title: 'Santorini | JoSuzuki' },
      // A room is between its two players.
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: SantoriniRoom,
})

function SantoriniRoom() {
  const result = Route.useLoaderData()
  return (
    <>
      <Navbar />
      <Article>
        <h1>Santorini</h1>
        {result.ok ? (
          <Room room={result.room} />
        ) : result.reason === 'login' ? (
          <LoginRequired />
        ) : result.reason === 'not_found' ? (
          <Unavailable>
            Sala não encontrada: o código está errado ou a sala foi fechada
            antes de a partida começar.
          </Unavailable>
        ) : (
          <Unavailable>Não foi possível carregar a sala agora.</Unavailable>
        )}
        <Footer />
      </Article>
    </>
  )
}

function Room({ room }: { room: RoomView }) {
  useLiveSantorini(room.roomCode)
  if (room.status === 'WAITING' || !room.gameState) {
    return <SantoriniLobby room={room} />
  }
  // The loader only shows a started game to its two players.
  if (room.myPlayerId === null) return null
  return (
    <SantoriniGame
      key={room.roomCode}
      room={room}
      gameState={room.gameState}
      playerId={room.myPlayerId}
    />
  )
}
