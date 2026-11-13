import { createContext, useContext, useLayoutEffect, useState } from 'react'
import type { ReactNode } from 'react'

export const REVEAL_KEY = 'redacted'

export const RedactedContext = createContext<{
  reveal: boolean
  setReveal: (reveal: boolean) => void
}>({
  reveal: false,
  setReveal: () => console.error('not implemented'),
})

export const useRedactedContext = () => useContext(RedactedContext)

interface RedactedProviderProps {
  children: ReactNode
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
    <RedactedContext value={{ reveal, setReveal }}>{children}</RedactedContext>
  )
}

interface RedactedProps {
  redacted: string
  children: ReactNode
  revealOverwrite?: boolean
}

// A hover/focus popup that shows the real text only once the reader has turned
// the reveal flag on. The legacy styles targeted every `span` in the component,
// so the popup also carries the dashed border, font and help cursor.
const Redacted = ({ children, redacted, revealOverwrite }: RedactedProps) => {
  const { reveal } = useRedactedContext()
  const finalText = reveal || revealOverwrite ? redacted : 'redacted'

  return (
    <span
      tabIndex={0}
      className="group relative cursor-help border border-dashed border-accent font-grotesk text-text no-underline"
    >
      {children}
      <span
        className={
          'absolute right-0 bottom-0 z-[1] block translate-y-[calc(100%+var(--spaces-sm))] cursor-help border border-dashed border-accent bg-accent px-sm py-xs leading-[1.15] font-bold text-background wght-bold ' +
          '[clip-path:polygon(99%_0%,99%_0%,99%_100%,99%_100%)] [transition:clip-path_275ms_ease] ' +
          'group-hover:[clip-path:polygon(1%_0%,99%_0%,99%_100%,1%_100%)] group-focus-visible:[clip-path:polygon(1%_0%,99%_0%,99%_100%,1%_100%)]'
        }
      >
        {finalText}
      </span>
    </span>
  )
}

export default Redacted
