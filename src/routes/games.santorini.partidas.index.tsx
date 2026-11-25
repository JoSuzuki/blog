import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { z } from 'zod'
import Article from '~/components/article/article'
import Footer from '~/components/footer/footer'
import Navbar from '~/components/navbar/navbar'
import { formatDateTime } from '~/components/santorini/format'
import { Unavailable } from '~/components/santorini/notices'
import SantoriniTabs from '~/components/santorini/tabs'
import { useLiveSantorini } from '~/components/santorini/use-room-actions'
import { getGames } from '~/lib/santorini/get-games'
import type { GetGamesResult } from '~/lib/santorini/get-games'
import { ROOM_CODE_PATTERN } from '~/lib/santorini/room'
import type { GameSummary } from '~/lib/santorini/room'

const searchSchema = z.object({
  codigo: z
    .string()
    .transform((code) => code.trim().toUpperCase())
    .pipe(z.string().regex(ROOM_CODE_PATTERN))
    .optional()
    .catch(undefined),
  minhas: z.boolean().optional().catch(undefined),
  antes: z.number().int().positive().optional().catch(undefined),
})

type Search = z.infer<typeof searchSchema>

// Every Santorini game, for anyone: the ones being played now (to watch) and
// the finished ones (to review), newest first, found by code if you have it.
export const Route = createFileRoute('/games/santorini/partidas/')({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    getGames({
      data: { code: deps.codigo, mine: deps.minhas, before: deps.antes },
    }).catch((): GetGamesResult => ({ ok: false, reason: 'unavailable' })),
  head: () => ({ meta: [{ title: 'Partidas de Santorini | JoSuzuki' }] }),
  component: SantoriniGames,
})

function SantoriniGames() {
  const result = Route.useLoaderData()
  const search = Route.useSearch()
  return (
    <>
      <Navbar />
      <Article>
        <h1>Santorini</h1>
        <SantoriniTabs current="partidas" />
        <SearchForm search={search} loggedIn={result.ok && result.loggedIn} />
        {result.ok ? (
          <Games result={result} search={search} />
        ) : (
          <Unavailable>
            Não foi possível carregar as partidas agora.
          </Unavailable>
        )}
        <Footer />
      </Article>
    </>
  )
}

function SearchForm({
  search,
  loggedIn,
}: {
  search: Search
  loggedIn: boolean
}) {
  const navigate = useNavigate({ from: Route.fullPath })
  const [code, setCode] = useState(search.codigo ?? '')
  const [invalid, setInvalid] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const value = code.trim().toUpperCase()
    if (value && !ROOM_CODE_PATTERN.test(value)) return setInvalid(true)
    setInvalid(false)
    void navigate({
      search: (prev) => ({
        ...prev,
        codigo: value || undefined,
        antes: undefined,
      }),
    })
  }

  const chip = (active: boolean) =>
    active
      ? 'border border-accent bg-accent px-sm py-xs text-sm text-background'
      : 'pressable border border-accent px-sm py-xs text-sm text-accent'

  return (
    <div className="mb-md">
      <form
        onSubmit={submit}
        className="flex items-stretch gap-sm"
        role="search"
      >
        <label htmlFor="santorini-code" className="sr-only">
          Código da sala
        </label>
        <input
          id="santorini-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Código da sala"
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="w-0 min-w-0 flex-1 border border-accent bg-transparent px-sm py-xs uppercase placeholder:normal-case"
        />
        <button
          type="submit"
          className="pressable border border-accent px-sm py-xs text-accent"
        >
          Buscar
        </button>
      </form>
      {invalid && (
        <p role="alert" className="mt-xs text-sm text-accent">
          O código tem 6 letras ou números.
        </p>
      )}
      <div className="mt-sm flex flex-wrap gap-sm">
        <Link
          from={Route.fullPath}
          search={(prev) => ({ ...prev, minhas: undefined, antes: undefined })}
          className={chip(!search.minhas)}
        >
          Todas
        </Link>
        {loggedIn && (
          <Link
            from={Route.fullPath}
            search={(prev) => ({ ...prev, minhas: true, antes: undefined })}
            className={chip(!!search.minhas)}
          >
            Só as minhas
          </Link>
        )}
        {search.codigo && (
          <Link
            from={Route.fullPath}
            search={(prev) => ({
              ...prev,
              codigo: undefined,
              antes: undefined,
            })}
            onClick={() => setCode('')}
            className={chip(false)}
          >
            {search.codigo} ✕
          </Link>
        )}
      </div>
    </div>
  )
}

function Games({
  result,
  search,
}: {
  result: Extract<GetGamesResult, { ok: true }>
  search: Search
}) {
  // A game starting or ending changes the lists.
  useLiveSantorini('lobby')
  const { live, finished, nextBefore } = result
  const filtered = !!(search.codigo || search.minhas)

  return (
    <div data-testid="santorini-games">
      {live.length > 0 && (
        <section className="mb-lg">
          <h2 className="mb-sm">Ao vivo ({live.length})</h2>
          <GameList games={live} />
        </section>
      )}
      <section>
        <h2 className="mb-sm">Encerradas</h2>
        {finished.length === 0 ? (
          <p>
            {search.antes
              ? 'Não há partidas mais antigas.'
              : filtered
                ? 'Nenhuma partida encerrada com esse filtro.'
                : 'Nenhuma partida terminou ainda.'}
          </p>
        ) : (
          <GameList games={finished} />
        )}
      </section>
      <div className="mt-md flex flex-wrap gap-md">
        {search.antes && (
          <Link
            from={Route.fullPath}
            search={(prev) => ({ ...prev, antes: undefined })}
            className="text-secondary underline"
          >
            ← Mais recentes
          </Link>
        )}
        {nextBefore && (
          <Link
            from={Route.fullPath}
            search={(prev) => ({ ...prev, antes: nextBefore })}
            className="text-secondary underline"
          >
            Mais antigas →
          </Link>
        )}
      </div>
    </div>
  )
}

function GameList({ games }: { games: GameSummary[] }) {
  return (
    <ul className="flex flex-col gap-sm">
      {games.map((game) => (
        <li key={game.id}>
          <Link
            to="/games/santorini/partidas/$gameId"
            params={{ gameId: String(game.id) }}
            className="pressable block border border-accent px-sm py-xs text-text no-underline"
            data-testid="santorini-game-link"
          >
            <span className="flex items-baseline justify-between gap-sm">
              <span className="text-accent wght-bold">{game.roomCode}</span>
              {game.status === 'PLAYING' ? (
                <span className="border border-team-red-ink px-xs text-xs text-team-red-ink wght-bold">
                  AO VIVO
                </span>
              ) : (
                <span className="text-xs">
                  {formatDateTime(game.updatedAt)}
                </span>
              )}
            </span>
            <span className="mt-xs block">
              {game.players.map((player, i) => (
                <span key={i}>
                  {i > 0 && ' × '}
                  <span className={player.winner ? 'wght-bold' : undefined}>
                    {player.name}
                    {player.winner && ' ★'}
                  </span>
                </span>
              ))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
