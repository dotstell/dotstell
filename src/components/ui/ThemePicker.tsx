'use client'
import { useState, useRef } from 'react'
import { THEME_DEFS, type ThemeId } from '@/hooks/useTheme'

interface Props {
  current: ThemeId
  onSelect: (t: ThemeId) => void
  collapsed?: boolean
}

export function ThemePicker({ current, onSelect, collapsed }: Props) {
  const [open, setOpen] = useState(false)
  const [popPos, setPopPos] = useState({ left: 8, bottom: 60 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const currentDef = THEME_DEFS.find(t => t.id === current)

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPopPos({
        left:   collapsed ? r.right + 8 : r.left,
        bottom: window.innerHeight - r.top + 4,
      })
    }
    setOpen(o => !o)
  }

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        title="Change theme"
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center',
          gap: collapsed ? 0 : 8,
          justifyContent: collapsed ? 'center' : 'flex-start',
          padding: collapsed ? '0' : '7px 12px',
          width: '100%',
          height: collapsed ? 40 : 'auto',
          borderRadius: 8,
          border: 'none', background: 'none', cursor: 'pointer',
          color: 'var(--sidebar-muted)', fontSize: 12, fontWeight: 500,
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--sidebar-hover-bg)'
          if (!collapsed) e.currentTarget.style.color = 'var(--sidebar-hover-fg)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'none'
          if (!collapsed) e.currentTarget.style.color = 'var(--sidebar-muted)'
        }}
      >
        <ThemeDot color={currentDef?.dot ?? 'var(--primary)'} size={collapsed ? 14 : 12} />
        {!collapsed && (
          <>
            <span>{currentDef?.label ?? 'Theme'}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.5 }}>▾</span>
          </>
        )}
      </button>

      {open && (
        <>
          {/* Full-screen backdrop — position:fixed escapes sidebar overflow:hidden */}
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000 }} onClick={() => setOpen(false)} />

          {/* Popover — also fixed so it escapes sidebar overflow:hidden */}
          <div style={{
            position: 'fixed',
            left: popPos.left,
            bottom: popPos.bottom,
            zIndex: 1001,
            minWidth: 200,
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
            padding: '10px 8px',
            display: 'flex', flexDirection: 'column', gap: 2,
          }}>
            <GroupLabel>Dark</GroupLabel>
            {THEME_DEFS.filter(t => t.dark).map(t => (
              <ThemeRow
                key={t.id} theme={t} active={t.id === current}
                onSelect={id => { onSelect(id); setOpen(false) }}
              />
            ))}
            <GroupLabel>Light</GroupLabel>
            {THEME_DEFS.filter(t => !t.dark).map(t => (
              <ThemeRow
                key={t.id} theme={t} active={t.id === current}
                onSelect={id => { onSelect(id); setOpen(false) }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function GroupLabel({ children }: { children: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)',
      letterSpacing: '0.08em', textTransform: 'uppercase',
      padding: '4px 8px 6px',
    }}>
      {children}
    </div>
  )
}

function ThemeRow({ theme, active, onSelect }: {
  theme: typeof THEME_DEFS[0]
  active: boolean
  onSelect: (t: ThemeId) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '6px 8px', borderRadius: 7, width: '100%',
        border: active ? `1px solid ${theme.dot}55` : '1px solid transparent',
        background: active ? `${theme.dot}22` : 'transparent',
        color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
        fontSize: 12, fontWeight: active ? 600 : 400,
        cursor: 'pointer', transition: 'background 0.12s',
        textAlign: 'left',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--accent)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <ThemeDot color={theme.dot} size={11} />
      {theme.label}
      {active && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--primary)' }}>✓</span>}
    </button>
  )
}

function ThemeDot({ color, size }: { color: string; size: number }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      background: color, flexShrink: 0, display: 'inline-block',
      boxShadow: `0 0 6px ${color}80`,
    }} />
  )
}
