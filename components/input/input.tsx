import React from 'react'
import { useSessionContext } from '../session-provider/session-provider'

interface InputProps {
  name: string
  label: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ name, label }, ref) => {
    const { session } = useSessionContext()
    return (
      <div>
        <label htmlFor={name}>{label}</label>
        <input ref={ref} type="text" id={name} name={name} defaultValue={session?.name} required></input>
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
