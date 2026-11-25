import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { z } from 'zod'
import {
  FAILED,
  FormMessage,
  RATE_LIMITED,
  SubmitButton,
  TextField,
  UNAVAILABLE,
  readForm,
} from '~/components/account/fields'
import Article from '~/components/article/article'
import CommonLink from '~/components/common-link/common-link'
import Footer from '~/components/footer/footer'
import Navbar from '~/components/navbar/navbar'
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '~/lib/auth/accounts'
import { resetPassword } from '~/lib/auth/reset-password'
import { reconnectSocket } from '~/lib/realtime/connection'
import { useReload } from '~/lib/use-reload'

const searchSchema = z.object({
  token: z.string().optional().catch(undefined),
})

// The page the link of a password reset email opens: choose a new password,
// which also logs the reader in.
export const Route = createFileRoute('/redefinir-senha')({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: 'Redefinir senha | JoSuzuki' },
      { name: 'robots', content: 'noindex' },
      { name: 'referrer', content: 'no-referrer' },
    ],
  }),
  component: ResetPassword,
})

const INVALID =
  'Este link não vale mais (já foi usado ou passou de 1 hora). Peça outro em Login → “Esqueci minha senha”.'

function ResetPassword() {
  const { token } = Route.useSearch()
  const reload = useReload()
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(token ? null : INVALID)
  const [linkDead, setLinkDead] = useState(!token)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!token || pending) return
    const { password, confirmation } = readForm(event.currentTarget)
    if (password !== confirmation) {
      setError('As duas senhas não são iguais.')
      return
    }
    setPending(true)
    setError(null)
    try {
      const result = await resetPassword({ data: { token, password } })
      if (result.ok) {
        reconnectSocket()
        await reload()
        setDone(result.user.firstName)
        return
      }
      if (result.error === 'invalid_token') setLinkDead(true)
      setError(
        {
          invalid: `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
          invalid_token: INVALID,
          rate_limited: RATE_LIMITED,
          unavailable: UNAVAILABLE,
        }[result.error],
      )
    } catch {
      setError(FAILED)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Navbar />
      <Article>
        <h1>Redefinir senha</h1>
        <div className="flex w-full max-w-[22rem] flex-col gap-md">
          {done !== null ? (
            <FormMessage tone="info">
              Pronto, {done}! Sua nova senha está valendo e você já entrou.{' '}
              <CommonLink href="/games">Ver os jogos →</CommonLink>
            </FormMessage>
          ) : linkDead ? (
            error && <FormMessage tone="error">{error}</FormMessage>
          ) : (
            <form
              onSubmit={(event) => void submit(event)}
              className="flex flex-col gap-sm"
            >
              <TextField
                name="password"
                label="Nova senha"
                type="password"
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
                hint={`Pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`}
              />
              <TextField
                name="confirmation"
                label="Repita a nova senha"
                type="password"
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                maxLength={PASSWORD_MAX_LENGTH}
              />
              {error && <FormMessage tone="error">{error}</FormMessage>}
              <div className="mt-xs">
                <SubmitButton pending={pending}>Salvar e entrar</SubmitButton>
              </div>
            </form>
          )}
        </div>
        <Footer />
      </Article>
    </>
  )
}
