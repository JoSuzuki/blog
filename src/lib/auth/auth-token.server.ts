import { createHash, randomBytes } from 'node:crypto'
import type { AuthTokenPurpose } from '~/generated/prisma/client'
import { prisma } from '~/lib/db.server'

// Single-use links sent by email (confirming an address, resetting a
// password). The link carries a random token; the database keeps only its
// SHA-256, so reading the table is not enough to use one.

const LIFETIME_MS: Record<AuthTokenPurpose, number> = {
  VERIFY_EMAIL: 24 * 60 * 60 * 1000,
  RESET_PASSWORD: 60 * 60 * 1000,
}

export const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')

/**
 * A new token for `userId`. Earlier tokens of the same purpose stop working,
 * so only the latest email's link does.
 */
export const createAuthToken = async (
  userId: number,
  purpose: AuthTokenPurpose,
): Promise<string> => {
  const token = randomBytes(32).toString('base64url')
  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, purpose } }),
    prisma.authToken.create({
      data: {
        tokenHash: hashToken(token),
        purpose,
        userId,
        expiresAt: new Date(Date.now() + LIFETIME_MS[purpose]),
      },
    }),
  ])
  return token
}

/**
 * The user a valid, unexpired token of `purpose` belongs to, or null. Does
 * not use it up: the caller deletes the user's tokens in the same
 * transaction as the change the token allows.
 */
export const findAuthTokenUser = async (
  token: string,
  purpose: AuthTokenPurpose,
): Promise<number | null> => {
  const row = await prisma.authToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { userId: true, purpose: true, expiresAt: true },
  })
  if (!row || row.purpose !== purpose || row.expiresAt < new Date()) {
    return null
  }
  return row.userId
}
