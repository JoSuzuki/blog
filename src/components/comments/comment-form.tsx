import { useRef, useState } from 'react'
import type { FormEventHandler } from 'react'
import Button from '~/components/button/button'
import Input from '~/components/input/input'
import TextArea from '~/components/text-area/text-area'
import { useSession } from '~/lib/auth/use-session'
import {
  COMMENT_MAX_LENGTH,
  HONEYPOT_FIELD,
  NAME_MAX_LENGTH,
} from '~/lib/comments/comment'
import { createComment } from '~/lib/comments/create-comment'

interface CommentFormProps {
  route: string
  /** Called after the comment was stored, to load the list again. */
  onCreated: () => Promise<void>
}

const CommentForm = ({ route, onCreated }: CommentFormProps) => {
  const formRef = useRef<HTMLFormElement>(null)
  // A ref as well as state: two quick clicks can land before a re-render.
  const sending = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { user } = useSession()

  const handleSubmit: FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault()
    if (sending.current) return
    sending.current = true
    setSubmitting(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    try {
      const result = await createComment({
        data: {
          route,
          name: String(form.get('name') ?? ''),
          comment: String(form.get('comment') ?? ''),
          [HONEYPOT_FIELD]: String(form.get(HONEYPOT_FIELD) ?? ''),
        },
      })
      if (result.ok) {
        formRef.current?.reset()
        await onCreated()
      } else {
        setError(result.message)
      }
    } catch {
      setError('Não foi possível enviar o comentário. Tente de novo.')
    } finally {
      sending.current = false
      setSubmitting(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      {/* As on the legacy site, the name starts as the logged-in reader's. */}
      <Input
        name="name"
        label="Nome"
        maxLength={NAME_MAX_LENGTH}
        defaultValue={user?.name}
      />
      <TextArea
        name="comment"
        label="Comentário"
        maxLength={COMMENT_MAX_LENGTH}
      />
      {/* Honeypot: invisible and unreachable for people, tempting for bots. */}
      <div
        aria-hidden="true"
        className="absolute -left-[10000px] h-px w-px overflow-hidden"
      >
        <label htmlFor={HONEYPOT_FIELD}>Não preencha este campo</label>
        <input
          type="text"
          id={HONEYPOT_FIELD}
          name={HONEYPOT_FIELD}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      {error && (
        <p
          role="alert"
          className="mb-sm text-accent"
          data-testid="comment-error"
        >
          {error}
        </p>
      )}
      <div className="mt-sm flex items-center justify-between gap-md">
        <span className="text-xs text-text/70">
          Até {NAME_MAX_LENGTH} caracteres no nome e {COMMENT_MAX_LENGTH} no
          comentário.
        </span>
        <Button type="submit" disabled={submitting}>
          Comentar
        </Button>
      </div>
    </form>
  )
}

export default CommentForm
