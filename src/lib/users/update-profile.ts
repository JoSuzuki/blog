import { createServerFn } from '@tanstack/react-start'
import { getRequest, setResponseStatus } from '@tanstack/react-start/server'
import { nameSchema } from '~/lib/auth/accounts'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { readSession, setSession } from '~/lib/auth/session.server'
import { prisma } from '~/lib/db.server'
import { takeRateLimit } from '~/lib/rate-limit.server'
import { nicknameSchema } from './display-name'

interface UpdateProfileInput {
  name: string
  /** Empty for none (the site then uses the first word of the name). */
  nickname: string
}

export type UpdateProfileResult =
  | { ok: true }
  | {
      ok: false
      /**
       * `invalid_name`, `invalid_nickname`: out of bounds (the form checks
       * the same rules). Nicknames need not be unique.
       */
      error:
        | 'login'
        | 'invalid_name'
        | 'invalid_nickname'
        | 'rate_limited'
        | 'unavailable'
    }

const STATUS = {
  login: 401,
  invalid_name: 400,
  invalid_nickname: 400,
  rate_limited: 429,
  unavailable: 503,
} as const

const refuse = (error: keyof typeof STATUS): UpdateProfileResult => {
  setResponseStatus(STATUS[error])
  return { ok: false, error }
}

/**
 * Changes the logged-in reader's own name and nickname. The nickname is
 * what the games, the quiz, the greeting and the comment form show; names
 * already written into comments stay as they were.
 */
export const updateProfile = createServerFn({ method: 'POST' })
  .validator((data: UpdateProfileInput) => data)
  .handler(async ({ data }): Promise<UpdateProfileResult> => {
    try {
      // 1. Rate limit (20 saves per 10 minutes), validate, who is asking.
      if (
        !takeRateLimit('update-profile', getRequest(), {
          limit: 20,
          windowMs: 10 * 60 * 1000,
        }).allowed
      ) {
        return refuse('rate_limited')
      }
      const name = nameSchema.safeParse(data?.name)
      if (!name.success) return refuse('invalid_name')
      const rawNickname =
        typeof data?.nickname === 'string' ? data.nickname : ''
      const nickname = rawNickname.trim()
        ? nicknameSchema.safeParse(rawNickname)
        : ({ success: true, data: null } as const)
      if (!nickname.success) return refuse('invalid_nickname')
      const user = await getCurrentUser()
      if (!user) return refuse('login')

      // 2. Save.
      await prisma.user.update({
        where: { id: user.id },
        data: { name: name.data, nickname: nickname.data },
      })

      // 3. Keep the name in the session cookie in step (it is what the
      // socket logs and a fallback when the database is slow).
      const session = await readSession()
      if (session) {
        await setSession({
          ...session,
          name: name.data,
          firstName: name.data.split(/\s+/)[0] || name.data,
        })
      }
      return { ok: true }
    } catch (error) {
      console.error('Updating a profile failed:', error)
      return refuse('unavailable')
    }
  })
