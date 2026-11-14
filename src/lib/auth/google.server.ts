import { OAuth2Client } from 'google-auth-library'
import type { TokenPayload } from 'google-auth-library'

// Verifies the ID token ("credential") that Google Identity Services hands the
// browser after a sign-in.

/** The site's OAuth client id (public; it is also in the sign-in button). */
const DEFAULT_GOOGLE_CLIENT_ID =
  '464384148013-0lakedv6kgvi61su00ohotbihk0468ri.apps.googleusercontent.com'

/**
 * The one source of the Google client id: GOOGLE_CLIENT_ID if set, otherwise
 * the site's existing id. The server uses it as the required token audience,
 * and the browser's sign-in button gets it from the root route's loader
 * (SessionState.googleClientId), so both always agree and changing it needs
 * no rebuild.
 */
export const getGoogleClientId = (): string =>
  process.env.GOOGLE_CLIENT_ID?.trim() || DEFAULT_GOOGLE_CLIENT_ID

/**
 * The issuers Google documents for Sign in with Google ID tokens. The
 * library's default list also has `googleapis.com`, which is not one.
 */
const GOOGLE_ID_TOKEN_ISSUERS = [
  'accounts.google.com',
  'https://accounts.google.com',
]

export interface GoogleIdentity {
  googleId: string
  email: string
  name: string
  firstName: string
}

export type VerifyResult =
  { ok: true; identity: GoogleIdentity } | { ok: false; reason: string }

export type GoogleTokenVerifier = (credential: string) => Promise<VerifyResult>

/**
 * Error messages from google-auth-library quote the whole token or its
 * payload (name, email). Keep the reason, drop those.
 */
const describeError = (error: unknown, credential: string) => {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .split(credential)
    .join('[token]')
    .replace(/:\s*[{'"[].*$/s, '')
    .slice(0, 200)
}

const toIdentity = (payload: TokenPayload | undefined): VerifyResult => {
  if (!payload) return { ok: false, reason: 'token has no payload' }
  if (!payload.sub) return { ok: false, reason: 'token has no subject' }
  if (!payload.email) return { ok: false, reason: 'token has no email' }
  if (payload.email_verified !== true) {
    return { ok: false, reason: 'email is not verified' }
  }
  const name = payload.name?.trim() || payload.email.split('@')[0]
  return {
    ok: true,
    identity: {
      googleId: payload.sub,
      email: payload.email,
      name,
      firstName: payload.given_name?.trim() || name.split(/\s+/)[0] || name,
    },
  }
}

/**
 * A verifier over a given OAuth2Client. google-auth-library checks the
 * signature against Google's published certificates (fetched and cached by
 * the client), the issuer (accounts.google.com), the audience (our client id)
 * and the expiry; this adds a required, verified email.
 */
export const createGoogleVerifier = ({
  client,
  clientId,
}: {
  client: OAuth2Client
  clientId: () => string
}): GoogleTokenVerifier => {
  return async (credential) => {
    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: clientId(),
      })
      return toIdentity(ticket.getPayload())
    } catch (error) {
      return { ok: false, reason: describeError(error, credential) }
    }
  }
}

// ---------------------------------------------------------------------------
// Test seam
//
// A real sign-in needs a Google account and an origin authorised for the
// client id, so the login flow is tested with tokens a test signs itself. The
// only thing a test can replace is where the signing certificates come from:
// everything else (signature, issuer, audience, expiry and email checks, the
// client id) is the production code path above.
//
// The certificates are read from a slot on globalThis keyed by a registered
// Symbol. Nothing in the app ever writes it, a request cannot reach it, and
// no environment variable is read for it: it can only be filled by code
// already running inside the server process before the first login (the test
// harness loads a module with `node --import <file> server.js`). Whoever can
// do that can run any code in the process anyway. Every use is logged.
// ---------------------------------------------------------------------------

const TEST_CERTS_SLOT = Symbol.for('blog.auth.testGoogleCertificates')

type TestCertificates = Record<string, string>
type FederatedCerts = Awaited<
  ReturnType<OAuth2Client['getFederatedSignonCertsAsync']>
>

const readTestCertificates = (): TestCertificates | undefined => {
  const value = (globalThis as Record<symbol, unknown>)[TEST_CERTS_SLOT]
  if (!value || typeof value !== 'object') return undefined
  return value as TestCertificates
}

/** An OAuth2Client that verifies against fixed PEM keys instead of Google's. */
class FixedCertificatesClient extends OAuth2Client {
  constructor(private readonly certificates: TestCertificates) {
    super({ issuers: GOOGLE_ID_TOKEN_ISSUERS })
  }
  override async getFederatedSignonCertsAsync(): Promise<FederatedCerts> {
    // CertificateFormat.PEM; the enum is not exported from the package root.
    return {
      certs: this.certificates,
      format: 'PEM' as FederatedCerts['format'],
    }
  }
}

// One client per process so Google's certificates are fetched once and cached
// (the library honours their Cache-Control).
const globalForGoogle = globalThis as unknown as {
  __blogGoogleClient?: OAuth2Client
}

/** The verifier login uses: Google's certificates, unless a test seam is set. */
export const getGoogleVerifier = (): GoogleTokenVerifier => {
  const testCertificates = readTestCertificates()
  if (testCertificates) {
    console.warn(
      '[auth] TEST SEAM ACTIVE: this Google ID token is verified against ' +
        'test certificates installed in this process, not Google’s.',
    )
    return createGoogleVerifier({
      client: new FixedCertificatesClient(testCertificates),
      clientId: getGoogleClientId,
    })
  }
  const client = (globalForGoogle.__blogGoogleClient ??= new OAuth2Client({
    issuers: GOOGLE_ID_TOKEN_ISSUERS,
  }))
  return createGoogleVerifier({ client, clientId: getGoogleClientId })
}
