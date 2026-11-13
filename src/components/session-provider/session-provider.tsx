import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import type { SessionState, SessionUser } from '~/lib/auth/types'

// The logged-in user, for components. The initial value comes from the root
// route's loader, which reads the session cookie on the server during the page
// request, so the server-rendered HTML and the first client render already
// agree (no Login → Logout flash, no hydration mismatch). Login and logout
// update it in place.

interface SessionContextValue {
  session: SessionUser | null
  setSession: (session: SessionUser | null) => void
  googleClientId: string
}

export const SessionContext = createContext<SessionContextValue>({
  session: null,
  setSession: () => console.error('not implemented'),
  googleClientId: '',
})

export const useSessionContext = () => useContext(SessionContext)

interface SessionProviderProps {
  initial: SessionState | undefined
  children: ReactNode
}

export const SessionProvider = ({
  initial,
  children,
}: SessionProviderProps) => {
  const [session, setSession] = useState<SessionUser | null>(
    initial?.user ?? null,
  )
  return (
    <SessionContext
      value={{
        session,
        setSession,
        googleClientId: initial?.googleClientId ?? '',
      }}
    >
      {children}
    </SessionContext>
  )
}
