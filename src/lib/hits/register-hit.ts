import { createServerFn } from '@tanstack/react-start'
import { setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'
import { isPostRoute } from '~/content/posts'
import { prisma } from '~/lib/db.server'

const inputSchema = z.object({ route: z.string().refine(isPostRoute) })

/**
 * Counts one view of a post and resolves to `{ hits }`, the new total.
 * `{ hits: null }` with HTTP 400 (not a post's route) or 503 (the database is
 * unreachable).
 */
export const registerHit = createServerFn({ method: 'POST' })
  .validator((data: { route: string }) => data)
  .handler(async ({ data }): Promise<{ hits: number | null }> => {
    const input = inputSchema.safeParse(data)
    if (!input.success) {
      setResponseStatus(400)
      return { hits: null }
    }

    try {
      // Adds one to the route's counter, creating it at 1 if needed, in a
      // single statement: concurrent first hits cannot create two rows or
      // lose an increment.
      const rows = await prisma.$queryRaw<{ hits: number }[]>`
        INSERT INTO "HitCounter" ("route", "hits")
        VALUES (${input.data.route}, 1)
        ON CONFLICT ("route") DO UPDATE SET "hits" = "HitCounter"."hits" + 1
        RETURNING "hits"`
      return { hits: rows[0].hits }
    } catch (error) {
      console.error('Registering a hit failed:', error)
      setResponseStatus(503)
      return { hits: null }
    }
  })
