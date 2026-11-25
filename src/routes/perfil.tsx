import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  FAILED,
  FormMessage,
  RATE_LIMITED,
  SubmitButton,
  UNAVAILABLE,
  readForm,
} from '~/components/account/fields'
import Article from '~/components/article/article'
import Footer from '~/components/footer/footer'
import LoginButton from '~/components/login-button/login-button'
import { SignOutButton } from '~/components/logout-button/logout-button'
import Navbar from '~/components/navbar/navbar'
import { NAME_MAX_LENGTH } from '~/lib/auth/accounts'
import { useReload } from '~/lib/use-reload'
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  displayNameOf,
} from '~/lib/users/display-name'
import { getProfile } from '~/lib/users/get-profile'
import type { GetProfileResult, Profile } from '~/lib/users/get-profile'
import { updateProfile } from '~/lib/users/update-profile'

// The logged-in reader's own profile: their name and the nickname the site
// uses for them everywhere (games, quiz, greeting, comment form).
export const Route = createFileRoute('/perfil')({
  loader: () =>
    getProfile().catch((): GetProfileResult => ({
      ok: false,
      reason: 'unavailable',
    })),
  head: () => ({
    meta: [
      { title: 'Perfil | JoSuzuki' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: ProfilePage,
})

function ProfilePage() {
  const result = Route.useLoaderData()
  return (
    <>
      <Navbar />
      <Article>
        <h1>Perfil</h1>
        {result.ok ? (
          <>
            <ProfileForm profile={result.profile} />
            <div className="mt-lg">
              <SignOutButton className="py-xs tablet:hidden" />
            </div>
          </>
        ) : result.reason === 'login' ? (
          <div data-testid="profile-login">
            <p className="mb-md">Entre na sua conta para ver o seu perfil.</p>
            <LoginButton />
          </div>
        ) : (
          <p>Não foi possível carregar o perfil agora.</p>
        )}
        <Footer />
      </Article>
    </>
  )
}

const ERRORS = {
  login: 'Sua sessão terminou. Entre de novo.',
  invalid_name: `O nome precisa ter entre 1 e ${NAME_MAX_LENGTH} caracteres.`,
  invalid_nickname: `O apelido precisa ter de ${NICKNAME_MIN_LENGTH} a ${NICKNAME_MAX_LENGTH} caracteres: letras, números, espaço, ponto, hífen ou _, começando com letra ou número.`,
  rate_limited: RATE_LIMITED,
  unavailable: UNAVAILABLE,
} as const

function ProfileForm({ profile }: { profile: Profile }) {
  const reload = useReload()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<{
    tone: 'error' | 'info'
    text: string
  } | null>(null)
  // Live preview of what the site will call them.
  const [preview, setPreview] = useState(profile.displayName)

  const updatePreview = (form: HTMLFormElement) => {
    const { name, nickname } = readForm(form)
    setPreview(displayNameOf({ name: name || profile.name, nickname }))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    const { name, nickname } = readForm(event.currentTarget)
    setPending(true)
    setMessage(null)
    try {
      const result = await updateProfile({ data: { name, nickname } })
      if (result.ok) {
        // Every loader, so the greeting and the games pick it up.
        await reload()
        setMessage({ tone: 'info', text: 'Perfil salvo.' })
      } else {
        setMessage({ tone: 'error', text: ERRORS[result.error] })
      }
    } catch {
      setMessage({ tone: 'error', text: FAILED })
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      onInput={(event) => updatePreview(event.currentTarget)}
      className="flex w-full max-w-[22rem] flex-col gap-sm"
      data-testid="profile-form"
    >
      <p className="mb-xs">
        Nos jogos você aparece como{' '}
        <strong className="text-accent" data-testid="profile-preview">
          {preview}
        </strong>
        .
      </p>
      <Field
        name="nickname"
        label="Apelido"
        defaultValue={profile.nickname ?? ''}
        maxLength={NICKNAME_MAX_LENGTH}
        required={false}
        autoComplete="nickname"
        hint="É como o site te chama: nos jogos, na saudação e nos comentários. Em branco, usamos seu primeiro nome."
      />
      <Field
        name="name"
        label="Nome"
        defaultValue={profile.name}
        maxLength={NAME_MAX_LENGTH}
        required
        autoComplete="name"
      />
      <div>
        <span className="block text-xs">Email</span>
        <p className="text-xs break-all opacity-70">{profile.email}</p>
        <p className="text-xs opacity-70">
          Entra com{' '}
          {[
            profile.hasGoogle && 'Google',
            profile.hasPassword && 'email e senha',
          ]
            .filter(Boolean)
            .join(' ou ') || 'Google'}
          .
        </p>
      </div>
      {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}
      <div className="mt-xs">
        <SubmitButton pending={pending}>Salvar</SubmitButton>
      </div>
    </form>
  )
}

function Field({
  name,
  label,
  defaultValue,
  maxLength,
  required,
  autoComplete,
  hint,
}: {
  name: string
  label: string
  defaultValue: string
  maxLength: number
  required: boolean
  autoComplete: string
  hint?: string
}) {
  return (
    <label className="block">
      <span className="block text-xs">{label}</span>
      <input
        name={name}
        type="text"
        defaultValue={defaultValue}
        maxLength={maxLength}
        required={required}
        autoComplete={autoComplete}
        spellCheck={false}
        className="block w-full border border-accent bg-transparent px-xs py-xs text-xs outline-offset-2"
      />
      {hint && <span className="block text-xs opacity-70">{hint}</span>}
    </label>
  )
}
