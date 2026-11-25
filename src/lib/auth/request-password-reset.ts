import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'
import { prisma } from '~/lib/db.server'
import { checkAccountRequest } from './account.server'
import { emailSchema } from './accounts'
import { canSendAuthEmail, sendPasswordResetEmail } from './auth-email.server'
import { createAuthToken } from './auth-token.server'

interface RequestPasswordResetInput {
  email: string
}

export type RequestPasswordResetResult =
  | { ok: true }
  | { ok: false; error: 'invalid' | 'rate_limited' | 'unavailable' }

/**
 * Emails a link to choose a new password. Answers the same whether or not
 * the email has an account, so it cannot be used to find out who does. Also
 * how a reader who only ever used Google gets a password.
 */
export const requestPasswordReset = createServerFn({ method: 'POST' })
  .validator((data: RequestPasswordResetInput) => data)
  .handler(async ({ data }): Promise<RequestPasswordResetResult> => {
    const input = z.object({ email: emailSchema }).safeParse(data)
    if (!input.success) {
      setResponseStatus(400)
      return { ok: false, error: 'invalid' }
    }
    // 5 requests per 15 minutes per client address.
    const refused = checkAccountRequest(
      'password-reset-request',
      { limit: 5, windowMs: 15 * 60 * 1000 },
      { needsSession: false },
    )
    if (refused) return { ok: false, error: refused }
    if (!canSendAuthEmail()) {
      console.error('[auth] Password reset refused: email is not configured.')
      setResponseStatus(503)
      return { ok: false, error: 'unavailable' }
    }

    const user = await prisma.user.findUnique({
      where: { email: input.data.email },
      select: { id: true, email: true },
    })
    if (user) {
      const token = await createAuthToken(user.id, 'RESET_PASSWORD')
      // A failure is logged by the mailer; the answer stays the same.
      await sendPasswordResetEmail(user.email, token)
    }
    return { ok: true }
  })
