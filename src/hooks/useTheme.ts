'use client'
import { useEffect, useState } from 'react'

export type ThemeId =
  | 'dracula' | 'one-dark' | 'tokyo-night' | 'nord' | 'solarized-dark' | 'catppuccin'
  | 'solarized-light' | 'github-light'

export const THEME_DEFS: { id: ThemeId; label: string; dot: string; dark: boolean }[] = [
  { id: 'dracula',        label: 'Dracula',        dot: '#bd93f9', dark: true  },
  { id: 'one-dark',       label: 'One Dark',       dot: '#61afef', dark: true  },
  { id: 'tokyo-night',    label: 'Tokyo Night',    dot: '#7aa2f7', dark: true  },
  { id: 'nord',           label: 'Nord',           dot: '#88c0d0', dark: true  },
  { id: 'solarized-dark', label: 'Solarized Dark', dot: '#268bd2', dark: true  },
  { id: 'catppuccin',     label: 'Catppuccin',     dot: '#cba6f7', dark: true  },
  { id: 'solarized-light',label: 'Solarized Light',dot: '#268bd2', dark: false },
  { id: 'github-light',   label: 'GitHub Light',   dot: '#0969da', dark: false },
]

const STORAGE_KEY = 'dotstell-theme'


export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>('dracula')

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId
    if (saved && THEME_DEFS.some(t => t.id === saved)) {
      applyTheme(saved)
      setThemeState(saved)
    }
  }, [])

  function setTheme(t: ThemeId) {
    applyTheme(t)
    setThemeState(t)
    localStorage.setItem(STORAGE_KEY, t)
  }

  return { theme, setTheme }
}

function applyTheme(t: ThemeId) {
  document.documentElement.setAttribute('data-theme', t)
}
