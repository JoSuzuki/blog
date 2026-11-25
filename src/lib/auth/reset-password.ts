import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'
import { prisma } from '~/lib/db.server'
import { checkAccountRequest, sessionUserFor } from './account.server'
import { passwordSchema, tokenSchema } from './accounts'
import { findAuthTokenUser } from './auth-token.server'
import { hashPassword } from './password.server'
import { setSession } from './session.server'
import type { SessionUser } from './session-user'

interface ResetPasswordInput {
  token: string
  password: string
}

export type ResetPasswordResult =
  | { ok: true; user: SessionUser }
  | {
      ok: false
      /**
       * `invalid`: the password is too short or too long. `invalid_token`:
       * the link is unknown, already used or expired.
       */
      error: 'invalid' | 'invalid_token' | 'rate_limited' | 'unavailable'
    }

const inputSchema = z.object({ token: tokenSchema, password: passwordSchema })

/**
 * Sets a new password from the link of a reset email and logs the reader in.
 * Opening the link proves they own the address, so it also confirms it.
 */
export const resetPassword = createServerFn({ method: 'POST' })
  .validator((data: ResetPasswordInput) => data)
  .handler(async ({ data }): Promise<ResetPasswordResult> => {
    const refused = checkAccountRequest('password-reset', {
      limit: 20,
      windowMs: 10 * 60 * 1000,
    })
    if (refused) return { ok: false, error: refused }

    const input = inputSchema.safeParse(data)
    if (!input.success) {
      setResponseStatus(400)
      const tokenOk = tokenSchema.safeParse(data?.token).success
      return { ok: false, error: tokenOk ? 'invalid' : 'invalid_token' }
    }
    const userId = await findAuthTokenUser(input.data.token, 'RESET_PASSWORD')
    if (userId === null) {
      setResponseStatus(400)
      return { ok: false, error: 'invalid_token' }
    }

    const passwordHash = await hashPassword(input.data.password)
    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { passwordHash, emailVerifiedAt: new Date() },
        select: { name: true, email: true, googleId: true },
      }),
      // Every outstanding link of this user stops working.
      prisma.authToken.deleteMany({ where: { userId } }),
    ])
    const sessionUser = sessionUserFor(user)
    await setSession(sessionUser)
    return { ok: true, user: sessionUser }
  })
