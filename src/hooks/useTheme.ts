'use client'
import { useEffect, useState, useCallback } from 'react'

export type ThemeId =
  | 'dracula' | 'one-dark' | 'tokyo-night' | 'nord' | 'solarized-dark' | 'catppuccin'
  | 'solarized-light' | 'github-light'

export const THEME_DEFS: { id: ThemeId; label: string; dot: string; dark: boolean }[] = [
  { id: 'dracula',         label: 'Dracula',         dot: '#bd93f9', dark: true  },
  { id: 'one-dark',        label: 'One Dark',        dot: '#61afef', dark: true  },
  { id: 'tokyo-night',     label: 'Tokyo Night',     dot: '#7aa2f7', dark: true  },
  { id: 'nord',            label: 'Nord',            dot: '#88c0d0', dark: true  },
  { id: 'solarized-dark',  label: 'Solarized Dark',  dot: '#268bd2', dark: true  },
  { id: 'catppuccin',      label: 'Catppuccin',      dot: '#cba6f7', dark: true  },
  { id: 'solarized-light', label: 'Solarized Light', dot: '#2aa198', dark: false },
  { id: 'github-light',    label: 'GitHub Light',    dot: '#0969da', dark: false },
]

const VALID_IDS = THEME_DEFS.map(t => t.id)
const STORAGE_KEY = 'dotstell-theme'
const DEFAULT: ThemeId = 'dracula'

function getStored(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT
  const v = localStorage.getItem(STORAGE_KEY) as ThemeId
  return VALID_IDS.includes(v) ? v : DEFAULT
}

function apply(id: ThemeId) {
  document.documentElement.setAttribute('data-theme', id)
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT)

  // On mount, read localStorage and apply
  useEffect(() => {
    const stored = getStored()
    setThemeState(stored)
    apply(stored)
  }, [])

  const setTheme = useCallback((id: ThemeId) => {
    apply(id)
    setThemeState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }, [])

  return { theme, setTheme }
}
