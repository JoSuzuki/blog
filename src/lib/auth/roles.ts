// Shared by the server functions, the socket and the components. No server
// code here (and no import from the generated Prisma client): the browser
// bundle imports this module.

/** The values of the `Role` enum in prisma/schema.prisma, lowest first. */
export const ROLES = ['USER', 'SQUALI', 'ADMIN'] as const

/**
 * What a reader may do beyond the public site. USER: nothing more. SQUALI:
 * the group of friends the private quiz is for. ADMIN: that, plus the /users
 * page.
 */
export type Role = (typeof ROLES)[number]

// Both take null and undefined (a visitor has no role) so that callers can
// pass `session.role` or `user?.role` straight in.

export const isAdmin = (role: Role | null | undefined): boolean =>
  role === 'ADMIN'

export const canPlayQuiz = (role: Role | null | undefined): boolean =>
  role === 'SQUALI' || role === 'ADMIN'
