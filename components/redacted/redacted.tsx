import React, { useLayoutEffect, useState } from 'react'

export const REVEAL_KEY = 'redacted'

export const RedactedContext = React.createContext<{
  reveal: boolean
  setReveal: (reveal: boolean) => void
}>({
  reveal: false,
  setReveal: () => console.error('not implemented'),
})

export const useRedactedContext = () => React.useContext(RedactedContext)

interface RedactedProviderProps {
  children: React.ReactNode
}

export const RedactedProvider = ({ children }: RedactedProviderProps) => {
  const [reveal, setRevealState] = useState(false)

  useLayoutEffect(() => {
    const savedReveal = JSON.parse(
      localStorage.getItem(REVEAL_KEY) as string,
    ) as boolean
    setRevealState(savedReveal)
  }, [])

  const setReveal = (updatedReveal: boolean): void => {
    localStorage.setItem(REVEAL_KEY, JSON.stringify(updatedReveal))
    setRevealState(updatedReveal)
  }

  return (
    <RedactedContext.Provider value={{ reveal, setReveal }}>
      {children}
    </RedactedContext.Provider>
  )
}

interface RedactedProps {
  redacted: string
  children: string;
  revealOverwrite?: boolean;
}

const Redacted = ({ children, redacted, revealOverwrite }: RedactedProps) => {
  const { reveal } = useRedactedContext()
  const finalText = reveal || revealOverwrite ? redacted : 'redacted'

  return (
    <span tabIndex={0}>
      {children}
      <span className="popup">{finalText}</span>
      <style jsx>{`
        span {
          position: relative;
          color: var(--colors-text);
          font-family: Space Grotesk, sans-serif;
          text-decoration: none;
          position: relative;
          border: dashed 1px var(--colors-accent);
          cursor: help;
        }
        .popup {
          position: absolute;
          display: block;
          bottom: 0;
          right: 0;
          line-height: 1.15;
          transform: translateY(calc(100% + var(--spaces-sm)));
          background-color: var(--colors-accent);
          clip-path: polygon(99% 0%, 99% 0%, 99% 100%, 99% 100%);
          transition: clip-path 275ms ease;
          padding: var(--spaces-xs) var(--spaces-sm);
          color: var(--colors-background);
          font-weight: bold;
          font-variation-settings: var(--font-weights-bold);
          z-index: 1;
        }
        span:focus-visible .popup {
          opacity: 1;
          clip-path: polygon(1% 0%, 99% 0%, 99% 100%, 1% 100%);
        }
        span:hover .popup {
          opacity: 1;
          clip-path: polygon(1% 0%, 99% 0%, 99% 100%, 1% 100%);
        }
      `}</style>
    </span>
  )
}

export default Redacted
