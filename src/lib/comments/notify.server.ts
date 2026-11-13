import { absoluteUrl } from '~/lib/site'

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** One line of plain text: control characters (CR, LF, ...) become spaces. */
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f\\u2028\\u2029]+', 'g')
const singleLine = (value: string, max: number) =>
  value.replace(CONTROL_CHARS, ' ').trim().slice(0, max)

export interface CommentNotification {
  name: string
  comment: string
  /** The post's route, `/posts/<slug>`. */
  route: string
}

/** Builds the notification email. Pure: it sends nothing. */
export const buildCommentEmail = ({
  name,
  comment,
  route,
}: CommentNotification) => {
  const link = absoluteUrl(route)
  return {
    subject: `Novo comentário de ${singleLine(name, 60)} em ${singleLine(route, 80)} do JoSuzuki`,
    html: `
    <p>
      <strong>${escapeHtml(name)}</strong> comentou em ${escapeHtml(route)}:
    </p>
    <p style="white-space: pre-wrap">${escapeHtml(comment)}</p>
    <p>
      <a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer">Post</a> - JoSuzuki
    </p>`,
    text: `${name} comentou em ${link}:\n\n${comment}`,
  }
}

/**
 * Emails the owner about a new comment through SendGrid. Fire and forget: it
 * returns nothing to wait for and never throws, so a mail outage cannot fail
 * a comment. Does nothing unless SENDGRID_API_KEY, COMMENT_NOTIFY_TO and
 * COMMENT_NOTIFY_FROM are all set.
 */
export const notifyComment = (notification: CommentNotification): void => {
  const apiKey = process.env.SENDGRID_API_KEY?.trim()
  const to = process.env.COMMENT_NOTIFY_TO?.trim()
  const from = process.env.COMMENT_NOTIFY_FROM?.trim()
  if (!apiKey || !to || !from) return

  void (async () => {
    try {
      const { default: sgMail } = await import('@sendgrid/mail')
      sgMail.setApiKey(apiKey)
      await sgMail.send({ to, from, ...buildCommentEmail(notification) })
    } catch (error) {
      console.error('Comment notification email failed:', error)
    }
  })()
}
