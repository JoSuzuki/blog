import { useEffect, useState } from 'react'
import { getComments } from '~/lib/comments/functions'
import { subscribeToPost } from '~/lib/realtime/post-socket'
import type { CommentView } from '~/lib/comments/comments.server'
import CommentForm from './comment-form'

const formatDate = (time: number) => {
  const date = new Date(time)
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
}

type State =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; comments: CommentView[] }

/**
 * Adds comments to a list that is ordered the way the server orders it
 * (oldest first, then by id), skipping the ones already in it. The author's
 * own comment arrives twice (the server function's response and the live
 * event, in either order); this is what makes it appear once.
 */
const mergeComments = (current: CommentView[], incoming: CommentView[]) => {
  const known = new Set(current.map((c) => c.id))
  const added = incoming.filter((c) => !known.has(c.id))
  if (added.length === 0) return current
  return [...current, ...added].sort(
    (a, b) => a.createdAt - b.createdAt || a.id - b.id,
  )
}

/**
 * A post's comments and the form to add one. The comments are fetched from the
 * browser after mount (as the legacy component did), not in the route loader:
 * the page then never waits on the database or fails with it.
 */
const Comments = ({ route }: { route: string }) => {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    const load = () =>
      getComments({ data: { route } })
        .then((result) => {
          if (cancelled) return
          setState((current) =>
            result.ok
              ? {
                  status: 'ready',
                  comments:
                    current.status === 'ready'
                      ? mergeComments(current.comments, result.comments)
                      : result.comments,
                }
              : // A failed refetch must not hide what is already shown.
                current.status === 'ready'
                ? current
                : { status: 'failed' },
          )
        })
        .catch(() => {
          if (!cancelled) {
            setState((current) =>
              current.status === 'ready' ? current : { status: 'failed' },
            )
          }
        })
    load()

    // Live comments. Without a socket (blocked, server down) this does
    // nothing and the page behaves as it did without realtime.
    const unsubscribe = subscribeToPost(route, {
      onComment: ({ comment }) =>
        // Until the list has loaded, the load (or the refetch that follows
        // joining the room) brings the comment in.
        setState((current) =>
          current.status === 'ready'
            ? {
                status: 'ready',
                comments: mergeComments(current.comments, [comment]),
              }
            : current,
        ),
      // The socket has joined the room, first time or after a reconnection:
      // refetch so comments posted in between are not missed.
      onSync: load,
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [route])

  const handleCreated = (comment: CommentView) =>
    setState((current) => ({
      status: 'ready',
      comments: mergeComments(
        current.status === 'ready' ? current.comments : [],
        [comment],
      ),
    }))

  const comments = state.status === 'ready' ? state.comments : []

  return (
    <div className="m-md mt-lg" data-testid="comments">
      <h2 className="mb-md text-[1.3rem] [font-variation-settings:'wght'_650]">
        Comentários{state.status === 'ready' && ` (${comments.length})`}
      </h2>
      {state.status === 'failed' && (
        <p className="mb-md text-text/70" data-testid="comments-failed">
          Não foi possível carregar os comentários agora.
        </p>
      )}
      <ol>
        {comments.map((comment) => (
          <li key={comment.id} className="mb-md">
            <div className="flex items-center text-md text-accent">
              <div className="wght-bold">{comment.name}</div>
              <div className="mx-sm size-[5px] rounded-full bg-dimmed" />
              <div className="text-sm">{formatDate(comment.createdAt)}</div>
            </div>
            <div>{comment.comment}</div>
          </li>
        ))}
      </ol>
      <div>
        <CommentForm route={route} onCreated={handleCreated} />
      </div>
    </div>
  )
}

export default Comments
