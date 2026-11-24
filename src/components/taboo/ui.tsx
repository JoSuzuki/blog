import { ClientOnly } from '@tanstack/react-router'
import { Component, Suspense, lazy } from 'react'
import type { ReactNode } from 'react'
import CommonLink from '~/components/common-link/common-link'
import LoginButton from '~/components/login-button/login-button'
import type { Team } from '~/lib/taboo/game'
import { TABOO_PATH, TEAM_NAMES } from '~/lib/taboo/room'
import type { CardFace, PlayedCard, RoomPlayerView } from '~/lib/taboo/room'
import { TEAM_COLORS } from './card-art'
import type { TabooSceneProps } from './scene'

// Small pieces the Tabu pages share.

// three.js is large: the scene is its own chunk, fetched only on these pages
// and only in the browser.
const LazyScene = lazy(() => import('./scene'))

/** Shows the scene, or `fallback` while it loads and if WebGL fails. */
export const Scene = ({
  fallback,
  ...props
}: TabooSceneProps & { fallback: ReactNode }) => (
  <ClientOnly fallback={fallback}>
    <SceneBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LazyScene {...props} />
      </Suspense>
    </SceneBoundary>
  </ClientOnly>
)

class SceneBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error('The Tabu table could not be drawn:', error)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export const teamStyle = (team: Team) => ({
  '--team': TEAM_COLORS[team].light,
  '--team-dark': TEAM_COLORS[team].dark,
})

/** The team's name in its color. */
export const TeamName = ({ team }: { team: Team }) => (
  <span className="wght-bold" style={{ color: TEAM_COLORS[team].light }}>
    {TEAM_NAMES[team]}
  </span>
)

/** A big, colored game button. */
export const BigButton = ({
  children,
  onClick,
  disabled,
  tone = 'accent',
  hint,
  testId,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'accent' | 'good' | 'bad' | 'plain' | Team
  hint?: string
  testId?: string
}) => {
  const colors =
    tone === 'good'
      ? { bg: '#1FA971', shadow: '#0E6B45' }
      : tone === 'bad'
        ? { bg: '#E5383B', shadow: '#8E1518' }
        : tone === 'plain'
          ? { bg: 'transparent', shadow: 'var(--colors-accent)' }
          : tone === 'accent'
            ? { bg: 'var(--colors-accent)', shadow: 'var(--colors-dimmed)' }
            : { bg: TEAM_COLORS[tone].light, shadow: TEAM_COLORS[tone].ink }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className={
        'relative min-h-12 rounded-xl border-2 px-md py-sm text-md tracking-tight transition-transform select-none wght-bold ' +
        'hover:-translate-y-px active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ' +
        (tone === 'plain'
          ? 'border-accent text-text'
          : 'border-transparent text-white')
      }
      style={{
        background: colors.bg,
        boxShadow: `0 4px 0 0 ${colors.shadow}`,
      }}
    >
      {children}
      {hint && (
        <kbd className="ml-sm hidden rounded border border-current/40 px-1 text-xs opacity-70 tablet:inline">
          {hint}
        </kbd>
      )}
    </button>
  )
}

/** A dot that says whether a player has the room open. */
export const OnlineDot = ({ online }: { online: boolean }) => (
  <span
    title={online ? 'Na sala' : 'Fora da sala'}
    aria-label={online ? 'na sala' : 'fora da sala'}
    className="inline-block size-2.5 shrink-0 rounded-full"
    style={{
      background: online ? '#1FA971' : 'transparent',
      border: online ? 'none' : '2px solid currentColor',
      opacity: online ? 1 : 0.4,
    }}
  />
)

export const playerName = (players: RoomPlayerView[], id: number | null) =>
  players.find((p) => p.id === id)?.name ?? 'alguém'

/** The card as HTML: shown while the table loads, and where WebGL fails. */
export const CardHtml = ({
  card,
  team,
}: {
  card: CardFace | null
  team: Team
}) => (
  <div className="flex h-full items-center justify-center p-md">
    <div
      className="flex aspect-[5/7] h-full max-h-[26rem] flex-col overflow-hidden rounded-2xl bg-[#FBF7EF] p-sm text-[#1C1A2B] shadow-xl"
      data-testid="taboo-card-html"
    >
      {card ? (
        <>
          <div
            className="flex flex-[0_0_38%] flex-col items-center justify-center rounded-xl px-sm text-center text-white"
            style={{
              background: `linear-gradient(${TEAM_COLORS[team].light}, ${TEAM_COLORS[team].dark})`,
            }}
          >
            <span className="text-xs tracking-[0.3em] opacity-80">TABU</span>
            <span className="text-lg leading-tight break-words uppercase wght-bold">
              {card.word}
            </span>
          </div>
          <p
            className="mt-sm text-center text-xs tracking-[0.25em] wght-bold"
            style={{ color: TEAM_COLORS[team].dark }}
          >
            NÃO DIGA
          </p>
          <ul className="flex flex-1 flex-col justify-around text-center text-sm uppercase wght-semibold">
            {card.taboo.map((word) => (
              <li key={word}>{word}</li>
            ))}
          </ul>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B3AA6] to-[#2A1652] text-lg text-[#F6EAD3] wght-bold">
          TABU
        </div>
      )}
    </div>
  </div>
)

const OUTCOME_LABEL = {
  correct: { text: '+1', color: '#1FA971', name: 'acertou' },
  taboo: { text: '−1', color: '#E5383B', name: 'tabu' },
  skipped: { text: '0', color: '#8a8aa0', name: 'pulou' },
  timeout: { text: '⏱', color: '#8a8aa0', name: 'tempo' },
} as const

/** The cards of a turn as chips: word and what happened to it. */
export const PlayedCards = ({ cards }: { cards: PlayedCard[] }) =>
  cards.length === 0 ? null : (
    <ul className="flex flex-wrap gap-xs" data-testid="taboo-played">
      {cards.map(({ card, outcome }, index) => (
        <li
          key={`${card.id}-${index}`}
          title={`${card.word} (${OUTCOME_LABEL[outcome].name}): ${card.taboo.join(', ')}`}
          className="flex items-center gap-xs rounded-full border px-sm text-xs uppercase"
          style={{ borderColor: OUTCOME_LABEL[outcome].color }}
        >
          <span
            className="wght-bold"
            style={{ color: OUTCOME_LABEL[outcome].color }}
          >
            {OUTCOME_LABEL[outcome].text}
          </span>
          <span
            className={outcome === 'correct' ? 'wght-semibold' : 'opacity-70'}
          >
            {card.word}
          </span>
        </li>
      ))}
    </ul>
  )

/** Shown instead of a Tabu page to a reader who is not logged in. */
export const LoginRequired = () => (
  <div data-testid="taboo-login">
    <p className="mb-md">
      Para jogar é preciso entrar com a sua conta do Google: é assim que a sala
      sabe quem é quem (e te guarda o lugar se a conexão cair).
    </p>
    <LoginButton />
  </div>
)

export const Unavailable = ({ children }: { children: ReactNode }) => (
  <p data-testid="taboo-unavailable">
    {children} <CommonLink href={TABOO_PATH}>Ver as salas →</CommonLink>
  </p>
)

export const ActionError = ({ message }: { message: string | null }) =>
  message ? (
    <p role="alert" className="my-sm text-accent" data-testid="taboo-error">
      {message}
    </p>
  ) : null

/** A banner while the live connection is down. */
export const Reconnecting = () => (
  <div
    role="status"
    className="mb-sm flex items-center gap-sm rounded-lg border border-accent px-sm py-xs text-sm"
    data-testid="taboo-reconnecting"
  >
    <span className="inline-block size-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    Reconectando… seu lugar na sala está guardado.
  </div>
)
