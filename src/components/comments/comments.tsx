import { useEffect, useState } from 'react'
import { getComments } from '~/lib/comments/functions'
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
 * A post's comments and the form to add one. The comments are fetched from the
 * browser after mount (as the legacy component did), not in the route loader:
 * the page then never waits on the database or fails with it.
 */
const Comments = ({ route }: { route: string }) => {
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    getComments({ data: { route } })
      .then((result) => {
        if (cancelled) return
        setState(
          result.ok
            ? { status: 'ready', comments: result.comments }
            : { status: 'failed' },
        )
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'failed' })
      })
    return () => {
      cancelled = true
    }
  }, [route])

  const handleCreated = (comment: CommentView) =>
    setState((current) => ({
      status: 'ready',
      comments:
        current.status === 'ready' ? [...current.comments, comment] : [comment],
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
