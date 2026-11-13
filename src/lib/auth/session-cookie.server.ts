import { parseCookie } from 'cookie'
import { sealData, unsealData } from 'iron-session'
import type { UnsealErrorReason } from 'iron-session'
import { z } from 'zod'
import type { SessionUser } from './types'

// The session cookie itself: sealing, unsealing and parsing a Cookie header.
//
// This module must not depend on a TanStack request context (no imports from
// @tanstack/react-start/server), because it is also used where there is none:
// the socket.io handshake calls readSessionFromCookieHeader with the
// raw header of the upgrade request. The request-bound helpers (read the
// current request's session, set or clear the cookie on the response) are in
// session.server.ts and are built on this.
//
// Format compatibility: the legacy site sealed this cookie with iron-session
// 8 (`getIronSession(req, res, { cookieName: 'session', password })`, default
// ttl of 14 days). sealData/unsealData here are iron-session 9's, which
// produce and accept the same `Fe26.2*...~2` seal, so a cookie issued by the
// legacy site keeps working after the cutover, and the other way round.

export const SESSION_COOKIE_NAME = 'session'

/** Seal lifetime, iron-session's default (14 days), as the legacy site used. */
export const SESSION_TTL_SECONDS = 14 * 24 * 60 * 60

/**
 * Cookie lifetime: iron-session sets Max-Age to the ttl minus 60 seconds so
 * the browser drops the cookie before the seal inside it expires. Same here.
 */
export const SESSION_COOKIE_MAX_AGE_SECONDS = SESSION_TTL_SECONDS - 60

/** iron-session refuses passwords shorter than this. */
const MIN_PASSWORD_LENGTH = 32

export interface SessionCookieAttributes {
  httpOnly: true
  secure: boolean
  sameSite: 'lax'
  path: '/'
  maxAge: number
}

/**
 * Attributes of the session cookie: HttpOnly, SameSite=Lax, path `/`, Secure
 * in production (NODE_ENV=production, as the legacy site did; browsers
 * also accept Secure cookies on http://localhost), Max-Age just under the seal's lifetime. `maxAge: 0` is
 * for clearing it.
 */
export const sessionCookieAttributes = (
  maxAge = SESSION_COOKIE_MAX_AGE_SECONDS,
): SessionCookieAttributes => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge,
})

export type PasswordProblem = 'missing' | 'too_short'

/**
 * IRON_SESSION_SECRET, or why it cannot be used. Read on every call (cheap),
 * so a test can change it without restarting.
 */
export const getSessionPassword = ():
  { ok: true; password: string } | { ok: false; problem: PasswordProblem } => {
  const password = process.env.IRON_SESSION_SECRET
  if (!password) return { ok: false, problem: 'missing' }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, problem: 'too_short' }
  }
  return { ok: true, password }
}

export const describePasswordProblem = (problem: PasswordProblem) =>
  problem === 'missing'
    ? 'IRON_SESSION_SECRET is not set'
    : `IRON_SESSION_SECRET is shorter than ${MIN_PASSWORD_LENGTH} characters`

const globalForSession = globalThis as unknown as {
  __blogSessionConfigReported?: boolean
  __blogSessionUnsealWarnedAt?: Partial<Record<UnsealErrorReason, number>>
}

/**
 * Prints one warning per process when sessions cannot work. Called once at
 * startup by src/server.ts. Without a usable secret the site still runs: every
 * page renders logged out and login answers `unavailable`.
 */
export const reportSessionConfig = () => {
  if (globalForSession.__blogSessionConfigReported) return
  globalForSession.__blogSessionConfigReported = true
  const result = getSessionPassword()
  if (!result.ok) {
    console.warn(
      `[session] ${describePasswordProblem(result.problem)}: Google login is ` +
        'disabled and every visitor is treated as logged out. Set it to a ' +
        `random string of at least ${MIN_PASSWORD_LENGTH} characters (the same ` +
        'value as the old site, so existing sessions survive).',
    )
  }
}

// What a valid seal may contain. `firstName` is optional because Google omits
// `given_name` for some accounts and the legacy site stored whatever it got
// (JSON drops undefined), so a legacy cookie can lack it.
const sessionPayloadSchema = z.object({
  name: z.string().min(1),
  email: z.string().min(1),
  googleId: z.string().min(1),
  firstName: z.string().optional(),
})

const toSessionUser = (payload: unknown): SessionUser | null => {
  const parsed = sessionPayloadSchema.safeParse(payload)
  if (!parsed.success) return null
  const { name, email, googleId, firstName } = parsed.data
  return {
    name,
    email,
    googleId,
    firstName: firstName || name.split(/\s+/)[0] || name,
  }
}

const UNSEAL_WARNING_INTERVAL_MS = 10 * 60 * 1000

// A cookie that does not unseal is normal now and then (an expired seal, a
// rotated secret) and is simply treated as logged out. Bursts of `invalid`
// or `unknown-password` are worth knowing about, so they are logged, but at
// most once per reason every ten minutes rather than on every request.
const onUnsealError = (reason: UnsealErrorReason) => {
  if (reason === 'expired') return
  const warned = (globalForSession.__blogSessionUnsealWarnedAt ??= {})
  const now = Date.now()
  if (now - (warned[reason] ?? 0) < UNSEAL_WARNING_INTERVAL_MS) return
  warned[reason] = now
  console.warn(
    `[session] Ignoring a session cookie that could not be unsealed (${reason}); ` +
      'treating the visitor as logged out. Further occurrences are not logged ' +
      'for 10 minutes.',
  )
}

/** Seals a session for the cookie. Throws if there is no usable secret. */
export const sealSession = async (user: SessionUser): Promise<string> => {
  const result = getSessionPassword()
  if (!result.ok) throw new Error(describePasswordProblem(result.problem))
  const { name, email, firstName, googleId } = user
  return sealData(
    { name, email, firstName, googleId },
    { password: result.password, ttl: SESSION_TTL_SECONDS },
  )
}

/**
 * Unseals a cookie value. `null` for anything that is not a valid, unexpired
 * seal made with the current secret and holding a session (never throws).
 */
export const unsealSession = async (
  seal: string | undefined | null,
): Promise<SessionUser | null> => {
  if (!seal) return null
  const result = getSessionPassword()
  if (!result.ok) return null
  try {
    const payload = await unsealData<unknown>(seal, {
      password: result.password,
      ttl: SESSION_TTL_SECONDS,
      onUnsealError,
    })
    return toSessionUser(payload)
  } catch {
    // unsealData already returns {} for bad seals; this is belt and braces.
    return null
  }
}

/** The `session` cookie's value in a raw Cookie header, if any. */
export const getSessionCookieValue = (
  cookieHeader: string | undefined | null,
): string | undefined => {
  if (!cookieHeader) return undefined
  try {
    return parseCookie(cookieHeader)[SESSION_COOKIE_NAME] || undefined
  } catch {
    return undefined
  }
}

/**
 * The session for a raw `Cookie` request header, or null when there is none
 * or it is not valid. Needs no request context: this is what the socket.io
 * handshake uses (`socket.handshake.headers.cookie`). Never throws.
 */
export const readSessionFromCookieHeader = (
  cookieHeader: string | undefined | null,
): Promise<SessionUser | null> =>
  unsealSession(getSessionCookieValue(cookieHeader))
