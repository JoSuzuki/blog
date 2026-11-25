// Rules for email and password accounts, shared by the server functions and
// the forms. No server code here: the browser bundle imports this module.

import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 200
export const NAME_MAX_LENGTH = 80

/** Emails are compared lowercased and trimmed. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const emailSchema = z
  .string()
  .max(254)
  .transform(normalizeEmail)
  .pipe(z.email())

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(PASSWORD_MAX_LENGTH)

export const nameSchema = z.string().trim().min(1).max(NAME_MAX_LENGTH)

/** A link token: 32 random bytes in base64url. */
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/)

/** The pages a link in an email opens. */
export const VERIFY_EMAIL_PATH = '/confirmar-email'
export const RESET_PASSWORD_PATH = '/redefinir-senha'
