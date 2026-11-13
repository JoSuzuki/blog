import type { Ref } from 'react'

interface InputProps {
  name: string
  label: string
  defaultValue?: string
  maxLength?: number
  ref?: Ref<HTMLInputElement>
}

const Input = ({ name, label, defaultValue, maxLength, ref }: InputProps) => {
  return (
    <div>
      <label htmlFor={name} className="block">
        {label}
      </label>
      <input
        ref={ref}
        type="text"
        id={name}
        name={name}
        defaultValue={defaultValue}
        maxLength={maxLength}
        required
        className="mb-sm block w-full border border-accent bg-transparent"
      />
    </div>
  )
}

export default Input
