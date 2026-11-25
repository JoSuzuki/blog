import type { ReactNode } from 'react'
import CommonLink from '~/components/common-link/common-link'
import LoginButton from '~/components/login-button/login-button'

// What a game's page shows instead of the game, shared by every game.

/** For a reader who is not logged in: why, and the Login button. */
export const LoginRequired = ({
  children,
  testId,
}: {
  /** Why this game needs an account. */
  children: ReactNode
  testId?: string
}) => (
  <div data-testid={testId}>
    <p className="mb-md">{children}</p>
    <LoginButton />
  </div>
)

/** The room or game cannot be shown: why, and a link back to the rooms. */
export const Unavailable = ({
  children,
  roomsHref,
  testId,
}: {
  children: ReactNode
  roomsHref: string
  testId?: string
}) => (
  <p data-testid={testId}>
    {children} <CommonLink href={roomsHref}>Ver as salas →</CommonLink>
  </p>
)
