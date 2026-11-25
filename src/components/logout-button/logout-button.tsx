import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { sessionButtonClass } from '~/components/login-button/login-button'
import Redacted from '~/components/redacted/redacted'
import { logout } from '~/lib/auth/logout'
import { useSession } from '~/lib/auth/use-session'
import { reconnectSocket } from '~/lib/realtime/connection'
import { useReload } from '~/lib/use-reload'

/**
 * Sair: clears the session cookie on the server, reconnects the socket as a
 * visitor and runs the loaders again. In the top bar from 768px up, and on
 * /perfil (where phones find it).
 */
export const SignOutButton = ({ className = '' }: { className?: string }) => {
  const reload = useReload()
  const [pending, setPending] = useState(false)

  const handleLogout = async () => {
    setPending(true)
    try {
      await logout()
      reconnectSocket()
      await reload()
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={pending}
      aria-label="Sair"
      className={`${sessionButtonClass} ${className}`}
    >
      Sair
    </button>
  )
}

// The legacy site only greeted the logged-in reader and had no way to log
// out. The greeting is kept (with the reader's nickname), Perfil opens
// /perfil, and Sair logs out.
const LogoutButton = () => {
  const { displayName } = useSession()

  return (
    <div className="flex items-center gap-x-md">
      {/*
        Below 768px only Perfil fits beside the site name (which starts as
        the full "Jonathan Suzuki" on the home page): the greeting is hidden
        and Sair moves to /perfil.
      */}
      <div className="hidden whitespace-nowrap tablet:block">
        Hey,{' '}
        <Redacted
          revealOverwrite={true}
          redacted="Agora dá pra jogar joguinhos logado :)"
        >
          {displayName ?? ''}
        </Redacted>
        !
      </div>
      <Link to="/perfil" aria-label="Perfil" className={sessionButtonClass}>
        Perfil
      </Link>
      <span className="hidden tablet:block">
        <SignOutButton />
      </span>
    </div>
  )
}

export default LogoutButton
