interface ButtonProps {
  type: 'button' | 'submit' | 'reset'
  children: string
  onClick?: () => void
  disabled?: boolean
}

const Button = ({ type, children, onClick, disabled }: ButtonProps) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="pressable border border-accent px-sm py-xs text-text"
    >
      {children}
    </button>
  )
}

export default Button
