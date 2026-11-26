import { getRequest, setResponseStatus } from '@tanstack/react-start/server'
import { takeRateLimit } from '~/lib/rate-limit.server'
import { describePasswordProblem, getSessionPassword } from './session.server'
import type { SessionUser } from './session-user'

// What the email and password actions share: the checks every one of them
// starts with, and the session a password account gets.

/**
 * Rate limit (per client address, per action) and, for the actions that log
 * in, a usable session secret. Returns the failure to answer with, having set
 * the response status, or null to carry on.
 */
export const checkAccountRequest = (
  action: string,
  { limit, windowMs }: { limit: number; windowMs: number },
  { needsSession = true } = {},
): 'rate_limited' | 'unavailable' | null => {
  const limited = takeRateLimit(action, getRequest(), { limit, windowMs })
  if (!limited.allowed) {
    setResponseStatus(429)
    return 'rate_limited'
  }
  if (needsSession) {
    const password = getSessionPassword()
    if (!password.ok) {
      console.error(
        `[auth] ${action} refused: ${describePasswordProblem(password.problem)}, ` +
          'so no session can be issued.',
      )
      setResponseStatus(503)
      return 'unavailable'
    }
  }
  return null
}

/** The session of a reader who logged in with a password. */
export const sessionUserFor = (row: {
  name: string
  email: string
  googleId: string | null
}): SessionUser => ({
  name: row.name,
  email: row.email,
  firstName: row.name.split(/\s+/)[0] || row.name,
  ...(row.googleId ? { googleId: row.googleId } : {}),
})

/**
 * Whether someone has proved they own the row's email. Rows from before
 * `emailVerifiedAt` existed, and rows created from a Google session, have a
 * Google id instead.
 */
export const isVerified = (row: {
  emailVerifiedAt: Date | null
  googleId: string | null
}) => row.emailVerifiedAt !== null || row.googleId !== null
