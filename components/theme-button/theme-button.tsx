import { useEffect, useRef, useState } from 'react'
import { useRedactedContext } from '../redacted/redacted'

enum THEMES {
  light = 'light',
  dark = 'dark',
  secret = 'secret',
}

const THEME_KEY = 'theme'

const themeMap = {
  [THEMES.light]: '☀️',
  [THEMES.dark]: '🌙',
  [THEMES.secret]: '🌚',
}

const REVEAL_TIME = 2000

const ThemeButton = () => {
  const [theme, setTheme] = useState<THEMES | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipClickRef = useRef<boolean>(false)
  const keyPressedRef = useRef<boolean>(false)

  const { reveal, setReveal } = useRedactedContext()

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY) as THEMES
    updateTheme(savedTheme)
  }, [])

  const updateTheme = (newTheme: THEMES) => {
    if (!skipClickRef.current) {
      setTheme(newTheme)
      document.documentElement.setAttribute('data-theme', newTheme)
      localStorage.setItem(THEME_KEY, newTheme)
    }
    skipClickRef.current = false
  }

  const toggleTheme = () => {
    let newTheme = theme === THEMES.dark ? THEMES.light : THEMES.dark;
    if(reveal) {
      const currentThemeIndex = Object.values(THEMES).indexOf(theme ?? THEMES.dark)
      const newThemeIndex = (currentThemeIndex + 1) % Object.values(THEMES).length;
      newTheme = Object.values(THEMES)[newThemeIndex]
    }
    updateTheme(newTheme)
  }

  const startTimer = () => {
    timeoutRef.current = setTimeout(() => {
      setReveal(!reveal)
      if(!reveal) {
        updateTheme(THEMES.secret)
      }
      skipClickRef.current = true
    }, REVEAL_TIME)
  }

  const endTimer = () => {
    clearTimeout(timeoutRef.current as ReturnType<typeof setTimeout>)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (
      (e.key === 'Enter' || e.key === ' ') &&
      keyPressedRef.current === false
    ) {
      startTimer()
      keyPressedRef.current = true
    }
  }

  const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
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
    >
      {theme === null ? null : reveal ? '🔓' : themeMap[theme]}
      <style jsx>{`
        button {
          position: relative;
          border: 1px solid var(--colors-accent);
          color: var(--colors-accent);
          height: 30px;
          width: 30px;
          box-shadow: 1px 1px 0px 0px var(--colors-accent);
        }
        button:hover {
          top: -1px;
          left: -1px;
          box-shadow: 2px 2px 0px 0px var(--colors-accent);
        }
        button:active {
          top: 1px;
          left: 1px;
          box-shadow: none;
        }
      `}</style>
    </button>
  )
}

export default ThemeButton
