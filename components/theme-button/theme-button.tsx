import { useEffect, useState } from 'react'

enum THEMES {
  light = 'light',
  dark = 'dark',
}

const THEME_KEY = 'theme'

const themeMap = {
  [THEMES.light]: '☀️',
  [THEMES.dark]: '🌙',
}

const ThemeButton = () => {
  const [theme, setTheme] = useState<THEMES | null>(null)

  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY) as THEMES
    updateTheme(savedTheme)
  }, [])

  const updateTheme = (newTheme: THEMES) => {
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem(THEME_KEY, newTheme)
  }

  const toggleTheme = () => {
    const newTheme = theme === THEMES.dark ? THEMES.light : THEMES.dark
    updateTheme(newTheme)
  }

  return (
    <button onClick={toggleTheme} aria-label="Trocar tema">
      {theme === null ? null : themeMap[theme]}
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
