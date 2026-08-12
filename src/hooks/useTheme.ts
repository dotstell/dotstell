'use client'
import { useEffect, useState, useCallback } from 'react'

export type ThemeId =
  | 'dotstell'
  | 'dracula' | 'one-dark' | 'tokyo-night' | 'nord' | 'solarized-dark' | 'catppuccin'
  | 'solarized-light' | 'github-light'
  | 'plain-light' | 'pure-light' | 'catppuccin-latte' | 'rose-pine-dawn' | 'gruvbox-light'

export const THEME_DEFS: { id: ThemeId; label: string; dot: string; dark: boolean; brand?: boolean }[] = [
  { id: 'dotstell',          label: 'Dotstell',          dot: '#7c6aff', dark: true,  brand: true },
  { id: 'dracula',           label: 'Dracula',           dot: '#bd93f9', dark: true  },
  { id: 'one-dark',          label: 'One Dark',          dot: '#61afef', dark: true  },
  { id: 'tokyo-night',       label: 'Tokyo Night',       dot: '#7aa2f7', dark: true  },
  { id: 'nord',              label: 'Nord',              dot: '#88c0d0', dark: true  },
  { id: 'solarized-dark',    label: 'Solarized Dark',    dot: '#268bd2', dark: true  },
  { id: 'catppuccin',        label: 'Catppuccin Mocha',  dot: '#cba6f7', dark: true  },
  { id: 'plain-light',       label: 'Dotstell Light',    dot: '#7c6aff', dark: false },
  { id: 'pure-light',        label: 'Pure Light',        dot: '#222222', dark: false },
  { id: 'solarized-light',   label: 'Solarized Light',   dot: '#2aa198', dark: false },
  { id: 'github-light',      label: 'GitHub Light',      dot: '#0969da', dark: false },
  { id: 'catppuccin-latte',  label: 'Catppuccin Latte',  dot: '#8839ef', dark: false },
  { id: 'rose-pine-dawn',    label: 'Rosé Pine Dawn',    dot: '#907aa9', dark: false },
  { id: 'gruvbox-light',     label: 'Gruvbox Light',     dot: '#458588', dark: false },
]

const VALID_IDS = THEME_DEFS.map(t => t.id)
const STORAGE_KEY = 'dotstell-theme'
const DEFAULT: ThemeId = 'dotstell'

function getStored(): ThemeId {
  if (typeof window === 'undefined') return DEFAULT
  const v = localStorage.getItem(STORAGE_KEY) as ThemeId
  return VALID_IDS.includes(v) ? v : DEFAULT
}

const LIGHT_THEMES: ThemeId[] = ['plain-light','pure-light','solarized-light','github-light','catppuccin-latte','rose-pine-dawn','gruvbox-light']

function apply(id: ThemeId) {
  document.documentElement.setAttribute('data-theme', id)
  document.documentElement.style.colorScheme = LIGHT_THEMES.includes(id) ? 'light' : 'dark'
}

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT)

  // On mount, read localStorage, apply, and remove the flash-prevention style block
  useEffect(() => {
    const stored = getStored()
    setThemeState(stored)
    apply(stored)
    // Remove the no-flash <style> injected by the inline script — its !important
    // would otherwise override CSS variable updates during theme switching
    document.getElementById('__theme-flash-prevention')?.remove()
  }, [])

  const setTheme = useCallback((id: ThemeId) => {
    apply(id)
    setThemeState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }, [])

  return { theme, setTheme }
}
