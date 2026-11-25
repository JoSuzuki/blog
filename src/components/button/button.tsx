interface ButtonProps {
  type: 'button' | 'submit' | 'reset'
  children: string
  onClick?: () => void
  disabled?: boolean
  testId?: string
}

const Button = ({ type, children, onClick, disabled, testId }: ButtonProps) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="pressable border border-accent px-sm py-xs text-accent disabled:opacity-50"
    >
      {children}
    </button>
  )
}

export default Button
