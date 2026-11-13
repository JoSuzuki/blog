import type { Ref } from 'react'

interface TextAreaProps {
  name: string
  label: string
  maxLength?: number
  ref?: Ref<HTMLTextAreaElement>
}

const TextArea = ({ name, label, maxLength, ref }: TextAreaProps) => {
  return (
    <div>
      <label htmlFor={name} className="block">
        {label}
      </label>
      <textarea
        ref={ref}
        id={name}
        name={name}
        maxLength={maxLength}
        required
        className="mb-sm block w-full border border-accent bg-transparent"
      />
    </div>
  )
}

export default TextArea
