'use client'
import { useState } from 'react'
import { THEME_DEFS, type ThemeId } from '@/hooks/useTheme'

interface Props {
  current: ThemeId
  onSelect: (t: ThemeId) => void
  collapsed?: boolean
}

export function ThemePicker({ current, onSelect, collapsed }: Props) {
  const [open, setOpen] = useState(false)

  if (collapsed) {
    return (
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          title="Change theme"
          onClick={() => setOpen(o => !o)}
          style={{
            width: '100%', height: 40, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: '1px solid transparent',
            cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
        >
          <ThemeDot color={THEME_DEFS.find(t => t.id === current)?.dot ?? '#7c6aff'} size={14} />
        </button>
        {open && (
          <Popover current={current} onSelect={t => { onSelect(t); setOpen(false) }} onClose={() => setOpen(false)} collapsed />
        )}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', width: '100%', borderRadius: 8,
          border: 'none', background: 'none', cursor: 'pointer',
          color: 'var(--sidebar-muted)', fontSize: 12, fontWeight: 500,
          transition: 'background 0.15s, color 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-hover-bg)'; e.currentTarget.style.color = 'var(--sidebar-hover-fg)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--sidebar-muted)' }}
      >
        <ThemeDot color={THEME_DEFS.find(t => t.id === current)?.dot ?? '#7c6aff'} size={12} />
        <span>{THEME_DEFS.find(t => t.id === current)?.label ?? 'Theme'}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.5 }}>▾</span>
      </button>
      {open && (
        <Popover current={current} onSelect={t => { onSelect(t); setOpen(false) }} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}

function Popover({ current, onSelect, onClose, collapsed }: { current: ThemeId; onSelect: (t: ThemeId) => void; onClose: () => void; collapsed?: boolean }) {
  const dark  = THEME_DEFS.filter(t => t.dark)
  const light = THEME_DEFS.filter(t => !t.dark)

  const popStyle: React.CSSProperties = collapsed
    ? { position: 'fixed', left: 68, bottom: 60, minWidth: 190 }
    : { position: 'absolute', bottom: '110%', left: 0, right: 0, minWidth: 190 }

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 99 }}
        onClick={onClose}
      />
      <div style={{
        ...popStyle,
        zIndex: 100,
        background: 'var(--popover)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        padding: '10px 8px',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 8px 6px' }}>Dark</div>
        {dark.map(t => <ThemeRow key={t.id} theme={t} active={t.id === current} onSelect={onSelect} />)}
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '8px 8px 6px' }}>Light</div>
        {light.map(t => <ThemeRow key={t.id} theme={t} active={t.id === current} onSelect={onSelect} />)}
      </div>
    </>
  )
}

function ThemeRow({ theme, active, onSelect }: { theme: typeof THEME_DEFS[0]; active: boolean; onSelect: (t: ThemeId) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        padding: '6px 8px', borderRadius: 7, width: '100%',
        border: active ? `1px solid ${theme.dot}44` : '1px solid transparent',
        background: active ? `${theme.dot}18` : 'transparent',
        color: active ? 'var(--foreground)' : 'var(--muted-foreground)',
        fontSize: 12, fontWeight: active ? 600 : 400,
        cursor: 'pointer', transition: 'background 0.12s',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--accent)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
    >
      <ThemeDot color={theme.dot} size={11} />
      {theme.label}
      {active && <span style={{ marginLeft: 'auto', fontSize: 11 }}>✓</span>}
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
