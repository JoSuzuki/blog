import { createServerFn } from '@tanstack/react-start'
import { getCurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'

export interface Profile {
  name: string
  nickname: string | null
  email: string
  /** What the site calls them now (the nickname, or the first name). */
  displayName: string
  /** Whether they can log in with Google, with a password, or both. */
  hasGoogle: boolean
  hasPassword: boolean
}

export type GetProfileResult =
  | { ok: true; profile: Profile }
  | { ok: false; reason: 'login' | 'unavailable' }

/**
 * The logged-in reader's own profile, for /perfil's loader. Sets no error
 * status: during server rendering it runs inside the page's own request.
 */
export const getProfile = createServerFn({ method: 'GET' }).handler(
  async (): Promise<GetProfileResult> => {
    try {
      const user = await getCurrentUser()
      if (!user) return { ok: false, reason: 'login' }
      const row = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          name: true,
          nickname: true,
          email: true,
          googleId: true,
          passwordHash: true,
        },
      })
      if (!row) return { ok: false, reason: 'login' }
      return {
        ok: true,
        profile: {
          name: row.name,
          nickname: row.nickname,
          email: row.email,
          displayName: user.displayName,
          hasGoogle: row.googleId !== null,
          hasPassword: row.passwordHash !== null,
        },
      }
    } catch (error) {
      console.error('Reading a profile failed:', error)
      return { ok: false, reason: 'unavailable' }
    }
  },
)
