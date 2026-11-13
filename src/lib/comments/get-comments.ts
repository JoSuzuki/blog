import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'
import { isPostRoute } from '~/content/posts'
import { prisma } from '~/lib/db.server'
import { commentViewSelect, toCommentView } from './comment'

const inputSchema = z.object({ route: z.string().refine(isPostRoute) })

/**
 * A post's comments, oldest first. Resolves to `{ ok: true, comments }`, or
 * `{ ok: false }` with HTTP 400 (not a post's route) or 503 (the database is
 * unreachable).
 */
export const getComments = createServerFn({ method: 'GET' })
  .validator((data: { route: string }) => data)
  .handler(async ({ data }) => {
    const input = inputSchema.safeParse(data)
    if (!input.success) {
      setResponseStatus(400)
      return { ok: false as const }
    }

    try {
      const rows = await prisma.comment.findMany({
        where: { route: input.data.route },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: commentViewSelect,
      })
      return { ok: true as const, comments: rows.map(toCommentView) }
    } catch (error) {
      console.error('Listing comments failed:', error)
      setResponseStatus(503)
      return { ok: false as const }
    }
  })
