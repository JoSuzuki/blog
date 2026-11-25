import { prisma } from '~/lib/db.server'
import { displayNameOf } from '~/lib/users/display-name'
import { readSession } from './session.server'
import type { Role } from './roles'
import type { SessionUser } from './session-user'

export interface CurrentUser {
  /** The `User` row's id. */
  id: number
  name: string
  /** What the site calls them: the nickname, or the first word of the name. */
  displayName: string
  /** As stored now: read from the row on every call, never from the cookie. */
  role: Role
}

/**
 * How long after a Google login a missing row is still created from the
 * session: login records the user only as a best effort (see login.ts), so
 * the first requests after it may find no row. A session older than this
 * whose row is gone belongs to a deleted account.
 */
const RECREATE_WINDOW_MS = 10 * 60 * 1000

const select = { id: true, name: true, nickname: true, role: true } as const

const toCurrentUser = (row: {
  id: number
  name: string
  nickname: string | null
  role: Role
}): CurrentUser => ({
  id: row.id,
  name: row.name,
  displayName: displayNameOf(row),
  role: row.role,
})

/**
 * The `User` row of a logged-in reader. The session cookie only holds the
 * reader's identity (email, name, Google id); anything that stores data
 * about a reader (a seat in a game) needs the row's id. A Google login
 * creates the row only as a best effort, so right after one it is created
 * here if still missing. Otherwise a missing row means an admin deleted the
 * account, and the session no longer counts: null. Needs no request context:
 * the socket.io handshake uses it too. Throws if the database is unreachable.
 */
export const findOrCreateUser = async (
  session: SessionUser,
): Promise<CurrentUser | null> => {
  const row = await prisma.user.findUnique({
    where: { email: session.email },
    select,
  })
  if (row) return toCurrentUser(row)

  const fresh =
    session.googleId !== undefined &&
    session.issuedAt !== undefined &&
    Date.now() - session.issuedAt < RECREATE_WINDOW_MS
  if (!fresh) return null

  // upsert, not create: two first requests can arrive together.
  return toCurrentUser(
    await prisma.user.upsert({
      where: { email: session.email },
      update: {},
      create: {
        email: session.email,
        name: session.name,
        googleId: session.googleId,
        emailVerifiedAt: new Date(),
      },
      select,
    }),
  )
}

/**
 * The logged-in reader of the current request, or null for a visitor (or a
 * deleted account). For server functions and loaders.
 */
export const getCurrentUser = async (): Promise<CurrentUser | null> => {
  const session = await readSession()
  return session ? findOrCreateUser(session) : null
}
