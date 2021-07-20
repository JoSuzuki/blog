import { FormEventHandler, useRef } from 'react'
import Button from '../button/button'
import Input from '../input/input'
import TextArea from '../text-area/text-area'

interface CommentFormProps {
  onSubmit: (name: string, comment: string) => void
}

const CommentForm = ({ onSubmit }: CommentFormProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit: FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault()
    if (inputRef.current && textAreaRef.current) {
      onSubmit(inputRef.current.value, textAreaRef.current.value)
      inputRef.current.value = ''
      textAreaRef.current.value = ''
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Input ref={inputRef} name="name" label="Nome"></Input>
      <TextArea ref={textAreaRef} name="comment" label="Comentário"></TextArea>
      <div className="button-container">
        <Button type="submit">Comentar</Button>
      </div>
      <style jsx>{`
        .button-container {
          display: flex;
          justify-content: flex-end;
          margin-top: var(--spaces-sm);
        }
      `}</style>
    </form>
  )
}

export default CommentForm
