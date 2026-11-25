import { createServerFn } from '@tanstack/react-start'
import { findOrCreateUser } from './current-user.server'
import { getGoogleClientId } from './google.server'
import type { Role } from './roles'
import { clearSession, readSession } from './session.server'
import type { SessionUser } from './session-user'

export interface SessionState {
  user: SessionUser | null
  /**
   * The reader's role, null for a visitor. Only for deciding what to show
   * (the Users tab, the quiz): it is as old as the page, and every server
   * function checks the role again itself.
   */
  role: Role | null
  /**
   * What the site calls the reader (nickname, or first name), null for a
   * visitor. From the database, so a change on /perfil shows after a reload.
   */
  displayName: string | null
  /** The OAuth client id the Google sign-in button must use. */
  googleClientId: string
}

const ROLE_LOOKUP_TIMEOUT_MS = 2000

/**
 * The role and display name of a logged-in reader. They are not in the
 * cookie (a cookie would keep a role for two weeks after it was taken
 * away), so they are read from the database. Every page waits for this, so
 * a database that is down or slow must not take the page with it: the
 * reader then gets the lowest role and the name in the cookie. `null` when
 * the account no longer exists.
 */
const readAccount = async (
  session: SessionUser,
): Promise<{ role: Role; displayName: string } | null> => {
  const lookup = findOrCreateUser(session)
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`timed out after ${ROLE_LOOKUP_TIMEOUT_MS} ms`)),
      ROLE_LOOKUP_TIMEOUT_MS,
    )
  })
  try {
    const user = await Promise.race([lookup, timeout])
    return user && { role: user.role, displayName: user.displayName }
  } catch (error) {
    lookup.catch(() => {})
    console.error(
      '[auth] Could not read the role of a reader; treating them as USER:',
      error instanceof Error ? error.message : error,
    )
    return { role: 'USER', displayName: session.firstName }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The current session (`user: null` when logged out), the reader's role and
 * display name, and the Google client id. The root route's loader calls it during the page
 * request, so the page is rendered for the right visitor from the first
 * paint.
 */
export const getSession = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionState> => {
    const session = await readSession()
    const account = session ? await readAccount(session) : null
    // A session whose account was deleted ends here.
    if (session && !account) clearSession()
    return {
      user: account ? session : null,
      role: account?.role ?? null,
      displayName: account?.displayName ?? null,
      googleClientId: getGoogleClientId(),
    }
  },
)
