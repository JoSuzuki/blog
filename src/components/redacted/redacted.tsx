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
