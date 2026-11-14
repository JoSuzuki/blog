import { createServerFn } from '@tanstack/react-start'
import { getRequest, setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'
import { prisma } from '~/lib/db.server'
import { takeRateLimit } from '~/lib/rate-limit.server'
import { getGoogleVerifier } from './google.server'
import type { GoogleIdentity } from './google.server'
import {
  describePasswordProblem,
  getSessionPassword,
  setSession,
} from './session.server'
import type { SessionUser } from './session-user'

interface LoginInput {
  /** The ID token Google Identity Services passed to the sign-in callback. */
  credential: string
}

export type LoginResult =
  | { ok: true; user: SessionUser }
  | {
      ok: false
      /**
       * `unauthorized`: the credential was missing, malformed or rejected
       * (deliberately not more specific; the cause is logged on the server).
       * `unavailable`: the server cannot issue sessions (no usable
       * IRON_SESSION_SECRET).
       * `rate_limited`: too many attempts from this address.
       */
      error: 'unauthorized' | 'unavailable' | 'rate_limited'
    }

const inputSchema = z.object({
  // A Google ID token is a JWT of roughly 1 to 2 KB.
  credential: z.string().min(1).max(8192),
})

/**
 * Signs a reader in with Google: verifies the ID token, records the user and
 * sets the session cookie. Resolves to `{ ok: true, user }`, or
 * `{ ok: false, error }` with HTTP 401 (`unauthorized`), 429 (`rate_limited`)
 * or 503 (`unavailable`).
 */
export const login = createServerFn({ method: 'POST' })
  .validator((data: LoginInput) => data)
  .handler(async ({ data }): Promise<LoginResult> => {
    // 1. Validate.
    const input = inputSchema.safeParse(data)
    if (!input.success) return unauthorized('missing or malformed credential')

    // 2. Rate limit: 20 attempts per 10 minutes per client address.
    const limited = takeRateLimit('login', getRequest(), {
      limit: 20,
      windowMs: 10 * 60 * 1000,
    })
    if (!limited.allowed) {
      setResponseStatus(429)
      return { ok: false, error: 'rate_limited' }
    }

    // 3. Without a usable secret no session can be sealed.
    const password = getSessionPassword()
    if (!password.ok) {
      console.error(
        `[auth] Login refused: ${describePasswordProblem(password.problem)}, ` +
          'so no session can be issued.',
      )
      setResponseStatus(503)
      return { ok: false, error: 'unavailable' }
    }

    // 4. Verify the token with Google's certificates (see google.server.ts).
    const verified = await getGoogleVerifier()(input.data.credential)
    if (!verified.ok) return unauthorized(verified.reason)
    const { identity } = verified

    // 5. Record the user, 6. start the session.
    await recordUser(identity)
    const user: SessionUser = {
      name: identity.name,
      email: identity.email,
      firstName: identity.firstName,
      googleId: identity.googleId,
    }
    await setSession(user)
    return { ok: true, user }
  })

function unauthorized(cause: string): LoginResult {
  console.warn(`[auth] Login rejected: ${cause}`)
  setResponseStatus(401)
  return { ok: false, error: 'unauthorized' }
}

const USER_UPSERT_TIMEOUT_MS = 5000

/**
 * Step 5. Records the user as the legacy /api/login did: create a row on
 * first login (matched by email), leave an existing one alone.
 *
 * Best effort. The session does not depend on the row (nothing reads it yet),
 * so if the database is down or slow, login still succeeds with just the
 * cookie and the failure is logged; the row is created on a later login.
 */
async function recordUser(identity: GoogleIdentity) {
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
