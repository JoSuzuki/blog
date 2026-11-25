import { useEffect, useState } from 'react'

// The site's theme, for code that cannot use CSS: the 3D scenes (the Santorini
// board, the Tabu table) and anything drawn on a canvas. Everything else uses
// the Tailwind names of the tokens in src/app.css. See DESIGN.md.

export type SiteTheme = 'light' | 'dark' | 'secret'

export const SITE_THEMES: readonly SiteTheme[] = ['light', 'dark', 'secret']

const currentTheme = (): SiteTheme => {
  if (typeof document === 'undefined') return 'dark'
  const value = document.documentElement.getAttribute('data-theme')
  return SITE_THEMES.includes(value as SiteTheme)
    ? (value as SiteTheme)
    : 'dark'
}

/** The theme on <html>, following the theme button. */
export const useSiteTheme = (): SiteTheme => {
  const [theme, setTheme] = useState<SiteTheme>('dark')
  useEffect(() => {
    setTheme(currentTheme())
    const observer = new MutationObserver(() => setTheme(currentTheme()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])
  return theme
}

/**
 * A color token's current value (`readColorToken('accent')` reads
 * `--colors-accent`), or `fallback` where there is no stylesheet yet.
 */
export const readColorToken = (name: string, fallback: string): string => {
  if (typeof document === 'undefined') return fallback
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue(`--colors-${name}`)
      .trim() || fallback
  )
}
