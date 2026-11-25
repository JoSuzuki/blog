import type { ComponentProps } from 'react'

// The site's buttons. Every clickable control is square, outlined and
// `pressable` (the offset shadow that lifts on hover); see DESIGN.md for when
// to use which tone, variant and size. `buttonClass` gives the same look to
// something that is not a <button> (a link, a <summary>).

export type ButtonTone =
  'accent' | 'success' | 'danger' | 'team-blue' | 'team-red'

/**
 * `outline` is the default and the only style for the game colors. `solid`
 * (filled with the accent) is for the one main action of a screen.
 */
export type ButtonVariant = 'outline' | 'solid'

/**
 * - `xs`: a small icon button inside a row or a list (⇄, ✕).
 * - `compact`: no vertical padding, the top bar's Login and Sair.
 * - `sm`: a secondary action in a page (Copiar link, Sortear times).
 * - `md`: the default.
 * - `lg`: a game's main buttons, big enough for thumbs.
 * - `icon`: a square holding one symbol (the theme button). Give it an
 *   `aria-label`.
 */
export type ButtonSize = 'xs' | 'compact' | 'sm' | 'md' | 'lg' | 'icon'

// Spelled out in full so Tailwind finds every class.
const TONES: Record<ButtonTone, string> = {
  accent: 'border-accent text-accent',
  success:
    'border-success-ink text-success-ink [--pressable-color:var(--colors-success-ink)]',
  danger:
    'border-team-red-ink text-team-red-ink [--pressable-color:var(--colors-team-red-ink)]',
  'team-blue':
    'border-team-blue-ink text-team-blue-ink [--pressable-color:var(--colors-team-blue-ink)]',
  'team-red':
    'border-team-red-ink text-team-red-ink [--pressable-color:var(--colors-team-red-ink)]',
}

const SOLID = 'border-accent bg-accent text-background'

const SIZES: Record<ButtonSize, string> = {
  xs: 'px-xs text-xs leading-snug',
  compact: 'px-sm wght-semibold',
  sm: 'px-sm py-xs text-sm',
  md: 'px-sm py-xs',
  lg: 'px-md py-sm text-md tracking-tight wght-bold',
  icon: 'size-[30px] shrink-0',
}

/**
 * On phones a `wide` button shares its row with the others, tall and easy to
 * hit; from tablets up it goes back to its size.
 */
const WIDE = 'flex-1 py-md text-lg tablet:flex-none tablet:py-sm tablet:text-md'

export interface ButtonStyle {
  tone?: ButtonTone
  variant?: ButtonVariant
  size?: ButtonSize
  wide?: boolean
}

export const buttonClass = ({
  tone = 'accent',
  variant = 'outline',
  size = 'md',
  wide = false,
}: ButtonStyle = {}) =>
  [
    'pressable inline-flex items-center justify-center gap-xs border text-center',
    'touch-manipulation select-none disabled:cursor-not-allowed disabled:opacity-50',
    variant === 'solid' ? SOLID : `bg-background ${TONES[tone]}`,
    SIZES[size],
    wide ? WIDE : '',
  ]
    .filter(Boolean)
    .join(' ')

/**
 * One option of a group where one (or a few) is chosen: a segmented control,
 * a filter chip, an answer. The chosen one is filled and flat, since clicking
 * it again does nothing; the others are ordinary outlined buttons. Mark the
 * choice for screen readers too (`aria-checked`, `aria-pressed` or
 * `aria-current`).
 */
export const choiceClass = (chosen: boolean) =>
  'border px-sm py-xs touch-manipulation select-none disabled:cursor-not-allowed disabled:opacity-50 ' +
  (chosen
    ? 'border-accent bg-accent text-background'
    : 'pressable border-accent bg-background text-accent')

interface ButtonProps extends ButtonStyle, ComponentProps<'button'> {
  testId?: string
  /** A keyboard shortcut, shown in a box after the label from tablets up. */
  hint?: string
}

const Button = ({
  tone,
  variant,
  size,
  wide,
  testId,
  hint,
  type = 'button',
  className,
  children,
  ...props
}: ButtonProps) => (
  <button
    type={type}
    data-testid={testId}
    className={
      buttonClass({ tone, variant, size, wide }) +
      (className ? ` ${className}` : '')
    }
    {...props}
  >
    {children}
    {hint && (
      <kbd className="ml-xs hidden border border-current px-xs text-xs wght-semibold tablet:inline">
        {hint}
      </kbd>
    )}
  </button>
)

export default Button
