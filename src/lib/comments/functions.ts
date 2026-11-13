import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import {
  createCommentAction,
  listCommentsAction,
  registerHitAction,
} from './service.server'
import type { CreateCommentResult } from './service.server'

// Server functions are plain HTTP endpoints. They are same-origin only: Start's
// CSRF middleware (src/start.ts) refuses requests whose Sec-Fetch-Site, Origin
// or Referer is not this site. The `validator`s below only give the callers
// types; the real validation (zod) runs in the actions in service.server.ts,
// which answer a bad request with HTTP 400 and a result object instead of
// throwing.

export type { CreateCommentResult }

interface RouteInput {
  route: string
}

interface CommentInput extends RouteInput {
  name: string
  comment: string
  /** Honeypot: always sent empty by the form. */
  website?: string
}

export const getComments = createServerFn({ method: 'GET' })
  .validator((data: RouteInput) => data)
  .handler(({ data }) => listCommentsAction(data))

export const createComment = createServerFn({ method: 'POST' })
  .validator((data: CommentInput) => data)
  .handler(({ data }) => createCommentAction(data, getRequest()))

export const registerHit = createServerFn({ method: 'POST' })
  .validator((data: RouteInput) => data)
  .handler(({ data }) => registerHitAction(data))
