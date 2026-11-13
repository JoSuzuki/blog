import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getSessionAction, loginAction, logoutAction } from './service.server'

// Login, current session and logout. Same-origin only, like every server
// function (CSRF middleware in src/start.ts). The validators only give callers
// types; the real validation runs in service.server.ts.

export type {
  LoginResult,
  LogoutResult,
  SessionState,
  SessionUser,
} from './types'

interface LoginInput {
  /** The ID token Google Identity Services passed to the sign-in callback. */
  credential: string
}

/**
 * Verifies the Google credential and sets the session cookie. Resolves to
 * `{ ok: true, user }`, or `{ ok: false, error }` with HTTP 401
 * (`unauthorized`), 429 (`rate_limited`) or 503 (`unavailable`).
 */
export const login = createServerFn({ method: 'POST' })
  .validator((data: LoginInput) => data)
  .handler(({ data }) => loginAction(data, getRequest()))

/**
 * The current session (`user: null` when logged out) and the Google client
 * id. The root route's loader calls it during the page request, so the page
 * is rendered for the right visitor from the first paint.
 */
export const getSession = createServerFn({ method: 'GET' }).handler(() =>
  getSessionAction(),
)

/** Clears the session cookie. Always `{ ok: true }`. */
export const logout = createServerFn({ method: 'POST' }).handler(() =>
  logoutAction(),
)
