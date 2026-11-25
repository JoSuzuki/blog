import type { ReactNode } from 'react'

// A short label in a square outline: a game's state (AO VIVO), a count, a
// role. Not clickable, so it has no offset shadow.

export type BadgeTone = 'accent' | 'live' | 'success' | 'team-blue' | 'team-red'

// Spelled out in full so Tailwind finds every class.
const TONES: Record<BadgeTone, string> = {
  accent: 'border-accent text-accent',
  // Something happening right now, such as a game being played.
  live: 'border-team-red-ink text-team-red-ink wght-bold',
  success: 'border-success-ink text-success-ink',
  'team-blue': 'border-team-blue-ink text-team-blue-ink',
  'team-red': 'border-team-red-ink text-team-red-ink',
}

const Badge = ({
  tone = 'accent',
  children,
}: {
  tone?: BadgeTone
  children: ReactNode
}) => (
  <span
    className={`inline-flex items-center gap-xs border px-xs text-xs ${TONES[tone]}`}
  >
    {children}
  </span>
)

export default Badge
