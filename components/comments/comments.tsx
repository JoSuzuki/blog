import { useEffect, useState } from 'react'
import formatDate from '../../utils/format-date'
import usePagesContext from '../use-pages-context/use-pages-context'
import CommentForm from './comment-form'

interface Comment {
  name: string
  comment: string
  createdAt: number
}

const Comments = () => {
  const { currentPage } = usePagesContext()
  const [comments, setComments] = useState<Comment[] | null>(null)
  useEffect(() => {
    fetch(`/api/comments?route=${currentPage.route}`)
      .then((response) => response.json())
      .then((json) => setComments(json.data))
  }, [])

  const handleSubmit = (name: string, comment: string) => {
    fetch(`/api/create-comment?route=${currentPage.route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        comment,
      }),
    })
      .then((response) => response.json())
      .then((json) => {
        setComments(json.data)
      })
  }

  return (
    <div className="comments-container">
      <h3>Comentários</h3>
      <ol>
        {comments?.map((comment) => (
          <li key={comment.comment} className="comment-container">
            <div className="comment-info">
              <div className="name">{comment.name}</div>
              <div className="dot"></div>
              <div className="time">{formatDate(comment.createdAt)}</div>
            </div>
            <div className="comment">{comment.comment}</div>
          </li>
        ))}
      </ol>
      <div>
        <CommentForm onSubmit={handleSubmit} />
      </div>
      <style jsx>{`
        .dot {
          border-radius: 50%;
          width: 5px;
          height: 5px;
          background-color: var(--colors-dimmed);
          margin-right: var(--spaces-sm);
          margin-left: var(--spaces-sm);
        }
        .name {
          font-variation-settings: var(--font-weights-bold);
        }
        .time {
          font-size: var(--font-sizes-sm);
        }
        .comments-container {
          margin: var(--spaces-md);
        }
        .comment-container {
          margin-bottom: var(--spaces-md);
        }
        .comment-info {
          display: flex;
          align-items: center;
          color: var(--colors-accent);
          font-size: var(--font-sizes-md);
        }
      `}</style>
    </div>
  )
}

export default Comments
