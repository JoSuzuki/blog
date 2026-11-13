import {
  getRequestHeader,
  setCookie,
  setResponseHeader,
} from '@tanstack/react-start/server'
import {
  SESSION_COOKIE_NAME,
  getSessionCookieValue,
  getSessionPassword,
  sealSession,
  sessionCookieAttributes,
  unsealSession,
} from './session-cookie.server'
import type { SessionUser } from './types'

// The session as server functions and loaders see it: bound to the current
// request (TanStack Start's request context). Reading is a cookie parse and an
// unseal (no database). The cookie format and attributes live in
// session-cookie.server.ts, which also has the context-free
// readSessionFromCookieHeader for the socket.io handshake; it is re-exported
// here so callers have one module to import.

export {
  SESSION_COOKIE_NAME,
  readSessionFromCookieHeader,
  reportSessionConfig,
} from './session-cookie.server'

/**
 * The current request's session, or null. A session cookie that is present
 * but cannot be unsealed (tampered, expired, sealed with another secret) is
 * treated as no session and removed from the browser, so it is not sent and
 * rejected again on every request. With no usable secret nothing is removed:
 * the cookie may well be valid once the secret is configured.
 *
 * A response that carries a session is marked `private, no-store`, since the
 * page then contains the visitor's name.
 */
export const getSession = async (): Promise<SessionUser | null> => {
  const seal = getSessionCookieValue(getRequestHeader('cookie'))
  if (!seal) return null
  const user = await unsealSession(seal)
  if (user) {
    setResponseHeader('Cache-Control', 'private, no-store')
  } else if (getSessionPassword().ok) {
    clearSession()
  }
  return user
}

/** Seals `user` into the session cookie on the current response. */
export const setSession = async (user: SessionUser): Promise<void> => {
  setCookie(SESSION_COOKIE_NAME, await sealSession(user), {
    ...sessionCookieAttributes(),
  })
  setResponseHeader('Cache-Control', 'private, no-store')
}

/** Removes the session cookie (same attributes, empty value, Max-Age=0). */
export const clearSession = (): void => {
  setCookie(SESSION_COOKIE_NAME, '', {
    ...sessionCookieAttributes(0),
    expires: new Date(0),
  })
}
