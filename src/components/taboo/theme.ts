import { readColorToken } from '~/lib/site-theme'
import type { Team } from '~/lib/taboo/game'

// The design tokens for the parts of Tabu that cannot use CSS: the 3D table
// and the card faces drawn on a canvas (see src/lib/site-theme.ts).

export { useSiteTheme } from '~/lib/site-theme'
export type { SiteTheme } from '~/lib/site-theme'

export interface Palette {
  team: Record<Team, { light: string; dark: string }>
  success: string
  accent: string
  secondary: string
  background: string
  text: string
  purple: string
}

/** Fallbacks, in case the stylesheet has not been applied (they match app.css). */
const FALLBACK: Palette = {
  team: {
    0: { light: '#3d6bff', dark: '#1f3fd1' },
    1: { light: '#ff5257', dark: '#d3263a' },
  },
  success: '#1fa971',
  accent: '#7670db',
  secondary: '#c25b84',
  background: '#170440',
  text: '#ffffff',
  purple: '#432a79',
}

/** The design tokens as they are now, for the current theme. */
export const readPalette = (): Palette => {
  const token = readColorToken
  return {
    team: {
      0: {
        light: token('team-blue', FALLBACK.team[0].light),
        dark: token('team-blue-dark', FALLBACK.team[0].dark),
      },
      1: {
        light: token('team-red', FALLBACK.team[1].light),
        dark: token('team-red-dark', FALLBACK.team[1].dark),
      },
    },
    success: token('success', FALLBACK.success),
    accent: token('accent', FALLBACK.accent),
    secondary: token('secondary', FALLBACK.secondary),
    background: token('background', FALLBACK.background),
    text: token('text', FALLBACK.text),
    purple: token('purple', FALLBACK.purple),
  }
}

/** Tailwind classes per team, spelled out so Tailwind finds them. */
export const TEAM_CLASSES: Record<
  Team,
  { text: string; bg: string; border: string; ink: string }
> = {
  0: {
    text: 'text-team-blue',
    bg: 'bg-team-blue',
    border: 'border-team-blue',
    ink: 'border-team-blue-ink text-team-blue-ink',
  },
  1: {
    text: 'text-team-red',
    bg: 'bg-team-red',
    border: 'border-team-red',
    ink: 'border-team-red-ink text-team-red-ink',
  },
}
