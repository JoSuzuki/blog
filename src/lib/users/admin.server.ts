import { getCurrentUser } from '~/lib/auth/current-user.server'
import type { CurrentUser } from '~/lib/auth/current-user.server'
import { isAdmin } from '~/lib/auth/roles'

/**
 * Who is asking, if they may manage users. The role comes from the database
 * at the time of the call (see getCurrentUser), so taking ADMIN away from
 * someone works at once. Throws if the database is unreachable.
 */
export const requireAdmin = async (): Promise<
  | { ok: true; admin: CurrentUser }
  | { ok: false; reason: 'login' | 'forbidden' }
> => {
  const user = await getCurrentUser()
  if (!user) return { ok: false, reason: 'login' }
  if (!isAdmin(user.role)) return { ok: false, reason: 'forbidden' }
  return { ok: true, admin: user }
}
