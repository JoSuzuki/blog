import React, { useEffect, useState } from 'react'

interface Session {
  name: string;
  email: string;
  firstName: string;
  googleId: string;
}

export const SessionContext = React.createContext<{
  session: Session | null
  setSession: (reveal: Session) => void
}>({
  session: null,
  setSession: (_session) => console.error('not implemented'),
})

export const useSessionContext = () => React.useContext(SessionContext)

interface SessionProviderProps {
  children: React.ReactNode
}

export const SessionProvider = ({ children }: SessionProviderProps) => {
  const [session, setSession] = useState<Session | null>(null)
  useEffect(() => {
    fetch(`/api/session`)
      .then((response) => response.json())
      .then((json) => {
        setSession(json.data)
      })
  }, [])

  return (
    <SessionContext.Provider value={{ session, setSession: setSession }}>
      {children}
    </SessionContext.Provider>
  )
}
