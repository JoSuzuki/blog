import type { ReactNode } from 'react'
import CommonLink from '~/components/common-link/common-link'
import LoginButton from '~/components/login-button/login-button'

/** Shown instead of a Santorini page to a reader who is not logged in. */
export const LoginRequired = () => (
  <div data-testid="santorini-login">
    <p className="mb-md">
      Para jogar é preciso entrar com a sua conta do Google: é assim que a sala
      sabe quem é quem.
    </p>
    <LoginButton />
  </div>
)

export const Unavailable = ({ children }: { children: ReactNode }) => (
  <p data-testid="santorini-unavailable">
    {children} <CommonLink href="/games/santorini">Ver as salas →</CommonLink>
  </p>
)

export const ActionError = ({ message }: { message: string | null }) =>
  message ? (
    <p role="alert" className="my-sm text-accent" data-testid="santorini-error">
      {message}
    </p>
  ) : null
