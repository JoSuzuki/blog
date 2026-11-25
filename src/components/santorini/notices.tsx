import type { ReactNode } from 'react'
import {
  LoginRequired as GameLoginRequired,
  Unavailable as GameUnavailable,
} from '~/components/game-notices/game-notices'
import { ErrorMessage } from '~/components/notice/notice'

/** Shown instead of a Santorini page to a reader who is not logged in. */
export const LoginRequired = () => (
  <GameLoginRequired testId="santorini-login">
    Para jogar é preciso entrar na sua conta (Google ou email): é assim que a
    sala sabe quem é quem.
  </GameLoginRequired>
)

export const Unavailable = ({ children }: { children: ReactNode }) => (
  <GameUnavailable roomsHref="/games/santorini" testId="santorini-unavailable">
    {children}
  </GameUnavailable>
)

export const ActionError = ({ message }: { message: string | null }) => (
  <ErrorMessage message={message} testId="santorini-error" />
)
