import { createServerFn } from '@tanstack/react-start'
import type { Role } from '~/lib/auth/roles'
import { prisma } from '~/lib/db.server'
import { requireAdmin } from './admin.server'

export interface UserSummary {
  id: number
  name: string
  email: string
  role: Role
  /** ISO 8601. */
  createdAt: string
}

export type GetUsersResult =
  | {
      ok: true
      /** The admin who is asking: their own row cannot be changed. */
      currentUserId: number
      /** Everyone who has ever signed in, oldest first. */
      users: UserSummary[]
    }
  | { ok: false; reason: 'login' | 'forbidden' | 'unavailable' }

/**
 * Every user, for the /users page's loader. Admins only. Sets no error
 * status: during server rendering it runs inside the page's own request.
 */
export const getUsers = createServerFn({ method: 'GET' }).handler(
  async (): Promise<GetUsersResult> => {
    try {
      const caller = await requireAdmin()
      if (!caller.ok) return caller

      const users = await prisma.user.findMany({
        orderBy: { id: 'asc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
        },
      })
      return {
        ok: true,
        currentUserId: caller.admin.id,
        users: users.map((user) => ({
          ...user,
          createdAt: user.createdAt.toISOString(),
        })),
      }
    } catch (error) {
      console.error('Listing users failed:', error)
      return { ok: false, reason: 'unavailable' }
    }
  },
)
