import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'
import { prisma } from '~/lib/db.server'
import { requireAdmin } from './admin.server'

interface DeleteUserInput {
  userId: number
}

/** Why a deletion was refused; `message` is ready to show. */
export interface DeleteUserError {
  ok: false
  error:
    'login' | 'forbidden' | 'invalid' | 'not_found' | 'busy' | 'unavailable'
  message: string
}

const STATUS = {
  login: 401,
  forbidden: 403,
  invalid: 400,
  not_found: 404,
  busy: 409,
  unavailable: 503,
} as const

const refused = (
  error: DeleteUserError['error'],
  message: string,
): DeleteUserError => {
  setResponseStatus(STATUS[error])
  return { ok: false, error, message }
}

const inputSchema = z.object({ userId: z.number().int().positive() })

/**
 * Deletes an account and everything that hangs off it in the database: the
 * games it created or played (finished ones too, so they disappear from the
 * other player's history), its quiz guesses and its login links. Comments are not linked to accounts and stay. The
 * reader's session ends on their next request (see findOrCreateUser); they
 * can sign up or log in with Google again later, as a new account.
 *
 * Admins only. Refused for the admin's own row and for other admins (take
 * the role away first, so the site never loses its last admin by
 * accident), and while the account is in a game that is still going, which
 * would break that game for the others.
 */
export const deleteUser = createServerFn({ method: 'POST' })
  .validator((data: DeleteUserInput) => data)
  .handler(async ({ data }): Promise<{ ok: true } | DeleteUserError> => {
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
      const { userId } = input.data
      if (userId === caller.admin.id) {
        return refused('invalid', 'Você não pode apagar a sua própria conta.')
      }

      // 2. What would break.
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      })
      if (!user) return refused('not_found', 'Usuário não encontrado.')
      if (user.role === 'ADMIN') {
        return refused(
          'invalid',
          'Esta conta é ADMIN. Mude o papel dela antes de apagar.',
        )
      }
      const active = ['WAITING', 'PLAYING'] as const
      const inGame = (status: { in: ('WAITING' | 'PLAYING')[] }) => ({
        status,
        OR: [{ creatorId: userId }, { players: { some: { userId } } }],
      })
      const [santorini, taboo, quiz] = await Promise.all([
        prisma.santoriniRoom.count({ where: inGame({ in: [...active] }) }),
        prisma.tabooRoom.count({ where: inGame({ in: [...active] }) }),
        prisma.quizGame.count({
          where: { hostId: userId, phase: { not: 'FINISHED' } },
        }),
      ])
      if (santorini + taboo + quiz > 0) {
        return refused(
          'busy',
          'Esta conta está numa partida em andamento. Tente de novo quando ela acabar.',
        )
      }

      // 3. Delete. A finished game is kept whole or not at all (its state
      // names both seats), so the finished rooms the account sat in go too.
      // The schema cascades from the user to the rooms it created, its
      // seats, quiz guesses and login links.
      const played = { players: { some: { userId } } }
      const [, , { count }] = await prisma.$transaction([
        prisma.santoriniRoom.deleteMany({ where: played }),
        prisma.tabooRoom.deleteMany({ where: played }),
        prisma.user.deleteMany({ where: { id: userId } }),
      ])
      if (count === 0) return refused('not_found', 'Usuário não encontrado.')
      return { ok: true }
    } catch (error) {
      console.error('Deleting a user failed:', error)
      return refused(
        'unavailable',
        'Não foi possível apagar a conta agora. Tente de novo.',
      )
    }
  })
