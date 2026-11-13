interface ButtonProps {
  type: 'button' | 'submit' | 'reset'
  children: string
}

const Button = ({ type, children }: ButtonProps) => {
  return (
    <button
      type={type}
      className="pressable border border-accent px-sm py-xs text-text"
    >
      {children}
    </button>
  )
}

export default Button
