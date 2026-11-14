// Shared by the session, the auth actions, the socket handshake and the
// components. No server code here: the browser bundle imports this module.

/**
 * What the session cookie holds: the Google identity of whoever signed in.
 * The same four fields the legacy site (Next.js + iron-session 8) stored, so
 * its cookies stay readable.
 */
export interface SessionUser {
  name: string
  email: string
  firstName: string
  googleId: string
}
