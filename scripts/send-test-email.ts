// Sends one email through the site's mailer, to check the Resend setup
// (RESEND_API_KEY, MAIL_FROM and the domain's DNS records).
//
// Usage (see docs/resend.md):
//
//   npm run mail:test -- you@example.com
//
// Reads `.env` if present. Resend's test inbox `delivered@resend.dev` accepts
// anything and shows the result in the Resend dashboard.

import { isMailConfigured, sendEmail } from '../src/lib/mail/mailer.server'

const to = process.argv[2]
if (!to) {
  console.error('Usage: npm run mail:test -- <recipient>')
  process.exit(1)
}
if (!isMailConfigured()) {
  console.error('Set RESEND_API_KEY and MAIL_FROM first (see docs/resend.md).')
  process.exit(1)
}

const result = await sendEmail({
  to,
  subject: 'Teste do blog (Resend)',
  text: 'Se você está lendo isto, o envio de emails do blog funciona.',
  html: '<p>Se você está lendo isto, o envio de emails do blog funciona.</p>',
})
if (!result.ok) process.exit(1)
console.log(`Sent, Resend id ${result.id}`)
