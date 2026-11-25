import assert from 'node:assert/strict'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { isMailConfigured, sendEmail } from './mailer.server'

// Run with `npm test`.

type Call = { url: string; init: RequestInit }

function fakeFetch(status: number, body: unknown) {
  const calls: Call[] = []
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(body), { status })
  }) as unknown as typeof fetch
  return { impl, calls }
}

describe('sendEmail', () => {
  const saved = { ...process.env }
  let errors: unknown[][]
  const originalError = console.error

  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test'
    process.env.MAIL_FROM = 'Blog <blog@example.com>'
    errors = []
    console.error = (...args: unknown[]) => void errors.push(args)
  })
  afterEach(() => {
    process.env = { ...saved }
    console.error = originalError
  })

  it('posts the email to Resend and returns its id', async () => {
    const { impl, calls } = fakeFetch(200, { id: 'abc' })
    const result = await sendEmail(
      { to: 'me@example.com', subject: 'Hi', text: 'Hello', replyTo: 'x@y.z' },
      impl,
    )
    assert.deepEqual(result, { ok: true, id: 'abc' })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, 'https://api.resend.com/emails')
    const headers = calls[0].init.headers as Record<string, string>
    assert.equal(headers.Authorization, 'Bearer re_test')
    assert.deepEqual(JSON.parse(calls[0].init.body as string), {
      from: 'Blog <blog@example.com>',
      to: 'me@example.com',
      subject: 'Hi',
      text: 'Hello',
      reply_to: 'x@y.z',
    })
  })

  it('lets a call override the sender', async () => {
    const { impl, calls } = fakeFetch(200, { id: 'abc' })
    await sendEmail(
      { to: 'me@example.com', subject: 'Hi', text: 'x', from: 'o@example.com' },
      impl,
    )
    assert.equal(JSON.parse(calls[0].init.body as string).from, 'o@example.com')
  })

  it('sends nothing without an API key or a sender', async () => {
    const { impl, calls } = fakeFetch(200, { id: 'abc' })
    delete process.env.RESEND_API_KEY
    assert.equal(isMailConfigured(), false)
    assert.deepEqual(
      await sendEmail({ to: 'a@b.c', subject: 's', text: 't' }, impl),
      { ok: false, reason: 'not-configured' },
    )
    process.env.RESEND_API_KEY = 're_test'
    delete process.env.MAIL_FROM
    assert.equal(isMailConfigured(), false)
    assert.equal(
      (await sendEmail({ to: 'a@b.c', subject: 's', text: 't' }, impl)).ok,
      false,
    )
    assert.equal(calls.length, 0)
    assert.equal(errors.length, 0)
  })

  it('reports an API error without throwing', async () => {
    const { impl } = fakeFetch(403, { message: 'domain not verified' })
    const result = await sendEmail(
      { to: 'a@b.c', subject: 's', text: 't' },
      impl,
    )
    assert.equal(result.ok, false)
    assert.match(
      result.ok ? '' : (result.error ?? ''),
      /403.*domain not verified/,
    )
    assert.equal(errors.length, 1)
  })

  it('reports a network error without throwing', async () => {
    const impl = (async () => {
      throw new Error('offline')
    }) as unknown as typeof fetch
    const result = await sendEmail(
      { to: 'a@b.c', subject: 's', text: 't' },
      impl,
    )
    assert.deepEqual(result, { ok: false, reason: 'failed', error: 'offline' })
  })
})
