import { prisma } from '~/lib/db.server'
import { readSession } from './session.server'

export interface CurrentUser {
  /** The `User` row's id. */
  id: number
  name: string
}

/**
 * The logged-in reader of the current request as a `User` row, or null for a
 * visitor. The session cookie only holds the Google identity; anything that
 * stores data about a reader (a seat in a game) needs the row's id. Login
 * creates the row, but only as a best effort, so it is created here if it is
 * still missing. Throws if the database is unreachable.
 */
export const getCurrentUser = async (): Promise<CurrentUser | null> => {
  const session = await readSession()
  if (!session) return null
  const select = { id: true, name: true } as const
  return (
    (await prisma.user.findUnique({
      where: { email: session.email },
      select,
    })) ??
    // upsert, not create: two first requests can arrive together.
    (await prisma.user.upsert({
      where: { email: session.email },
      update: {},
      create: {
        email: session.email,
        name: session.name,
        googleId: session.googleId,
      },
      select,
    }))
  )
}
