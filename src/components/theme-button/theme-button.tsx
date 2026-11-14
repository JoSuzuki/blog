import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useRedactedContext } from '~/components/redacted/redacted'

const SECRET_REDIRECT_KEY = 'secretRedirect'

const THEME_KEY = 'theme'

const THEMES = ['light', 'dark', 'secret'] as const

type Theme = (typeof THEMES)[number]

const themeMap: Record<Theme, string> = {
  light: '☀️',
  dark: '🌙',
  secret: '🌚',
}

const REVEAL_TIME = 2000

const ThemeButton = () => {
  const [theme, setTheme] = useState<Theme | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipClickRef = useRef<boolean>(false)
  const keyPressedRef = useRef<boolean>(false)

  const { reveal, setReveal } = useRedactedContext()

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY) as Theme
    updateTheme(savedTheme)
  }, [])

  const updateTheme = (newTheme: Theme) => {
    if (!skipClickRef.current) {
      setTheme(newTheme)
      document.documentElement.setAttribute('data-theme', newTheme)
      localStorage.setItem(THEME_KEY, newTheme)
    }
    skipClickRef.current = false
  }

  const toggleTheme = () => {
    let newTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    if (reveal) {
      const currentThemeIndex = THEMES.indexOf(theme ?? 'dark')
      newTheme = THEMES[(currentThemeIndex + 1) % THEMES.length] as Theme
    }
    updateTheme(newTheme)
  }

  const startTimer = () => {
    timeoutRef.current = setTimeout(() => {
      setReveal(!reveal)
      if (!reveal) {
        updateTheme('secret')
        const secretRedirect = localStorage.getItem(SECRET_REDIRECT_KEY)
        if (secretRedirect && location.pathname === '/404') {
          localStorage.removeItem(SECRET_REDIRECT_KEY)
          location.href = secretRedirect
        }
      }
      skipClickRef.current = true
    }, REVEAL_TIME)
  }

  const endTimer = () => {
    clearTimeout(timeoutRef.current as ReturnType<typeof setTimeout>)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (
      (e.key === 'Enter' || e.key === ' ') &&
      keyPressedRef.current === false
    ) {
      startTimer()
      keyPressedRef.current = true
    }
  }

  const handleKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    keyPressedRef.current = false
    if (e.key === 'Enter' || e.key === ' ') {
      endTimer()
    }
  }

  return (
    <button
      onClick={toggleTheme}
      onMouseDown={startTimer}
      onMouseUp={endTimer}
      onTouchStart={startTimer}
      onTouchEnd={endTimer}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      aria-label="Trocar tema"
      className="pressable size-[30px] border border-accent text-accent"
    >
      {theme === null ? null : reveal ? '🔓' : themeMap[theme]}
    </button>
  )
}

export default ThemeButton
