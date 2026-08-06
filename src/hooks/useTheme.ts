'use client'
import { useEffect, useState } from 'react'

export type ThemeId =
  | 'midnight' | 'slate' | 'forest' | 'sunset' | 'ocean' | 'aurora'
  | 'light' | 'rose'

export const THEME_DEFS: { id: ThemeId; label: string; dot: string; dark: boolean }[] = [
  { id: 'midnight', label: 'Midnight', dot: '#7c6aff', dark: true  },
  { id: 'slate',    label: 'Slate',    dot: '#60a5fa', dark: true  },
  { id: 'forest',   label: 'Forest',   dot: '#34d399', dark: true  },
  { id: 'sunset',   label: 'Sunset',   dot: '#fb923c', dark: true  },
  { id: 'ocean',    label: 'Ocean',    dot: '#22d3ee', dark: true  },
  { id: 'aurora',   label: 'Aurora',   dot: '#d946ef', dark: true  },
  { id: 'light',    label: 'Light',    dot: '#6c5ce7', dark: false },
  { id: 'rose',     label: 'Rosé',     dot: '#e11d48', dark: false },
]

const STORAGE_KEY = 'dotstell-theme'


export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>('midnight')

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
