import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { z } from 'zod'
import {
  FAILED,
  FormMessage,
  RATE_LIMITED,
  SubmitButton,
  UNAVAILABLE,
} from '~/components/account/fields'
import Article from '~/components/article/article'
import CommonLink from '~/components/common-link/common-link'
import Footer from '~/components/footer/footer'
import Navbar from '~/components/navbar/navbar'
import { verifyEmail } from '~/lib/auth/verify-email'
import { reconnectSocket } from '~/lib/realtime/connection'
import { useReload } from '~/lib/use-reload'

const searchSchema = z.object({
  token: z.string().optional().catch(undefined),
})

// The page the link of a sign-up email opens. The link is used by the button,
// not on load, so a mail scanner that fetches it does not spend it.
export const Route = createFileRoute('/confirmar-email')({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: 'Confirmar email | JoSuzuki' },
      { name: 'robots', content: 'noindex' },
      { name: 'referrer', content: 'no-referrer' },
    ],
  }),
  component: ConfirmEmail,
})

const INVALID =
  'Este link não vale mais (já foi usado ou passou de 24 horas). Faça login com seu email e senha para receber um novo.'

function ConfirmEmail() {
  const { token } = Route.useSearch()
  const reload = useReload()
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(token ? null : INVALID)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!token || pending) return
    setPending(true)
    setError(null)
    try {
      const result = await verifyEmail({ data: { token } })
      if (result.ok) {
        reconnectSocket()
        await reload()
        setDone(result.user.firstName)
      } else {
        setError(
          {
            invalid_token: INVALID,
            rate_limited: RATE_LIMITED,
            unavailable: UNAVAILABLE,
          }[result.error],
        )
      }
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
        <h1>Confirmar email</h1>
        <div className="flex w-full max-w-[22rem] flex-col gap-md">
          {done !== null ? (
            <FormMessage tone="info">
              Pronto, {done}! Seu email está confirmado e você já entrou.{' '}
              <CommonLink href="/games">Ver os jogos →</CommonLink>
            </FormMessage>
          ) : (
            <form
              onSubmit={(event) => void submit(event)}
              className="flex flex-col gap-md"
            >
              <p>Toque no botão para confirmar seu email e entrar.</p>
              {error && <FormMessage tone="error">{error}</FormMessage>}
              {token && (
                <SubmitButton pending={pending}>
                  Confirmar e entrar
                </SubmitButton>
              )}
            </form>
          )}
        </div>
        <Footer />
      </Article>
    </>
  )
}
