import type { Ref } from 'react'

interface TextAreaProps {
  name: string
  label: string
  ref?: Ref<HTMLTextAreaElement>
}

const TextArea = ({ name, label, ref }: TextAreaProps) => {
  return (
    <div>
      <label htmlFor={name} className="block">
        {label}
      </label>
      <textarea
        ref={ref}
        id={name}
        name={name}
        required
        className="mb-sm block w-full border border-accent bg-transparent"
      />
    </div>
  )
}

export default TextArea
