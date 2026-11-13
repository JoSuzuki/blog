import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'
import { isPostRoute } from '~/content/posts'
import { prisma } from '~/lib/db.server'
import { commentViewSelect, toCommentView } from './comment'

const inputSchema = z.object({ route: z.string().refine(isPostRoute) })

/**
 * A post's comments, oldest first, for the post route's loader. Resolves to
 * `{ ok: true, comments }`, or `{ ok: false }` when the database is
 * unreachable or the route is not a post's (that one with HTTP 400).
 *
 * An unreachable database deliberately sets no error status. While a page is
 * rendered on the server the loader calls this inside the page's own request,
 * so a status set here would become the status of the whole page, and a post
 * is still a good page without its comments.
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
      return { ok: false as const }
    }
  })
