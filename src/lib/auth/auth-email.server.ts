import { isMailConfigured, sendEmail } from '~/lib/mail/mailer.server'
import { absoluteUrl } from '~/lib/site'
import { RESET_PASSWORD_PATH, VERIFY_EMAIL_PATH } from './accounts'

// The two emails of password accounts: confirming the address and resetting
// the password. Both carry a single-use link (auth-token.server.ts).

/**
 * Whether these emails can go out. In development without Resend the mailer
 * prints them to the console, which is enough to follow the link.
 */
export const canSendAuthEmail = () =>
  isMailConfigured() || process.env.NODE_ENV === 'development'

const linkTo = (path: string, token: string) =>
  absoluteUrl(`${path}?token=${encodeURIComponent(token)}`)

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const send = async ({
  to,
  subject,
  intro,
  action,
  link,
  outro,
}: {
  to: string
  subject: string
  intro: string
  action: string
  link: string
  outro: string
}): Promise<boolean> => {
  const result = await sendEmail({
    to,
    subject,
    text: `${intro}\n\n${action}: ${link}\n\n${outro}\n\n— JoSuzuki`,
    html: `
    <p>${escapeHtml(intro)}</p>
    <p><a href="${escapeHtml(link)}">${escapeHtml(action)}</a></p>
    <p>${escapeHtml(outro)}</p>
    <p>— JoSuzuki</p>`,
  })
  // In development the mailer printed it instead.
  return (
    result.ok ||
    (result.reason === 'not-configured' &&
      process.env.NODE_ENV === 'development')
  )
}

export const sendVerificationEmail = (to: string, token: string) =>
  send({
    to,
    subject: 'Confirme seu email - JoSuzuki',
    intro:
      'Oi! Falta só confirmar que este email é seu para terminar o cadastro.',
    action: 'Confirmar email',
    link: linkTo(VERIFY_EMAIL_PATH, token),
    outro:
      'O link vale por 24 horas. Se você não se cadastrou no josuzuki.me, ignore este email.',
  })

export const sendPasswordResetEmail = (to: string, token: string) =>
  send({
    to,
    subject: 'Redefinir senha - JoSuzuki',
    intro:
      'Alguém (provavelmente você) pediu para redefinir a senha da sua conta.',
    action: 'Criar uma nova senha',
    link: linkTo(RESET_PASSWORD_PATH, token),
    outro:
      'O link vale por 1 hora. Se não foi você, ignore este email: sua senha continua a mesma.',
  })
