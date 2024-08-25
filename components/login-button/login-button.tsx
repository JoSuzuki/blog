import { useEffect, useRef } from 'react'
import { useRedactedContext } from '../redacted/redacted'
import { useSessionContext } from '../session-provider/session-provider'

const LoginButton = () => {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const loadedScript = useRef<boolean>(false)
  const { setSession } = useSessionContext();
  const { reveal } = useRedactedContext();

  const openDialog = () => {
    dialogRef.current?.showModal();

    if (loadedScript.current) return;

    let script = document.createElement('script');
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true;
    script.defer = true;

    let googleLoadElement = document.createElement('div');
    googleLoadElement.setAttribute("id", "g_id_onload")
    googleLoadElement.setAttribute("data-client_id", "464384148013-0lakedv6kgvi61su00ohotbihk0468ri.apps.googleusercontent.com")
    googleLoadElement.setAttribute("data-context", "signin")
    googleLoadElement.setAttribute("data-ux_mode", "popup")
    googleLoadElement.setAttribute("data-callback", "login")
    googleLoadElement.setAttribute("data-auto_prompt", "false")

    let googleButton = document.createElement('div');
    googleButton.setAttribute("class", "g_id_signin")
    googleButton.setAttribute("data-type", "standard")
    googleButton.setAttribute("data-shape", "rectangular")
    googleButton.setAttribute("data-theme", "filled_black")
    googleButton.setAttribute("data-text", "signin_with")
    googleButton.setAttribute("data-size", "medium")
    googleButton.setAttribute("data-logo_alignment", "left")

    dialogRef.current?.appendChild(googleButton)
    dialogRef.current?.appendChild(googleLoadElement)

    buttonRef.current?.parentNode?.appendChild(script)
    loadedScript.current = true;
  }
  const closeDialog = () => {
    dialogRef.current?.close()
  }

  useEffect(() => {
    // @ts-ignore
    window.login = (payload: { credential: string }) => {
      fetch("/api/login", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ credential: payload.credential, secret: reveal }),
      })
        .then((response) => response.json())
        .then((json) => {
          if (json.error) {
            alert(`Login falhou avisa o Jo pls, error: ${json.error}`)
          } else {
            setSession(json.data)
            closeDialog();
          }
        })
    }
  }, [])

  return (
    <div>
      <button
        onClick={openDialog}
        aria-label="Login"
        ref={buttonRef}
      >
        Login
      </button>
      <script src="https://accounts.google.com/gsi/client" async defer></script>

      <dialog ref={dialogRef}>
        <button autoFocus className="close" aria-label="Fechar" onClick={closeDialog}>X</button>
      </dialog>
      <style jsx>{`
        button {
          position: relative;
          border: 1px solid var(--colors-accent);
          color: var(--colors-accent);
          box-shadow: 1px 1px 0px 0px var(--colors-accent);
          font-variation-settings: var(--font-weights-semibold);
          padding-inline: var(--spaces-sm)
        }
        button:hover {
          transform: translate(-1px, -1px);
          box-shadow: 2px 2px 0px 0px var(--colors-accent);
        }
        button:active {
          transform: translate(1px, 1px);
          box-shadow: none;
        }
        .close {
          top: 0;
          right: 0;
          position: absolute;
          padding-inline: var(--spaces-sm);
          padding-block: var(--spaces-xs);
          line-height: 1;
          font-size: var(--font-sizes-sm)
        }
        dialog {
          background-color: var(--colors-background);
          border: 1px solid var(--colors-accent);
          padding: var(--spaces-lg);
          overflow: hidden;
        }
      `}</style>
    </div >
  )
}

export default LoginButton
