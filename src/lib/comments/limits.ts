// Shared by the form (maxLength, hints) and the server's validation. The
// longest imported name is 23 characters and the longest comment 701.
export const NAME_MAX_LENGTH = 80
export const COMMENT_MAX_LENGTH = 2000

/** Name of the honeypot field in the comment form. Real users never see it. */
export const HONEYPOT_FIELD = 'website'
