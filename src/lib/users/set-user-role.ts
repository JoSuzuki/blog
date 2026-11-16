import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'
import { ROLES } from '~/lib/auth/roles'
import type { Role } from '~/lib/auth/roles'
import { prisma } from '~/lib/db.server'
import { requireAdmin } from './admin.server'

interface SetUserRoleInput {
  userId: number
  role: Role
}

/** Why a role change was refused; `message` is ready to show. */
export interface SetUserRoleError {
  ok: false
  error: 'login' | 'forbidden' | 'invalid' | 'not_found' | 'unavailable'
  message: string
}

const REFUSAL_STATUS = {
  login: 401,
  forbidden: 403,
  invalid: 400,
  not_found: 404,
  unavailable: 503,
} as const

const refused = (
  error: SetUserRoleError['error'],
  message: string,
): SetUserRoleError => {
  setResponseStatus(REFUSAL_STATUS[error])
  return { ok: false, error, message }
}

const inputSchema = z.object({
  userId: z.number().int().positive(),
  role: z.enum(ROLES),
})

/**
 * Gives a user another role. Admins only, and never on their own row: an
 * admin who could demote themselves could leave the site with no admin, and
 * this way there is always at least the one who is making the change.
 */
export const setUserRole = createServerFn({ method: 'POST' })
  .validator((data: SetUserRoleInput) => data)
  .handler(async ({ data }): Promise<{ ok: true } | SetUserRoleError> => {
    try {
      // 1. Validate, and who is asking.
      const input = inputSchema.safeParse(data)
      if (!input.success) return refused('invalid', 'Pedido inválido.')
      const caller = await requireAdmin()
      if (!caller.ok) {
        return caller.reason === 'login'
          ? refused('login', 'Faça login para continuar.')
          : refused('forbidden', 'Você não tem permissão para isso.')
      }
      if (input.data.userId === caller.admin.id) {
        return refused('invalid', 'Você não pode mudar o seu próprio papel.')
      }

      // 2. Change it. updateMany, because it reports a missing row as a
      // count of zero instead of throwing.
      const { count } = await prisma.user.updateMany({
        where: { id: input.data.userId },
        data: { role: input.data.role },
      })
      if (count === 0) return refused('not_found', 'Usuário não encontrado.')
      return { ok: true }
    } catch (error) {
      console.error('Changing a user role failed:', error)
      return refused(
        'unavailable',
        'Não foi possível mudar o papel agora. Tente de novo.',
      )
    }
  })
