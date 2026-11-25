// Shared by the session, the auth actions, the socket handshake and the
// components. No server code here: the browser bundle imports this module.

/**
 * What the session cookie holds: who signed in. The same four fields the
 * legacy site (Next.js + iron-session 8) stored, so its cookies stay
 * readable. `googleId` is missing for a reader who logged in with an email
 * and password. The email is what names the reader's `User` row.
 */
export interface SessionUser {
  name: string
  email: string
  firstName: string
  googleId?: string
  /**
   * When the session started (ms since the epoch). Missing from cookies
   * issued before it existed. Lets a deleted account's session end instead
   * of recreating the account (see findOrCreateUser).
   */
  issuedAt?: number
}
