import type { ReactNode } from 'react'
import Button from '~/components/button/button'
import { ErrorMessage, StatusBanner } from '~/components/notice/notice'

// The pieces of the account forms (the login dialog, /confirmar-email,
// /redefinir-senha, /perfil), built from the design system (DESIGN.md):
// fields like `Input` (label above, 1px accent outline), the solid main
// action, outlined secondary buttons, ErrorMessage and StatusBanner. Inputs
// use text-xs (16px) so phones do not zoom into them.

interface TextFieldProps {
  name: string
  label: string
  type: 'text' | 'email' | 'password'
  autoComplete: string
  minLength?: number
  maxLength?: number
  hint?: string
}

export const TextField = ({
  name,
  label,
  type,
  autoComplete,
  minLength,
  maxLength,
  hint,
}: TextFieldProps) => (
  <label className="block">
    <span className="block text-xs">{label}</span>
    <input
      name={name}
      type={type}
      autoComplete={autoComplete}
      minLength={minLength}
      maxLength={maxLength}
      required
      autoCapitalize={type === 'text' ? 'words' : 'none'}
      spellCheck={false}
      className="block w-full border border-accent bg-transparent px-xs py-xs text-xs outline-offset-2"
    />
    {hint && <span className="block text-xs opacity-70">{hint}</span>}
  </label>
)

/** The form's one main action: solid, full width (DESIGN.md). */
export const SubmitButton = ({
  pending,
  children,
}: {
  pending: boolean
  children: string
}) => (
  <Button
    type="submit"
    variant="solid"
    disabled={pending}
    aria-busy={pending}
    className="w-full"
  >
    {pending ? 'Aguarde…' : children}
  </Button>
)

/** Switching to another form (Criar conta, Esqueci minha senha). */
export const TextButton = ({
  onClick,
  children,
}: {
  onClick: () => void
  children: string
}) => (
  <Button size="sm" onClick={onClick}>
    {children}
  </Button>
)

/** An error (ErrorMessage) or a status the reader should read (StatusBanner). */
export const FormMessage = ({
  tone,
  children,
}: {
  tone: 'error' | 'info'
  children: ReactNode
}) =>
  tone === 'error' && typeof children === 'string' ? (
    <ErrorMessage message={children} />
  ) : (
    <StatusBanner>{children}</StatusBanner>
  )

/** The form's fields as strings (FormData values of text inputs). */
export const readForm = (form: HTMLFormElement) =>
  Object.fromEntries(
    [...new FormData(form)].map(([key, value]) => [key, String(value)]),
  )

export const RATE_LIMITED = 'Muitas tentativas. Espere alguns minutos.'
export const UNAVAILABLE = 'Não foi possível agora. Tente de novo mais tarde.'
export const FAILED = 'Algo deu errado. Tente de novo.'
