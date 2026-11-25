// How a reader is named across the site (games, quiz, the greeting, the
// comment form): their nickname, or the first word of their name if they
// have not chosen one. No server code here: the browser bundle imports it.

import { z } from 'zod'

export const NICKNAME_MIN_LENGTH = 2
export const NICKNAME_MAX_LENGTH = 20

export const displayNameOf = (user: {
  name: string
  nickname?: string | null
}): string =>
  user.nickname?.trim() || user.name.trim().split(/\s+/)[0] || user.name

/**
 * A nickname: 2 to 20 letters, digits, spaces, dots, dashes or underscores,
 * starting with a letter or digit. Spaces inside are collapsed.
 */
export const nicknameSchema = z
  .string()
  .transform((value) => value.normalize('NFKC').trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(NICKNAME_MIN_LENGTH)
      .max(NICKNAME_MAX_LENGTH)
      .regex(/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u),
  )
