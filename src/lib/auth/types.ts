// Shapes shared by the auth server functions and the components that call
// them. No server code here: this module is imported by the browser bundle.

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

/** Result of the `getSession` server function (also the root route's loader). */
export interface SessionState {
  user: SessionUser | null
  /** The OAuth client id the Google sign-in button must use. */
  googleClientId: string
}

export type LoginResult =
  | { ok: true; user: SessionUser }
  | {
      ok: false
      /**
       * `unauthorized`: the credential was missing, malformed or rejected
       * (deliberately not more specific; the cause is logged on the server).
       * `unavailable`: the server cannot issue sessions (no usable
       * IRON_SESSION_SECRET).
       * `rate_limited`: too many attempts from this address.
       */
      error: 'unauthorized' | 'unavailable' | 'rate_limited'
    }

export interface LogoutResult {
  ok: true
}
