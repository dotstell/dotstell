'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { THEME_DEFS, type ThemeId } from '@/hooks/useTheme'

interface Props {
  current: ThemeId
  onSelect: (t: ThemeId) => void
  collapsed?: boolean
}

export function ThemePicker({ current, onSelect, collapsed }: Props) {
  const [open, setOpen]       = useState(false)
  const [pos, setPos]         = useState({ x: 0, y: 0 })
  const [mounted, setMounted] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const currentDef = THEME_DEFS.find(t => t.id === current)

  // createPortal requires the DOM to be mounted
  useEffect(() => { setMounted(true) }, [])

  function openPicker() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({
        x: collapsed ? r.right + 8 : r.left,
        y: r.top,                // popover opens upward from this y
      })
    }
    setOpen(o => !o)
  }

  const popover = (open && mounted) ? createPortal(
    <>
      {/* Backdrop — closes on outside click, sits below popover */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        onClick={() => setOpen(false)}
      />
      {/* Popover — portalled to body so it escapes ALL parent overflow/stacking */}
      <div style={{
        position: 'fixed',
        left: pos.x,
        // open upward: anchor to the button's top, shift by popover height estimate
        top: Math.max(8, pos.y - 310),
        zIndex: 9999,
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
    </>,
    document.body
  ) : null

  return (
    <div>
      <button
        ref={btnRef}
        type="button"
        title="Change theme"
        onClick={openPicker}
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

      {popover}
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
      boxShadow: `0 0 5px ${color}80`,
    }} />
  )
}
