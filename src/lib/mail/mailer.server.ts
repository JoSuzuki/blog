/**
 * Transactional email through Resend (https://resend.com), over its REST API
 * with `fetch`, so there is no SDK dependency.
 *
 * Configuration (see README, "Email"):
 * - `RESEND_API_KEY`: required; without it nothing is sent.
 * - `MAIL_FROM`: the default sender, e.g. `JoSuzuki <blog@josuzuki.me>`. Its
 *   domain must be verified in Resend. Required unless every call passes `from`.
 *
 * In development (`npm run dev`) without that configuration, the email is
 * printed to the console instead, so links in it (password reset, ...) can
 * be followed locally.
 *
 * `sendEmail` never throws: it resolves to a result, and logs failures, so a
 * mail outage cannot fail the request that triggered the email. Callers that
 * do not care about the outcome can `void sendEmail(...)`.
 */

export interface Email {
  to: string | string[]
  subject: string
  /** At least one of `html` and `text`. Send both when you can. */
  html?: string
  text?: string
  /** Overrides `MAIL_FROM`. */
  from?: string
  replyTo?: string | string[]
}

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'not-configured' | 'failed'; error?: string }

const RESEND_ENDPOINT = 'https://api.resend.com/emails'
const TIMEOUT_MS = 10_000

/** True when an email without an explicit `from` would be sent. */
export function isMailConfigured(): boolean {
  return Boolean(apiKey() && defaultFrom())
}

export async function sendEmail(
  email: Email,
  fetchImpl: typeof fetch = fetch,
): Promise<SendEmailResult> {
  const key = apiKey()
  const from = email.from?.trim() || defaultFrom()
  if (!key || !from) {
    if (process.env.NODE_ENV === 'development') logInstead(email)
    return { ok: false, reason: 'not-configured' }
  }
  if (!email.html && !email.text) {
    return fail('an email needs html or text')
  }

  try {
    const response = await fetchImpl(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        reply_to: email.replyTo,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const body = (await response.json().catch(() => null)) as {
      id?: string
      message?: string
    } | null
    if (!response.ok || !body?.id) {
      return fail(
        `Resend answered ${response.status}: ${body?.message ?? 'no message'}`,
      )
    }
    return { ok: true, id: body.id }
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
}

/** In `npm run dev` without Resend, print the email so links can be followed. */
function logInstead(email: Email) {
  console.info(
    `Email not configured; would send to ${String(email.to)}:\n` +
      `Subject: ${email.subject}\n\n${email.text ?? email.html}`,
  )
}

function fail(error: string): SendEmailResult {
  console.error('Email not sent:', error)
  return { ok: false, reason: 'failed', error }
}

function apiKey() {
  return process.env.RESEND_API_KEY?.trim() || undefined
}

function defaultFrom() {
  return process.env.MAIL_FROM?.trim() || undefined
}
