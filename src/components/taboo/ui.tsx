import { ClientOnly } from '@tanstack/react-router'
import { Children, Component, Suspense, lazy } from 'react'
import type { ReactNode } from 'react'
import CommonLink from '~/components/common-link/common-link'
import LoginButton from '~/components/login-button/login-button'
import type { Team } from '~/lib/taboo/game'
import { TABOO_PATH, TEAM_NAMES } from '~/lib/taboo/room'
import type { CardFace, PlayedCard, RoomPlayerView } from '~/lib/taboo/room'
import { INK, PAPER } from './card-art'
import type { TabooSceneProps } from './scene'
import { TEAM_CLASSES } from './theme'

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

/** The team's name in its color. */
export const TeamName = ({ team }: { team: Team }) => (
  <span className={`wght-bold ${TEAM_CLASSES[team].text}`}>
    {TEAM_NAMES[team]}
  </span>
)

const TONES = {
  accent: 'border-accent bg-accent text-background',
  good: 'border-success-dark bg-success text-white',
  bad: 'border-team-red-dark bg-team-red text-white',
  plain: 'border-accent bg-background text-text',
  0: 'border-team-blue-dark bg-team-blue text-white',
  1: 'border-team-red-dark bg-team-red text-white',
} as const

/**
 * A game button: the site's square, pressable button (an offset accent
 * shadow that lifts on hover), filled with a game color.
 */
export const BigButton = ({
  children,
  onClick,
  disabled,
  tone = 'accent',
  hint,
  testId,
  wide = false,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: keyof typeof TONES
  hint?: string
  testId?: string
  /** On phones, share the row with the other buttons, tall and easy to hit. */
  wide?: boolean
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    data-testid={testId}
    className={
      'pressable touch-manipulation border-2 px-md py-sm text-md tracking-tight select-none wght-bold ' +
      'disabled:cursor-not-allowed disabled:opacity-50 ' +
      (wide
        ? 'flex-1 py-md text-lg tablet:flex-none tablet:py-sm tablet:text-md '
        : '') +
      TONES[tone]
    }
  >
    {children}
    {hint && (
      <kbd className="ml-sm hidden border border-current px-xs text-xs wght-semibold tablet:inline">
        {hint}
      </kbd>
    )}
  </button>
)

/** A small square that says whether a player has the room open. */
export const OnlineDot = ({ online }: { online: boolean }) => (
  <span
    title={online ? 'Na sala' : 'Fora da sala'}
    aria-label={online ? 'na sala' : 'fora da sala'}
    className={
      'inline-block h-sm w-sm shrink-0 border ' +
      (online ? 'border-success-dark bg-success' : 'border-accent')
    }
  />
)

export const playerName = (players: RoomPlayerView[], id: number | null) =>
  players.find((p) => p.id === id)?.name ?? 'alguém'

/**
 * The card as HTML: shown while the table loads, and where WebGL fails. It
 * copies the 3D card, so it keeps the card's own paper and rounded corners.
 */
export const CardHtml = ({
  card,
  team,
}: {
  card: CardFace | null
  team: Team
}) => (
  <div className="flex h-full items-center justify-center p-md">
    <div
      className="flex aspect-[5/7] h-full max-h-[26rem] flex-col overflow-hidden rounded-xl p-sm"
      style={{ background: PAPER, color: INK }}
      data-testid="taboo-card-html"
    >
      {card ? (
        <>
          <div
            className={`flex flex-[0_0_38%] flex-col items-center justify-center rounded-lg px-sm text-center text-white ${TEAM_CLASSES[team].bg}`}
          >
            <span className="text-xs tracking-widest">TABU</span>
            <span className="text-lg leading-tight break-words uppercase wght-bold">
              {card.word}
            </span>
          </div>
          <p
            className={`mt-sm text-center text-xs tracking-widest wght-bold ${TEAM_CLASSES[team].text}`}
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
        <div className="flex flex-1 items-center justify-center rounded-lg bg-purple text-lg text-white wght-bold">
          TABU
        </div>
      )}
    </div>
  </div>
)

const OUTCOMES = {
  correct: {
    text: '+1',
    name: 'acertou',
    className: 'border-success text-success',
  },
  taboo: {
    text: '−1',
    name: 'tabu',
    className: 'border-team-red text-team-red',
  },
  skipped: { text: '0', name: 'pulou', className: 'border-accent text-accent' },
  timeout: { text: '⏱', name: 'tempo', className: 'border-accent text-accent' },
} as const

/** The cards of a turn as tags: what happened to it, and the word. */
export const PlayedCards = ({ cards }: { cards: PlayedCard[] }) =>
  cards.length === 0 ? null : (
    <ul
      className="flex flex-wrap justify-center gap-xs"
      data-testid="taboo-played"
    >
      {cards.map(({ card, outcome }, index) => (
        <li
          key={`${card.id}-${index}`}
          title={`${card.word} (${OUTCOMES[outcome].name}): ${card.taboo.join(', ')}`}
          className={`flex items-center gap-xs border px-xs text-xs uppercase ${OUTCOMES[outcome].className}`}
        >
          <span className="wght-bold">{OUTCOMES[outcome].text}</span>
          <span className="text-text">{card.word}</span>
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
    className="mb-sm flex items-center gap-sm border border-accent bg-accent-background px-sm py-xs text-sm"
    data-testid="taboo-reconnecting"
  >
    <span className="inline-block h-sm w-sm animate-spin bg-accent" />
    Reconectando… seu lugar na sala está guardado.
  </div>
)

/**
 * A page's main buttons. On a phone they sit in a bar fixed to the bottom of the
 * screen, big and side by side, where thumbs are; from tablets up they are
 * inline under the table. Nothing in it: nothing shows.
 */
export const ActionBar = ({ children }: { children: ReactNode }) => {
  const shown = Children.toArray(children).some(Boolean)
  if (!shown) return null
  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-20 flex gap-sm border-t border-accent bg-background px-sm pt-sm tablet:static tablet:z-auto tablet:justify-center tablet:border-0 tablet:bg-transparent tablet:p-0"
        style={{
          paddingBottom: 'max(var(--spaces-sm), env(safe-area-inset-bottom))',
        }}
        data-testid="taboo-action-bar"
      >
        {children}
      </div>
      {/* Room for the bar at the end of the page, on phones. */}
      <div className="h-xl pb-xl tablet:hidden" aria-hidden />
    </>
  )
}
