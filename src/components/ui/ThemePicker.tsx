'use client'
import { THEME_DEFS, type ThemeId } from '@/hooks/useTheme'

interface Props {
  current: ThemeId
  onSelect: (t: ThemeId) => void
  collapsed?: boolean
}

export function ThemePicker({ current, onSelect, collapsed }: Props) {
  if (collapsed) {
    // Collapsed: single dot that cycles to next theme on click
    const idx  = THEME_DEFS.findIndex(t => t.id === current)
    const next = THEME_DEFS[(idx + 1) % THEME_DEFS.length]
    const dot  = THEME_DEFS.find(t => t.id === current)?.dot ?? 'var(--primary)'
    return (
      <button
        type="button"
        title={`Theme: ${THEME_DEFS.find(t => t.id === current)?.label ?? ''} — click to cycle`}
        onClick={() => onSelect(next.id)}
        style={{
          width: '100%', height: 40, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'none', border: 'none',
          cursor: 'pointer', borderRadius: 8,
        }}
      >
        <Dot color={dot} size={14} active />
      </button>
    )
  }

  return (
    <div style={{ padding: '6px 12px 8px' }}>
      <p style={{
        fontSize: 10, fontWeight: 600, color: 'var(--sidebar-section-fg)',
        textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px',
      }}>
        Theme
      </p>

      {/* Dark themes row */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
        {THEME_DEFS.filter(t => t.dark).map(t => (
          <button
            key={t.id}
            type="button"
            title={t.label}
            onClick={() => onSelect(t.id)}
            style={{
              background: 'none', border: 'none', padding: 2,
              cursor: 'pointer', borderRadius: '50%', lineHeight: 0,
              outline: t.id === current ? `2px solid ${t.dot}` : '2px solid transparent',
              outlineOffset: 2,
              transition: 'outline-color 0.12s, transform 0.12s',
              transform: t.id === current ? 'scale(1.2)' : 'scale(1)',
            }}
          >
            <Dot color={t.dot} size={16} active={t.id === current} />
          </button>
        ))}
      </div>

      {/* Light themes row */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        {THEME_DEFS.filter(t => !t.dark).map(t => (
          <button
            key={t.id}
            type="button"
            title={t.label}
            onClick={() => onSelect(t.id)}
            style={{
              background: 'none', border: 'none', padding: 2,
              cursor: 'pointer', borderRadius: '50%', lineHeight: 0,
              outline: t.id === current ? `2px solid ${t.dot}` : '2px solid transparent',
              outlineOffset: 2,
              transition: 'outline-color 0.12s, transform 0.12s',
              transform: t.id === current ? 'scale(1.2)' : 'scale(1)',
            }}
          >
            <Dot color={t.dot} size={16} active={t.id === current} />
          </button>
        ))}
      </div>

      {/* Current theme name */}
      <p style={{
        fontSize: 11, color: 'var(--sidebar-muted)',
        margin: '6px 0 0', lineHeight: 1,
      }}>
        {THEME_DEFS.find(t => t.id === current)?.label ?? ''}
      </p>
    </div>
  )
}

function Dot({ color, size, active }: { color: string; size: number; active?: boolean }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size, height: size,
      borderRadius: '50%',
      background: color,
      boxShadow: active ? `0 0 7px ${color}` : `0 0 3px ${color}60`,
      flexShrink: 0,
    }} />
  )
}
