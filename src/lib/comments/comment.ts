// What a comment is, shared by the form, the comment actions and the socket
// events. No server code here: the browser bundle imports this module.

/** What the page gets for a comment. `createdAt` is milliseconds since the epoch. */
export interface CommentView {
  id: number
  name: string
  comment: string
  createdAt: number
}

/** The columns of a `Comment` row that a CommentView needs (a Prisma `select`). */
export const commentViewSelect = {
  id: true,
  name: true,
  comment: true,
  createdAt: true,
} as const

export const toCommentView = (row: {
  id: number
  name: string
  comment: string
  createdAt: Date
}): CommentView => ({
  id: row.id,
  name: row.name,
  comment: row.comment,
  createdAt: row.createdAt.getTime(),
})

// Shared by the form (maxLength, hints) and the server's validation. The
// longest imported name is 23 characters and the longest comment 701.
export const NAME_MAX_LENGTH = 80
export const COMMENT_MAX_LENGTH = 2000

/** Name of the honeypot field in the comment form. Real users never see it. */
export const HONEYPOT_FIELD = 'website'
