import { createServerFn } from '@tanstack/react-start'
import { getRequest, setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'
import { isPostRoute } from '~/content/posts'
import { prisma } from '~/lib/db.server'
import { takeRateLimit } from '~/lib/rate-limit.server'
import { postRoom } from '~/lib/realtime/events'
import { getIO } from '~/lib/realtime/io.server'
import { absoluteUrl } from '~/lib/site'
import {
  COMMENT_MAX_LENGTH,
  HONEYPOT_FIELD,
  NAME_MAX_LENGTH,
  commentViewSelect,
  toCommentView,
} from './comment'
import type { CommentView } from './comment'

interface CreateCommentInput {
  route: string
  name: string
  comment: string
  /** Honeypot: always sent empty by the form. */
  website?: string
}

export type CreateCommentResult =
  | { ok: true; comment: CommentView }
  | {
      ok: false
      code: 'invalid' | 'rate_limited' | 'unavailable'
      message: string
      /** Per-field messages when `code` is `invalid`. */
      fieldErrors?: { name?: string; comment?: string }
      retryAfterSeconds?: number
    }

const inputSchema = z.object({
  route: z.string().refine(isPostRoute),
  name: z
    .string()
    .trim()
    .min(1, 'Escreva seu nome.')
    .max(
      NAME_MAX_LENGTH,
      `O nome pode ter no máximo ${NAME_MAX_LENGTH} caracteres.`,
    ),
  comment: z
    .string()
    .trim()
    .min(1, 'Escreva um comentário.')
    .max(
      COMMENT_MAX_LENGTH,
      `O comentário pode ter no máximo ${COMMENT_MAX_LENGTH} caracteres.`,
    ),
  // Optional and untyped so a bot's value never fails validation.
  [HONEYPOT_FIELD]: z.unknown().optional(),
})

/**
 * Posts a comment on a post: validates it, stores it, shows it live to
 * everyone reading the post and emails the owner. No login needed. A refusal
 * is a result, not an exception: `{ ok: false, code, message }` with HTTP 400
 * (`invalid`), 429 (`rate_limited`) or 503 (`unavailable`).
 */
export const createComment = createServerFn({ method: 'POST' })
  .validator((data: CreateCommentInput) => data)
  .handler(async ({ data }): Promise<CreateCommentResult> => {
    // 1. Validate.
    const input = inputSchema.safeParse(data)
    if (!input.success) {
      const fieldErrors: { name?: string; comment?: string } = {}
      for (const issue of input.error.issues) {
        const field = issue.path[0]
        if (field === 'name' || field === 'comment') {
          fieldErrors[field] ??= issue.message
        }
      }
      setResponseStatus(400)
      return {
        ok: false,
        code: 'invalid',
        message:
          Object.values(fieldErrors)[0] ??
          'Não foi possível enviar o comentário.',
        fieldErrors,
      }
    }
    const { route, name, comment } = input.data

    // 2. Honeypot: a filled field means a bot. Answer exactly as for a success
    // (same shape, same status) but store and send nothing.
    const honeypot = input.data[HONEYPOT_FIELD]
    if (
      typeof honeypot === 'string' ? honeypot.trim() !== '' : honeypot != null
    ) {
      return {
        ok: true,
        comment: {
          id: Math.floor(Math.random() * 2_000_000_000) + 1,
          name,
          comment,
          createdAt: Date.now(),
        },
      }
    }

    // 3. Rate limit: 5 comments per 10 minutes per client address, unless
    // COMMENT_RATE_LIMIT_MAX and COMMENT_RATE_LIMIT_WINDOW_SECONDS say
    // otherwise. Counted in this process's memory, which is enough for one
    // always-on machine.
    const limited = takeRateLimit('create-comment', getRequest(), {
      limit: positiveInt(process.env.COMMENT_RATE_LIMIT_MAX, 5),
      windowMs:
        positiveInt(process.env.COMMENT_RATE_LIMIT_WINDOW_SECONDS, 10 * 60) *
        1000,
    })
    if (!limited.allowed) {
      setResponseStatus(429)
      return {
        ok: false,
        code: 'rate_limited',
        message: 'Muitos comentários em pouco tempo. Tente de novo mais tarde.',
        retryAfterSeconds: Math.ceil(limited.retryAfterMs / 1000),
      }
    }

    // 4. Store.
    let created: CommentView
    try {
      created = toCommentView(
        await prisma.comment.create({
          data: { route, name, comment },
          select: commentViewSelect,
        }),
      )
    } catch (error) {
      console.error('Saving a comment failed:', error)
      setResponseStatus(503)
      return {
        ok: false,
        code: 'unavailable',
        message:
          'Não foi possível salvar o comentário agora. Tente de novo mais tarde.',
      }
    }

    // 5. Show it to everyone reading the post, and 6. email the owner.
    // Neither can fail or delay the comment, which is already stored.
    broadcastToPost(route, created)
    emailOwner({ route, name, comment })

    return { ok: true, comment: created }
  })

function positiveInt(value: string | undefined, fallback: number) {
  const n = Number.parseInt(value ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

// ---------------------------------------------------------------------------
// Step 5: the live update
// ---------------------------------------------------------------------------

let warnedNoSocketServer = false

/**
 * Emits `comment:created` to the post's socket.io room. Never throws and
 * never waits: the emit is synchronous and any failure is only logged.
 */
function broadcastToPost(route: string, comment: CommentView) {
  try {
    getIO().to(postRoom(route)).emit('comment:created', { route, comment })
  } catch (error) {
    if (globalThis.__blogSocketIO) {
      console.error('Broadcasting a comment failed:', error)
    } else if (!warnedNoSocketServer) {
      // Bare `vite dev` / `vite preview`: no server.js, no socket.io.
      warnedNoSocketServer = true
      console.warn(
        'No socket.io server: comments are saved but not broadcast live.',
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Step 6: the notification email
// ---------------------------------------------------------------------------

interface CommentNotification {
  /** The post's route, `/posts/<slug>`. */
  route: string
  name: string
  comment: string
}

/**
 * Emails the owner about the comment through SendGrid. Fire and forget: it
 * returns nothing to wait for and never throws, so a mail outage cannot fail
 * a comment. Does nothing unless SENDGRID_API_KEY, COMMENT_NOTIFY_TO and
 * COMMENT_NOTIFY_FROM are all set.
 */
function emailOwner(notification: CommentNotification): void {
  const apiKey = process.env.SENDGRID_API_KEY?.trim()
  const to = process.env.COMMENT_NOTIFY_TO?.trim()
  const from = process.env.COMMENT_NOTIFY_FROM?.trim()
  if (!apiKey || !to || !from) return

  void (async () => {
    try {
      const { default: sgMail } = await import('@sendgrid/mail')
      sgMail.setApiKey(apiKey)
      await sgMail.send({ to, from, ...buildEmail(notification) })
    } catch (error) {
      console.error('Comment notification email failed:', error)
    }
  })()
}

function buildEmail({ route, name, comment }: CommentNotification) {
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f\\u2028\\u2029]+', 'g')

/** One line of plain text: control characters (CR, LF, ...) become spaces. */
function singleLine(value: string, max: number) {
  return value.replace(CONTROL_CHARS, ' ').trim().slice(0, max)
}
