import { setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'
import { prisma } from '~/lib/db.server'
import {
  createRateLimiter,
  getClientKey,
} from '~/lib/comments/rate-limit.server'
import { getGoogleClientId, getGoogleVerifier } from './google.server'
import type { GoogleIdentity, GoogleTokenVerifier } from './google.server'
import { clearSession, getSession, setSession } from './session.server'
import {
  describePasswordProblem,
  getSessionPassword,
} from './session-cookie.server'
import type { LoginResult, LogoutResult, SessionState } from './types'

// The logic behind the auth server functions in functions.ts, which only
// forward to these.

const loginInputSchema = z.object({
  // A Google ID token is a JWT of roughly 1 to 2 KB.
  credential: z.string().min(1).max(8192),
})

/** Per client address: 20 attempts per 10 minutes. */
const loginLimiter = createRateLimiter({
  limit: 20,
  windowMs: 10 * 60 * 1000,
  maxKeys: 5000,
})

const USER_UPSERT_TIMEOUT_MS = 5000

/**
 * Records the user as the legacy /api/login did: create a row on first login
 * (matched by email), leave an existing one alone.
 *
 * Best effort. The session does not depend on the row (nothing reads it yet),
 * so if the database is down or slow, login still succeeds with just the
 * cookie and the failure is logged; the row is created on a later login.
 */
const recordUser = async (identity: GoogleIdentity) => {
  const upsert = prisma.user.upsert({
    where: { email: identity.email },
    update: {},
    create: {
      email: identity.email,
      name: identity.name,
      googleId: identity.googleId,
    },
  })
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`timed out after ${USER_UPSERT_TIMEOUT_MS} ms`)),
      USER_UPSERT_TIMEOUT_MS,
    )
  })
  try {
    await Promise.race([upsert, timeout])
  } catch (error) {
    upsert.catch(() => {})
    console.error(
      '[auth] Could not record the user after login (the login itself succeeded):',
      error instanceof Error ? error.message : error,
    )
  } finally {
    clearTimeout(timer)
  }
}

const unauthorized = (cause: string): LoginResult => {
  console.warn(`[auth] Login rejected: ${cause}`)
  setResponseStatus(401)
  return { ok: false, error: 'unauthorized' }
}

/**
 * Verifies a Google ID token and starts a session. `verify` is injectable for
 * tests of this function in isolation; the server function always uses the
 * default (see google.server.ts for the test seam).
 */
export const loginAction = async (
  input: unknown,
  request: Request,
  verify: GoogleTokenVerifier = getGoogleVerifier(),
): Promise<LoginResult> => {
  const parsed = loginInputSchema.safeParse(input)
  if (!parsed.success) return unauthorized('missing or malformed credential')

  const limited = loginLimiter.take(getClientKey(request))
  if (!limited.allowed) {
    setResponseStatus(429)
    return { ok: false, error: 'rate_limited' }
  }

  const password = getSessionPassword()
  if (!password.ok) {
    console.error(
      `[auth] Login refused: ${describePasswordProblem(password.problem)}, ` +
        'so no session can be issued.',
    )
    setResponseStatus(503)
    return { ok: false, error: 'unavailable' }
  }

  const verified = await verify(parsed.data.credential)
  if (!verified.ok) return unauthorized(verified.reason)

  const { identity } = verified
  await recordUser(identity)
  const user = {
    name: identity.name,
    email: identity.email,
    firstName: identity.firstName,
    googleId: identity.googleId,
  }
  await setSession(user)
  return { ok: true, user }
}

export const getSessionAction = async (): Promise<SessionState> => ({
  user: await getSession(),
  googleClientId: getGoogleClientId(),
})

export const logoutAction = (): LogoutResult => {
  clearSession()
  return { ok: true }
}
