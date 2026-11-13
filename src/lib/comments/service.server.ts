import { setResponseStatus } from '@tanstack/react-start/server'
import { z } from 'zod'
import { getPosts } from '~/content/posts'
import { broadcastComment } from './broadcast.server'
import { incrementHits, insertComment, listComments } from './comments.server'
import type { CommentView } from './comments.server'
import { COMMENT_MAX_LENGTH, HONEYPOT_FIELD, NAME_MAX_LENGTH } from './limits'
import { notifyComment } from './notify.server'
import { createRateLimiter, getClientKey } from './rate-limit.server'

// The server-side logic behind the server functions in functions.ts, which
// only forward to these. Keeping it in a `.server` module means none of it (nor
// its imports) can reach the client bundle.

const routeSchema = z
  .string()
  .refine(
    (route) => getPosts({ includeSecret: true }).some((p) => p.route === route),
    {
      message: 'Unknown post',
    },
  )

const commentInputSchema = z.object({
  route: routeSchema,
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
  // Honeypot: optional and untyped so a bot's value never fails validation.
  [HONEYPOT_FIELD]: z.unknown().optional(),
})

const routeInputSchema = z.object({ route: routeSchema })

const positiveInt = (value: string | undefined, fallback: number) => {
  const n = Number.parseInt(value ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

/**
 * Per client address (see getClientKey): 5 comments per 10 minutes by default,
 * at most 5000 clients remembered. Held in this process's memory, which is
 * enough for one always-on machine. COMMENT_RATE_LIMIT_MAX and
 * COMMENT_RATE_LIMIT_WINDOW_SECONDS override the defaults.
 */
const commentLimiter = createRateLimiter({
  limit: positiveInt(process.env.COMMENT_RATE_LIMIT_MAX, 5),
  windowMs:
    positiveInt(process.env.COMMENT_RATE_LIMIT_WINDOW_SECONDS, 10 * 60) * 1000,
  maxKeys: 5000,
})

export type CommentErrorCode = 'invalid' | 'rate_limited' | 'unavailable'

export type CreateCommentResult =
  | { ok: true; comment: CommentView }
  | {
      ok: false
      code: CommentErrorCode
      message: string
      /** Per-field messages when `code` is `invalid`. */
      fieldErrors?: { name?: string; comment?: string }
      retryAfterSeconds?: number
    }

const logUnavailable = (what: string, error: unknown) =>
  console.error(`${what} failed:`, error)

export const listCommentsAction = async (input: unknown) => {
  const parsed = routeInputSchema.safeParse(input)
  if (!parsed.success) {
    setResponseStatus(400)
    return { ok: false as const }
  }
  try {
    return {
      ok: true as const,
      comments: await listComments(parsed.data.route),
    }
  } catch (error) {
    logUnavailable('Listing comments', error)
    setResponseStatus(503)
    return { ok: false as const }
  }
}

export const registerHitAction = async (input: unknown) => {
  const parsed = routeInputSchema.safeParse(input)
  if (!parsed.success) {
    setResponseStatus(400)
    return { hits: null }
  }
  try {
    return { hits: await incrementHits(parsed.data.route) }
  } catch (error) {
    logUnavailable('Registering a hit', error)
    setResponseStatus(503)
    return { hits: null }
  }
}

export const createCommentAction = async (
  input: unknown,
  request: Request,
): Promise<CreateCommentResult> => {
  const parsed = commentInputSchema.safeParse(input)
  if (!parsed.success) {
    setResponseStatus(400)
    const fieldErrors: { name?: string; comment?: string } = {}
    for (const issue of parsed.error.issues) {
      const field = issue.path[0]
      if (field === 'name' || field === 'comment') {
        fieldErrors[field] ??= issue.message
      }
    }
    return {
      ok: false,
      code: 'invalid',
      message:
        Object.values(fieldErrors)[0] ??
        'Não foi possível enviar o comentário.',
      fieldErrors,
    }
  }
  const { route, name, comment } = parsed.data

  // Honeypot: a filled field means a bot. Answer exactly as for a success
  // (same shape, same status) but store and send nothing.
  const honeypot = parsed.data[HONEYPOT_FIELD]
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

  const limited = commentLimiter.take(getClientKey(request))
  if (!limited.allowed) {
    const retryAfterSeconds = Math.ceil(limited.retryAfterMs / 1000)
    setResponseStatus(429)
    return {
      ok: false,
      code: 'rate_limited',
      message: 'Muitos comentários em pouco tempo. Tente de novo mais tarde.',
      retryAfterSeconds,
    }
  }

  let created: CommentView
  try {
    created = await insertComment({ route, name, comment })
  } catch (error) {
    logUnavailable('Saving a comment', error)
    setResponseStatus(503)
    return {
      ok: false,
      code: 'unavailable',
      message:
        'Não foi possível salvar o comentário agora. Tente de novo mais tarde.',
    }
  }

  broadcastComment(route, created)

  notifyComment({ route, name, comment })

  return { ok: true, comment: created }
}
