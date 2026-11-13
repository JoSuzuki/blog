/** The socket.io room that receives a post's live events. */
export const postRoom = (route: string) => `post:${route}`

/** At most this many post rooms per socket (a page needs one, a navigation briefly two). */
export const MAX_POST_ROOMS_PER_SOCKET = 3
