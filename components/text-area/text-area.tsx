import React from 'react'

interface TextAreaProps {
  name: string
  label: string
}

const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ name, label }, ref) => {
    return (
      <div>
        <label htmlFor={name}>{label}</label>
        <textarea ref={ref} id={name} name={name} required></textarea>
        <style jsx>{`
          textarea,
          label {
            display: block;
          }
          textarea {
            width: 100%;
            background-color: transparent;
            border: 1px solid var(--colors-accent);
            margin-bottom: var(--spaces-sm);
          }
        `}</style>
      </div>
    )
  },
)

export default TextArea
