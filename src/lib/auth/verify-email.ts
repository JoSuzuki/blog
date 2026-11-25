import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'
import { prisma } from '~/lib/db.server'
import { checkAccountRequest, sessionUserFor } from './account.server'
import { tokenSchema } from './accounts'
import { findAuthTokenUser } from './auth-token.server'
import { setSession } from './session.server'
import type { SessionUser } from './session-user'

interface VerifyEmailInput {
  token: string
}

export type VerifyEmailResult =
  | { ok: true; user: SessionUser }
  | {
      ok: false
      /** `invalid_token`: unknown, already used or expired. */
      error: 'invalid_token' | 'rate_limited' | 'unavailable'
    }

/**
 * Opens the link of a sign-up email: marks the address as confirmed and logs
 * the reader in. Called by the page's button, not when the page loads, so a
 * mail scanner that fetches the link does not use it up.
 */
export const verifyEmail = createServerFn({ method: 'POST' })
  .validator((data: VerifyEmailInput) => data)
  .handler(async ({ data }): Promise<VerifyEmailResult> => {
    const refused = checkAccountRequest('verify-email', {
      limit: 20,
      windowMs: 10 * 60 * 1000,
    })
    if (refused) return { ok: false, error: refused }

    const input = z.object({ token: tokenSchema }).safeParse(data)
    const userId = input.success
      ? await findAuthTokenUser(input.data.token, 'VERIFY_EMAIL')
      : null
    if (userId === null) {
      setResponseStatus(400)
      return { ok: false, error: 'invalid_token' }
    }

    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
        select: { name: true, email: true, googleId: true },
      }),
      prisma.authToken.deleteMany({
        where: { userId, purpose: 'VERIFY_EMAIL' },
      }),
    ])
    const sessionUser = sessionUserFor(user)
    await setSession(sessionUser)
    return { ok: true, user: sessionUser }
  })
