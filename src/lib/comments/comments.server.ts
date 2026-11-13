import { prisma } from '~/lib/db.server'

/** What the page gets for a comment. `createdAt` is milliseconds since the epoch. */
export interface CommentView {
  id: number
  name: string
  comment: string
  createdAt: number
}

const toView = (row: {
  id: number
  name: string
  comment: string
  createdAt: Date
}): CommentView => ({
  id: row.id,
  name: row.name,
  comment: row.comment,
  createdAt: row.createdAt.getTime(),
})

/** A post's comments, oldest first. */
export const listComments = async (route: string): Promise<CommentView[]> => {
  const rows = await prisma.comment.findMany({
    where: { route },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, name: true, comment: true, createdAt: true },
  })
  return rows.map(toView)
}

export const insertComment = async (input: {
  route: string
  name: string
  comment: string
}): Promise<CommentView> =>
  toView(
    await prisma.comment.create({
      data: input,
      select: { id: true, name: true, comment: true, createdAt: true },
    }),
  )

/**
 * Adds one to the route's counter, creating it at 1 if needed, in a single
 * statement: concurrent first hits cannot create two rows or lose an increment.
 */
export const incrementHits = async (route: string): Promise<number> => {
  const rows = await prisma.$queryRaw<{ hits: number }[]>`
    INSERT INTO "HitCounter" ("route", "hits")
    VALUES (${route}, 1)
    ON CONFLICT ("route") DO UPDATE SET "hits" = "HitCounter"."hits" + 1
    RETURNING "hits"`
  return rows[0].hits
}
