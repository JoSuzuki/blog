import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'
import { prisma } from '~/lib/db.server'
import { checkAccountRequest, isVerified } from './account.server'
import { emailSchema, nameSchema, passwordSchema } from './accounts'
import { canSendAuthEmail, sendVerificationEmail } from './auth-email.server'
import { createAuthToken } from './auth-token.server'
import { hashPassword } from './password.server'

interface SignUpInput {
  name: string
  email: string
  password: string
}

export type SignUpResult =
  | { ok: true }
  | {
      ok: false
      /**
       * `invalid`: a field is missing or out of bounds (the form checks the
       * same rules first). `email_taken`: an account with that email exists
       * (log in, or reset its password). `rate_limited`, `unavailable`: as
       * for every account action (no session secret, or email cannot be sent).
       */
      error: 'invalid' | 'email_taken' | 'rate_limited' | 'unavailable'
    }

const inputSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
})

/**
 * Creates an account with an email and a password and emails a link to
 * confirm the address. The account cannot log in until the link is opened
 * (`verifyEmail`), so nobody can claim an address they do not own: whoever
 * later signs in with Google as that address would otherwise share the row
 * with them.
 *
 * Signing up again before confirming replaces the name and password and
 * sends a new link.
 */
export const signUp = createServerFn({ method: 'POST' })
  .validator((data: SignUpInput) => data)
  .handler(async ({ data }): Promise<SignUpResult> => {
    // 1. Validate, 2. rate limit: 5 sign-ups per hour per client address.
    const input = inputSchema.safeParse(data)
    if (!input.success) {
      setResponseStatus(400)
      return { ok: false, error: 'invalid' }
    }
    const refused = checkAccountRequest(
      'sign-up',
      { limit: 5, windowMs: 60 * 60 * 1000 },
      { needsSession: false },
    )
    if (refused) return { ok: false, error: refused }
    if (!canSendAuthEmail()) {
      console.error('[auth] Sign-up refused: email is not configured.')
      setResponseStatus(503)
      return { ok: false, error: 'unavailable' }
    }
    const { name, email, password } = input.data

    // 3. An address someone already proved they own is taken.
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerifiedAt: true, googleId: true },
    })
    if (existing && isVerified(existing)) {
      setResponseStatus(409)
      return { ok: false, error: 'email_taken' }
    }

    // 4. Create the account (or replace an unconfirmed one), 5. email the
    // link.
    const passwordHash = await hashPassword(password)
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, passwordHash },
      create: { name, email, passwordHash },
      select: { id: true },
    })
    const token = await createAuthToken(user.id, 'VERIFY_EMAIL')
    if (!(await sendVerificationEmail(email, token))) {
      setResponseStatus(503)
      return { ok: false, error: 'unavailable' }
    }
    return { ok: true }
  })
