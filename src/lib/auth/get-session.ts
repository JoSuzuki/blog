import { createServerFn } from '@tanstack/react-start'
import { findOrCreateUser } from './current-user.server'
import { getGoogleClientId } from './google.server'
import type { Role } from './roles'
import { readSession } from './session.server'
import type { SessionUser } from './session-user'

export interface SessionState {
  user: SessionUser | null
  /**
   * The reader's role, null for a visitor. Only for deciding what to show
   * (the Users tab, the quiz): it is as old as the page, and every server
   * function checks the role again itself.
   */
  role: Role | null
  /** The OAuth client id the Google sign-in button must use. */
  googleClientId: string
}

const ROLE_LOOKUP_TIMEOUT_MS = 2000

/**
 * The role of a logged-in reader. It is not in the cookie (a cookie would
 * keep a role for two weeks after it was taken away), so it is read from the
 * database. Every page waits for this, so a database that is down or slow
 * must not take the page with it: the reader then gets the lowest role.
 */
const readRole = async (session: SessionUser): Promise<Role> => {
  const lookup = findOrCreateUser(session)
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`timed out after ${ROLE_LOOKUP_TIMEOUT_MS} ms`)),
      ROLE_LOOKUP_TIMEOUT_MS,
    )
  })
  try {
    return (await Promise.race([lookup, timeout])).role
  } catch (error) {
    lookup.catch(() => {})
    console.error(
      '[auth] Could not read the role of a reader; treating them as USER:',
      error instanceof Error ? error.message : error,
    )
    return 'USER'
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The current session (`user: null` when logged out), the reader's role and
 * the Google client id. The root route's loader calls it during the page
 * request, so the page is rendered for the right visitor from the first
 * paint.
 */
export const getSession = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionState> => {
    const user = await readSession()
    return {
      user,
      role: user ? await readRole(user) : null,
      googleClientId: getGoogleClientId(),
    }
  },
)
