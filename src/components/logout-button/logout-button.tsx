import { useState } from 'react'
import { sessionButtonClass } from '~/components/login-button/login-button'
import Redacted from '~/components/redacted/redacted'
import { useSessionContext } from '~/components/session-provider/session-provider'
import { logout } from '~/lib/auth/logout'

// The legacy site only greeted the logged-in reader and had no way to log
// out. The greeting is kept as it was; the Sair (log out) button clears the session
// cookie on the server and then the session here.
const LogoutButton = () => {
  const { session, setSession } = useSessionContext()
  const [pending, setPending] = useState(false)

  const handleLogout = async () => {
    setPending(true)
    try {
      await logout()
      setSession(null)
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex items-center gap-x-md">
      {/*
        Below 768px the greeting does not fit beside the site name (which
        starts as the full "Jonathan Suzuki" on the home page) and the buttons.
      */}
      <div className="hidden whitespace-nowrap tablet:block">
        Hey,{' '}
        <Redacted
          revealOverwrite={true}
          redacted="Não tem nada de especial que dá pra fazer logado ainda :)"
        >{`${session?.firstName}`}</Redacted>
        !
      </div>
      <button
        type="button"
        onClick={() => void handleLogout()}
        disabled={pending}
        aria-label="Sair"
        className={`relative ${sessionButtonClass}`}
      >
        Sair
      </button>
    </div>
  )
}

export default LogoutButton
