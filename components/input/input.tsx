import React from 'react'

interface InputProps {
  name: string
  label: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ name, label }, ref) => {
    return (
      <div>
        <label htmlFor={name}>{label}</label>
        <input ref={ref} type="text" id={name} name={name} required></input>
        <style jsx>{`
          input,
          label {
            display: block;
          }
          input {
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

export default Input
