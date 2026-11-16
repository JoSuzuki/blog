import { z } from 'zod'
import type { CurrentUser } from '~/lib/auth/current-user.server'
import { prisma } from '~/lib/db.server'
import type { QuizAck } from './quiz'
import { INVALID, refuse, refuseUnlessHost, sendQuizState } from './quiz.server'

const startSchema = z.object({
  count: z.number().int().min(1).max(10_000).optional(),
})

/** Any constant: the transaction-scoped lock that serialises game starts. */
const START_LOCK_KEY = 7_184_201

/**
 * The `quiz:start` socket event: the host starts a game with `count` prints
 * (all of them when left out), always in the order of their manifest ids
 * (001, 002, …), so a game of `count` prints is the first `count` of them. One game at a time: the
 * running one has to be ended first.
 */
export const startGame = async (
  user: CurrentUser,
  input: unknown,
): Promise<QuizAck> => {
  // 1. Validate, and only the host.
  const notHost = refuseUnlessHost(user)
  if (notHost) return notHost
  const parsed = startSchema.safeParse(input ?? {})
  if (!parsed.success) return INVALID

  // 2. Create the game, unless one is running. Two starts at the same moment
  // wait for each other on the lock, and the second then sees the first's game.
  const refusal = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${START_LOCK_KEY}::bigint)::text`
    const running = await tx.quizGame.findFirst({
      where: { phase: { not: 'FINISHED' } },
      select: { id: true },
    })
    if (running) {
      return refuse(
        'conflict',
        'Já existe um jogo em andamento. Encerre-o antes de começar outro.',
      )
    }
    const prints = await tx.quizPrint.findMany({
      where: { image: { isNot: null } },
      orderBy: { externalId: 'asc' },
      select: { id: true },
    })
    if (prints.length === 0) {
      return refuse('invalid', 'Nenhum print foi carregado ainda.')
    }
    const printIds = prints
      .map((print) => print.id)
      .slice(0, parsed.data.count ?? prints.length)
    await tx.quizGame.create({ data: { hostId: user.id, printIds } })
    return null
  })
  if (refusal) return refusal

  // 3. Every player's page shows the first print.
  await sendQuizState()
  return { ok: true }
}
