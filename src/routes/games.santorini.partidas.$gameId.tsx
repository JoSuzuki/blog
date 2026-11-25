import { createFileRoute, redirect } from '@tanstack/react-router'
import Article from '~/components/article/article'
import CommonLink from '~/components/common-link/common-link'
import Footer from '~/components/footer/footer'
import Navbar from '~/components/navbar/navbar'
import { formatDateTime } from '~/components/santorini/format'
import SantoriniReplay from '~/components/santorini/replay'
import SantoriniSpectate from '~/components/santorini/spectate'
import { useLiveSantorini } from '~/components/santorini/use-room-actions'
import { getGame } from '~/lib/santorini/get-game'
import type { GetGameResult } from '~/lib/santorini/get-game'
import { endReasonOf } from '~/lib/santorini/replay'
import type { GameView } from '~/lib/santorini/room'

// One game by its permanent id, for anyone: watched live while it is played,
// reviewed move by move once it is over. Its players play it on the room
// page, so the loader sends them there until it ends.
export const Route = createFileRoute('/games/santorini/partidas/$gameId')({
  loader: async ({ params }) => {
    const result = await getGame({ data: { gameId: params.gameId } }).catch(
      (): GetGameResult => ({ ok: false, reason: 'unavailable' }),
    )
    if (!result.ok && result.reason === 'play') {
      throw redirect({
        to: '/games/santorini/$roomCode',
        params: { roomCode: result.roomCode },
      })
    }
    return result
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.ok
          ? `Santorini: ${loaderData.game.players.map((p) => p.name).join(' × ')} | JoSuzuki`
          : 'Santorini | JoSuzuki',
      },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: SantoriniGamePage,
})

function SantoriniGamePage() {
  const result = Route.useLoaderData()
  return (
    <>
      <Navbar />
      <Article>
        <h1>Santorini</h1>
        {result.ok ? (
          <Game game={result.game} />
        ) : (
          <p data-testid="santorini-unavailable">
            {result.reason === 'not_found'
              ? 'Partida não encontrada.'
              : 'Não foi possível carregar a partida agora.'}{' '}
            <CommonLink href="/games/santorini/partidas">
              Ver as partidas →
            </CommonLink>
          </p>
        )}
        <Footer />
      </Article>
    </>
  )
}

/** How the game ended, from the viewer's side when they played it. */
const resultLine = (game: GameView): string | null => {
  if (game.status !== 'FINISHED' || !game.gameState) return null
  const winner = game.players.find((p) => p.winner)
  const loser = game.players.find((p) => !p.winner)
  if (!winner || !loser) return 'Fim de jogo.'
  const me = game.myPlayerId
  const who = (p: { id: number; name: string }) =>
    p.id === me ? 'Você' : p.name
  switch (endReasonOf(game.gameState)) {
    case 'climbed':
      return `${who(winner)} venceu subindo ao 3º andar.`
    case 'blocked':
      return `${who(loser)} ficou sem movimentos: ${winner.id === me ? 'você venceu' : `${winner.name} venceu`}.`
    case 'resigned':
      return `${who(loser)} desistiu: ${winner.id === me ? 'você venceu' : `${winner.name} venceu`}.`
  }
}

/**
 * Listens to the room's channel while the game is not over: a change (the
 * game starting) reloads the page, and the moves of a live game arrive on it.
 */
const LiveChannel = ({ roomCode }: { roomCode: string }) => {
  useLiveSantorini(roomCode)
  return null
}

function Game({ game }: { game: GameView }) {
  const names = game.players.map((p) => p.name).join(' × ')
  const result = resultLine(game)

  return (
    <div data-testid="santorini-game-page">
      {game.status !== 'FINISHED' && <LiveChannel roomCode={game.roomCode} />}
      <header className="mb-md">
        <h2 className="mb-xs">{names || 'Sala vazia'}</h2>
        <p className="text-xs">
          Sala <span className="text-accent wght-bold">{game.roomCode}</span> ·
          partida nº {game.id} ·{' '}
          {formatDateTime(
            game.status === 'FINISHED' ? game.updatedAt : game.createdAt,
          )}
        </p>
        {result && (
          <p className="mt-sm wght-semibold" data-testid="santorini-result">
            {result}
          </p>
        )}
      </header>

      {game.status === 'WAITING' || !game.gameState ? (
        <p>
          A partida ainda não começou. Esta página mostra o jogo assim que ele
          começar.
        </p>
      ) : game.status === 'PLAYING' ? (
        <SantoriniSpectate game={{ ...game, gameState: game.gameState }} />
      ) : (
        <SantoriniReplay
          gameState={game.gameState}
          players={game.players}
          redPlayerId={game.myPlayerId ?? game.players[0]?.id ?? 0}
        />
      )}

      <p className="mt-md">
        <CommonLink href="/games/santorini/partidas">
          ← Todas as partidas
        </CommonLink>
      </p>
    </div>
  )
}
