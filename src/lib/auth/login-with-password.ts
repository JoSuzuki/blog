import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'
import { prisma } from '~/lib/db.server'
import {
  checkAccountRequest,
  isVerified,
  sessionUserFor,
} from './account.server'
import { emailSchema, PASSWORD_MAX_LENGTH } from './accounts'
import { sendVerificationEmail } from './auth-email.server'
import { createAuthToken } from './auth-token.server'
import { verifyNothing, verifyPassword } from './password.server'
import { setSession } from './session.server'
import type { SessionUser } from './session-user'

interface LoginWithPasswordInput {
  email: string
  password: string
}

export type LoginWithPasswordResult =
  | { ok: true; user: SessionUser }
  | {
      ok: false
      /**
       * `wrong_credentials`: no account with that email and password (a
       * Google-only account has no password). `unverified`: right password,
       * but the email was never confirmed; a new link was just sent.
       */
      error: 'wrong_credentials' | 'unverified' | 'rate_limited' | 'unavailable'
    }

const inputSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
})

/**
 * Logs a reader in with their email and password and sets the session
 * cookie, the same cookie a Google login sets (without the Google id).
 */
export const loginWithPassword = createServerFn({ method: 'POST' })
  .validator((data: LoginWithPasswordInput) => data)
  .handler(async ({ data }): Promise<LoginWithPasswordResult> => {
    // 1. Rate limit: 10 attempts per 10 minutes per client address, and a
    // usable session secret.
    const refused = checkAccountRequest('password-login', {
      limit: 10,
      windowMs: 10 * 60 * 1000,
    })
    if (refused) return { ok: false, error: refused }

    // 2. Validate.
    const input = inputSchema.safeParse(data)
    if (!input.success) return wrongCredentials()
    const { email, password } = input.data

    // 3. Check the password. An email without one costs the same time.
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        googleId: true,
        passwordHash: true,
        emailVerifiedAt: true,
      },
    })
    if (!user?.passwordHash) {
      await verifyNothing(password)
      return wrongCredentials()
    }
    if (!(await verifyPassword(password, user.passwordHash))) {
      return wrongCredentials()
    }

    // 4. An unconfirmed address gets a new link instead of a session.
    if (!isVerified(user)) {
      await sendVerificationEmail(
        user.email,
        await createAuthToken(user.id, 'VERIFY_EMAIL'),
      )
      setResponseStatus(403)
      return { ok: false, error: 'unverified' }
    }

    // 5. Start the session.
    const sessionUser = sessionUserFor(user)
    await setSession(sessionUser)
    return { ok: true, user: sessionUser }
  })

function wrongCredentials(): LoginWithPasswordResult {
  setResponseStatus(401)
  return { ok: false, error: 'wrong_credentials' }
}
