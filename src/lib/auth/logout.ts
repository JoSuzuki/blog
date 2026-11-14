import { createServerFn } from '@tanstack/react-start'
import { clearSession } from './session.server'

/** Signs the reader out by clearing the session cookie. Always `{ ok: true }`. */
export const logout = createServerFn({ method: 'POST' }).handler(
  (): { ok: true } => {
    clearSession()
    return { ok: true }
  },
)
