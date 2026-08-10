'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'
import { THEME_DEFS, type ThemeId } from '@/hooks/useTheme'
import { ConstellationIcon } from '@/components/brand/DotstellLogo'

interface Props {
  current: ThemeId
  onSelect: (t: ThemeId) => void
  collapsed?: boolean
}

export function ThemePicker({ current, onSelect, collapsed }: Props) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 })

  const currentDef = THEME_DEFS.find(t => t.id === current)!

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      const target = e.target as Node
      if (!btnRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Close when sidebar expands (collapsed prop changes)
  useEffect(() => { setOpen(false) }, [collapsed])

  if (collapsed) {
    function handleClick() {
      if (btnRef.current) {
        const r = btnRef.current.getBoundingClientRect()
        setPopoverPos({ top: r.top, left: r.right + 8 })
      }
      setOpen(o => !o)
    }

    return (
      <>
        <button
          ref={btnRef}
          type="button"
          title="Change theme"
          onClick={handleClick}
          style={{
            width: '100%', height: 40, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: open ? 'var(--sidebar-hover-bg)' : 'none',
            border: 'none', cursor: 'pointer', borderRadius: 8,
            transition: 'background 0.15s',
          }}
        >
          <ColorDot color={currentDef.dot} active brand={currentDef.brand} />
        </button>

        {open && typeof document !== 'undefined' && createPortal(
          <div
            onMouseDown={e => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: popoverPos.top,
              left: popoverPos.left,
              zIndex: 9999,
              width: 200,
              backgroundColor: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
              padding: '8px 6px',
            }}
          >
            {/* Arrow */}
            <div style={{
              position: 'absolute', left: -5, top: 20,
              width: 8, height: 8,
              backgroundColor: 'var(--popover)',
              border: '1px solid var(--border)',
              borderRight: 'none', borderTop: 'none',
              rotate: '45deg',
            }} />

            <p style={{
              fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)',
              textTransform: 'uppercase', letterSpacing: '0.1em',
              margin: '0 0 6px 6px',
            }}>Theme</p>

            {THEME_DEFS.map(t => (
              <ThemeRow
                key={t.id}
                def={t}
                active={t.id === current}
                onSelect={id => { onSelect(id); setOpen(false) }}
              />
            ))}
          </div>,
          document.body
        )}
      </>
    )
  }

  const brand  = THEME_DEFS.filter(t => t.brand)
  const darks  = THEME_DEFS.filter(t => t.dark && !t.brand)
  const lights = THEME_DEFS.filter(t => !t.dark && !t.brand)

  return (
    <div style={{ padding: '4px 8px 4px' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', background: 'none', border: 'none',
          cursor: 'pointer', padding: '4px 4px', borderRadius: 6,
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--sidebar-hover-bg)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
      >
        <span style={{
          fontSize: 10, fontWeight: 600, color: 'var(--sidebar-section-fg)',
          textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1, textAlign: 'left',
        }}>
          Theme
        </span>
        {!open && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {currentDef.brand
              ? <span style={{ color: currentDef.dot, display: 'flex' }}><ConstellationIcon size={13} /></span>
              : <ColorDot color={currentDef.dot} active />
            }
            <span style={{ fontSize: 11, color: 'var(--sidebar-muted)', lineHeight: 1 }}>
              {currentDef.label}
            </span>
          </span>
        )}
        <ChevronDown
          size={12}
          style={{
            color: 'var(--sidebar-muted)', flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.18s',
          }}
        />
      </button>

      {open && (
        <div style={{ marginTop: 4 }}>
          {brand.map(t => (
            <ThemeRow key={t.id} def={t} active={t.id === current} onSelect={onSelect} />
          ))}
          <Divider />
          <GroupLabel>Dark</GroupLabel>
          {darks.map(t => (
            <ThemeRow key={t.id} def={t} active={t.id === current} onSelect={onSelect} />
          ))}
          <Divider />
          <GroupLabel>Light</GroupLabel>
          {lights.map(t => (
            <ThemeRow key={t.id} def={t} active={t.id === current} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--sidebar-border)', margin: '4px 4px' }} />
}

function GroupLabel({ children }: { children: string }) {
  return (
    <p style={{
      fontSize: 9, fontWeight: 700, color: 'var(--sidebar-section-fg)',
      textTransform: 'uppercase', letterSpacing: '0.1em', margin: '2px 0 2px 4px',
    }}>
      {children}
    </p>
  )
}

function ThemeRow({
  def, active, onSelect,
}: {
  def: (typeof THEME_DEFS)[number]
  active: boolean
  onSelect: (id: ThemeId) => void
}) {
  return (
    <button
      type="button"
      title={def.label}
      onClick={() => onSelect(def.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', padding: '5px 6px', borderRadius: 7,
        border: active
          ? `1px solid color-mix(in srgb, ${def.dot} 40%, transparent)`
          : '1px solid transparent',
        background: active
          ? `color-mix(in srgb, ${def.dot} 10%, transparent)`
          : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.12s, border-color 0.12s',
      }}
      onMouseEnter={e => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--sidebar-hover-bg)'
      }}
      onMouseLeave={e => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'
      }}
    >
      {def.brand ? (
        <span style={{ flexShrink: 0, color: def.dot, display: 'flex', alignItems: 'center' }}>
          <ConstellationIcon size={14} />
        </span>
      ) : (
        <ColorDot color={def.dot} active={active} />
      )}
      <span style={{
        fontSize: 12, fontWeight: active ? 600 : 400,
        color: active ? 'var(--foreground)' : 'var(--sidebar-muted)',
        lineHeight: 1, whiteSpace: 'nowrap', flex: 1, textAlign: 'left',
      }}>
        {def.label}
      </span>
      {def.brand && (
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
          color: def.dot, opacity: 0.8,
          background: `color-mix(in srgb, ${def.dot} 12%, transparent)`,
          padding: '1px 5px', borderRadius: 4,
        }}>
          DEFAULT
        </span>
      )}
      {active && !def.brand && (
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: def.dot, flexShrink: 0,
          boxShadow: `0 0 5px ${def.dot}`,
        }} />
      )}
    </button>
  )
}

function ColorDot({ color, active, brand }: { color: string; active?: boolean; brand?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 14, height: 14, borderRadius: '50%',
      background: color, flexShrink: 0,
      boxShadow: active ? `0 0 6px ${color}` : `0 0 3px ${color}60`,
    }}>
      {brand && (
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.9)' }} />
      )}
    </span>
  )
}
