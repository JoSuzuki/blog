import { useEffect } from 'react'
import type { CommentView } from '~/lib/comments/comment'
import { subscribeToPost } from '~/lib/realtime/post-socket'
import { useReload } from '~/lib/use-reload'
import CommentForm from './comment-form'

// The list is rendered on the server as well, so the day shown must not
// depend on where the code runs: Brasília time for every reader.
const dateParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
})

const formatDate = (time: number) => {
  const part = (type: 'day' | 'month' | 'year') =>
    Number(dateParts.formatToParts(time).find((p) => p.type === type)?.value)
  return `${part('day')}/${part('month')}/${part('year')}`
}

interface CommentsProps {
  /** The post's route, `/posts/<slug>`. */
  route: string
  /** From the post route's loader; null when they could not be loaded. */
  comments: CommentView[] | null
}

/**
 * A post's comments and the form to add one. The list is the post route's
 * loader data. Whenever it may have changed (the reader posted a comment,
 * someone else did, the socket reconnected) the loader runs again.
 */
const Comments = ({ route, comments }: CommentsProps) => {
  const reload = useReload('/posts/$slug')

  // Live comments. Without a socket (blocked, server down) this does nothing
  // and the list is as fresh as the last page load.
  useEffect(
    () =>
      subscribeToPost(route, {
        onComment: () => void reload(),
        // The socket has joined the room, first time or after a reconnection:
        // comments posted since the page was rendered would have been missed.
        onSync: () => void reload(),
      }),
    [route, reload],
  )

  return (
    <div className="m-md mt-lg" data-testid="comments">
      <h2 className="mb-md text-[1.3rem] [font-variation-settings:'wght'_650]">
        Comentários{comments && ` (${comments.length})`}
      </h2>
      {!comments && (
        <p className="mb-md text-text/70" data-testid="comments-failed">
          Não foi possível carregar os comentários agora.
        </p>
      )}
      <ol>
        {comments?.map((comment) => (
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
        <CommentForm route={route} onCreated={reload} />
      </div>
    </div>
  )
}

export default Comments
