import { useRef, useState } from 'react'
import { buttonClass } from '~/components/button/button'
import type { FormEvent } from 'react'
import {
  FAILED,
  FormMessage,
  RATE_LIMITED,
  SubmitButton,
  TextButton,
  TextField,
  UNAVAILABLE,
  readForm,
} from '~/components/account/fields'
import {
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '~/lib/auth/accounts'
import { renderGoogleSignInButton } from '~/lib/auth/google-identity'
import { login } from '~/lib/auth/login'
import { loginWithPassword } from '~/lib/auth/login-with-password'
import { requestPasswordReset } from '~/lib/auth/request-password-reset'
import { signUp } from '~/lib/auth/sign-up'
import { useSession } from '~/lib/auth/use-session'
import { reconnectSocket } from '~/lib/realtime/connection'
import { useReload } from '~/lib/use-reload'

/** The top bar's buttons (Login, Perfil, Sair). */
export const sessionButtonClass = buttonClass({ size: 'compact' })

const LOAD_FAILED =
  'Não foi possível carregar o login do Google. Use email e senha ou tente de novo.'
const LOGIN_FAILED = 'Não foi possível fazer login. Tente de novo.'

type Mode = 'login' | 'signup' | 'forgot'

const TITLES: Record<Mode, string> = {
  login: 'Entrar',
  signup: 'Criar conta',
  forgot: 'Esqueci minha senha',
}

type Message = { tone: 'error' | 'info'; text: string } | null

/**
 * The Login button and its dialog: Google, or an email and password (log
 * in, create an account, or get a link to reset the password).
 */
const LoginButton = () => {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const googleButtonRef = useRef<HTMLDivElement>(null)
  const rendered = useRef(false)
  const [mode, setMode] = useState<Mode>('login')
  const [message, setMessage] = useState<Message>(null)
  const [pending, setPending] = useState(false)
  const reload = useReload()
  const { googleClientId } = useSession()

  /** The cookie is set: reconnect the socket as this reader and reload. */
  const loggedIn = async () => {
    dialogRef.current?.close()
    reconnectSocket()
    await reload()
  }

  const handleCredential = async (credential: string) => {
    setMessage(null)
    try {
      const result = await login({ data: { credential } })
      if (result.ok) await loggedIn()
      else setMessage({ tone: 'error', text: LOGIN_FAILED })
    } catch {
      setMessage({ tone: 'error', text: LOGIN_FAILED })
    }
  }

  const switchTo = (next: Mode) => {
    setMode(next)
    setMessage(null)
  }

  const openDialog = () => {
    switchTo('login')
    dialogRef.current?.showModal()
    if (rendered.current || !googleButtonRef.current) return
    rendered.current = true
    renderGoogleSignInButton(
      googleButtonRef.current,
      googleClientId,
      (credential) => void handleCredential(credential),
    ).catch(() => {
      rendered.current = false
      setMessage({ tone: 'error', text: LOAD_FAILED })
    })
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    const form = event.currentTarget
    const fields = readForm(form)
    setPending(true)
    setMessage(null)
    try {
      setMessage(await submitters[mode](fields, form))
    } catch {
      setMessage({ tone: 'error', text: FAILED })
    } finally {
      setPending(false)
    }
  }

  const submitters: Record<
    Mode,
    (fields: Record<string, string>, form: HTMLFormElement) => Promise<Message>
  > = {
    login: async ({ email, password }) => {
      const result = await loginWithPassword({ data: { email, password } })
      if (result.ok) {
        await loggedIn()
        return null
      }
      return {
        wrong_credentials: {
          tone: 'error',
          text: 'Email ou senha incorretos. Se você sempre entrou com o Google, use o botão do Google ou crie uma senha em “Esqueci minha senha”.',
        },
        unverified: {
          tone: 'info',
          text: `Falta confirmar seu email. Enviamos um novo link para ${email}.`,
        },
        rate_limited: { tone: 'error', text: RATE_LIMITED },
        unavailable: { tone: 'error', text: UNAVAILABLE },
      }[result.error] as Message
    },
    signup: async ({ name, email, password }, form) => {
      const result = await signUp({ data: { name, email, password } })
      if (result.ok) {
        form.reset()
        return {
          tone: 'info',
          text: `Quase lá! Enviamos um link para ${email}. Abra-o para confirmar o email e entrar.`,
        }
      }
      return {
        email_taken: {
          tone: 'error',
          text: 'Já existe uma conta com esse email. Entre com ele ou use “Esqueci minha senha”.',
        },
        invalid: {
          tone: 'error',
          text: `Confira os campos: a senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
        },
        rate_limited: { tone: 'error', text: RATE_LIMITED },
        unavailable: { tone: 'error', text: UNAVAILABLE },
      }[result.error] as Message
    },
    forgot: async ({ email }) => {
      const result = await requestPasswordReset({ data: { email } })
      if (result.ok) {
        return {
          tone: 'info',
          text: `Se houver uma conta com ${email}, enviamos um link para criar uma nova senha. Ele vale por 1 hora.`,
        }
      }
      return {
        invalid: { tone: 'error', text: 'Confira o email.' },
        rate_limited: { tone: 'error', text: RATE_LIMITED },
        unavailable: { tone: 'error', text: UNAVAILABLE },
      }[result.error] as Message
    },
  }

  return (
    <div>
      <button
        type="button"
        onClick={openDialog}
        aria-label="Login"
        className={sessionButtonClass}
      >
        Login
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby="login-dialog-title"
        className="m-auto w-[min(22rem,calc(100vw-2rem))] overflow-hidden border border-accent bg-background p-md text-text backdrop:bg-black/50 mobile:p-lg"
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={() => dialogRef.current?.close()}
          className={`absolute top-0 right-0 ${buttonClass({ size: 'sm' })} leading-none`}
        >
          X
        </button>
        <h2 id="login-dialog-title" className="mb-md text-md wght-semibold">
          {TITLES[mode]}
        </h2>

        {/* Kept mounted so the Google button is rendered only once. */}
        <div className={mode === 'forgot' ? 'hidden' : 'mb-md'}>
          <div ref={googleButtonRef} className="min-h-[40px]" />
          <p className="mt-md flex items-center gap-sm text-xs opacity-70">
            <span className="h-px flex-1 bg-current" />
            ou com email
            <span className="h-px flex-1 bg-current" />
          </p>
        </div>

        <form
          key={mode}
          onSubmit={(event) => void submit(event)}
          className="flex flex-col gap-sm"
        >
          {mode === 'signup' && (
            <TextField
              name="name"
              label="Nome"
              type="text"
              autoComplete="name"
              maxLength={NAME_MAX_LENGTH}
            />
          )}
          <TextField
            name="email"
            label="Email"
            type="email"
            autoComplete={mode === 'login' ? 'username' : 'email'}
          />
          {mode !== 'forgot' && (
            <TextField
              name="password"
              label="Senha"
              type="password"
              autoComplete={
                mode === 'signup' ? 'new-password' : 'current-password'
              }
              minLength={mode === 'signup' ? PASSWORD_MIN_LENGTH : undefined}
              maxLength={PASSWORD_MAX_LENGTH}
              hint={
                mode === 'signup'
                  ? `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`
                  : undefined
              }
            />
          )}
          {message && (
            <FormMessage tone={message.tone}>{message.text}</FormMessage>
          )}
          <div className="mt-xs">
            <SubmitButton pending={pending}>
              {
                {
                  login: 'Entrar',
                  signup: 'Criar conta',
                  forgot: 'Enviar link',
                }[mode]
              }
            </SubmitButton>
          </div>
        </form>

        <div className="mt-md flex flex-wrap justify-between gap-x-md gap-y-xs">
          {mode === 'login' ? (
            <>
              <TextButton onClick={() => switchTo('signup')}>
                Criar conta
              </TextButton>
              <TextButton onClick={() => switchTo('forgot')}>
                Esqueci minha senha
              </TextButton>
            </>
          ) : (
            <TextButton onClick={() => switchTo('login')}>
              Já tenho conta: entrar
            </TextButton>
          )}
        </div>
      </dialog>
    </div>
  )
}

export default LoginButton
