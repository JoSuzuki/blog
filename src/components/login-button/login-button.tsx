import { useRef, useState } from 'react'
import { renderGoogleSignInButton } from '~/lib/auth/google-identity'
import { login } from '~/lib/auth/login'
import { useSession } from '~/lib/auth/use-session'
import { reconnectSocket } from '~/lib/realtime/connection'
import { useReload } from '~/lib/use-reload'

// The offset-shadow look the legacy Login button had (a translate on hover and
// press, unlike the `pressable` utility, which moves with top/left).
export const sessionButtonClass =
  'border border-accent px-sm text-accent wght-semibold [box-shadow:1px_1px_0_0_var(--colors-accent)] ' +
  'hover:[transform:translate(-1px,-1px)] hover:[box-shadow:2px_2px_0_0_var(--colors-accent)] ' +
  'active:[transform:translate(1px,1px)] active:[box-shadow:none] disabled:cursor-default'

const LOAD_FAILED =
  'Não foi possível carregar o login do Google. Tente de novo.'
const LOGIN_FAILED = 'Não foi possível fazer login. Tente de novo.'

const LoginButton = () => {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const googleButtonRef = useRef<HTMLDivElement>(null)
  const rendered = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const reload = useReload()
  const { googleClientId } = useSession()

  const handleCredential = async (credential: string) => {
    setError(null)
    try {
      const result = await login({ data: { credential } })
      if (result.ok) {
        dialogRef.current?.close()
        // The cookie is set: the socket connects again as the reader who
        // just logged in, and the loaders run again to render the page for
        // them.
        reconnectSocket()
        await reload()
      } else {
        setError(LOGIN_FAILED)
      }
    } catch {
      setError(LOGIN_FAILED)
    }
  }

  const openDialog = () => {
    setError(null)
    dialogRef.current?.showModal()
    if (rendered.current || !googleButtonRef.current) return
    rendered.current = true
    renderGoogleSignInButton(
      googleButtonRef.current,
      googleClientId,
      (credential) => void handleCredential(credential),
    ).catch(() => {
      rendered.current = false
      setError(LOAD_FAILED)
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={openDialog}
        aria-label="Login"
        className={`relative ${sessionButtonClass}`}
      >
        Login
      </button>
      <dialog
        ref={dialogRef}
        aria-label="Login"
        className="m-auto overflow-hidden border border-accent bg-background p-lg"
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => dialogRef.current?.close()}
          className={`absolute top-0 right-0 py-xs text-sm leading-none ${sessionButtonClass}`}
        >
          X
        </button>
        <div ref={googleButtonRef} />
        {error && (
          <p role="alert" className="mt-sm max-w-[16rem] text-xs text-accent">
            {error}
          </p>
        )}
      </dialog>
    </div>
  )
}

export default LoginButton
