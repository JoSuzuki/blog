import { createServerFn } from '@tanstack/react-start'
import { getGoogleClientId } from './google.server'
import { readSession } from './session.server'
import type { SessionUser } from './session-user'

export interface SessionState {
  user: SessionUser | null
  /** The OAuth client id the Google sign-in button must use. */
  googleClientId: string
}

/**
 * The current session (`user: null` when logged out) and the Google client
 * id. The root route's loader calls it during the page request, so the page
 * is rendered for the right visitor from the first paint.
 */
export const getSession = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionState> => ({
    user: await readSession(),
    googleClientId: getGoogleClientId(),
  }),
)
