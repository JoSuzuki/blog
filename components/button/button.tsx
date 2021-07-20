interface ButtonProps {
  type: 'button' | 'submit' | 'reset'
  children: string
}

const Button = ({ type, children }: ButtonProps) => {
  return (
    <button type={type}>
      {children}
      <style jsx>{`
        button {
          position: relative;
          color: var(--colors-text);
          padding: var(--spaces-xs) var(--spaces-sm);
          border: 1px solid var(--colors-accent);
          box-shadow: 1px 1px 0px 0px var(--colors-accent);
        }
        button:hover {
          top: -1px;
          left: -1px;
          box-shadow: 2px 2px 0px 0px var(--colors-accent);
        }
        button:active {
          top: 1px;
          left: 1px;
          box-shadow: none;
        }
      `}</style>
    </button>
  )
}

export default Button
