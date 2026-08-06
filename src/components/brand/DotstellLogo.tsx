import { cn } from '@/lib/utils'

interface DotstellLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
  className?: string
}

export function ConstellationIcon({ size: s }: { size: number }) {
  const cx = s / 2
  const cy = s / 2
  const dots = [
    { x: cx,        y: cy * 0.18 },
    { x: cx * 1.72, y: cy * 0.68 },
    { x: cx * 1.52, y: cy * 1.65 },
    { x: cx * 0.48, y: cy * 1.65 },
    { x: cx * 0.28, y: cy * 0.68 },
  ]
  return (
    <svg
      width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, color: 'var(--primary)' }}
    >
      {dots.map((dot, i) => {
        const next = dots[(i + 1) % dots.length]
        return <line key={`l${i}`} x1={dot.x} y1={dot.y} x2={next.x} y2={next.y} stroke="currentColor" strokeWidth={s * 0.03} strokeOpacity="0.5" strokeLinecap="round" />
      })}
      {dots.map((dot, i) => (
        <line key={`s${i}`} x1={cx} y1={cy} x2={dot.x} y2={dot.y} stroke="currentColor" strokeWidth={s * 0.02} strokeOpacity="0.3" strokeDasharray={`${s * 0.07} ${s * 0.05}`} strokeLinecap="round" />
      ))}
      {dots.map((dot, i) => (
        <circle key={`g${i}`} cx={dot.x} cy={dot.y} r={s * 0.1} fill="currentColor" fillOpacity="0.1" />
      ))}
      {dots.map((dot, i) => (
        <circle key={`d${i}`} cx={dot.x} cy={dot.y} r={i % 2 === 0 ? s * 0.055 : s * 0.04} fill="currentColor" fillOpacity={i % 2 === 0 ? '1' : '0.7'} />
      ))}
      <circle cx={cx} cy={cy} r={s * 0.28} fill="currentColor" fillOpacity="0.06" />
      <circle cx={cx} cy={cy} r={s * 0.18} fill="currentColor" fillOpacity="0.15" />
      <circle cx={cx} cy={cy} r={s * 0.11} fill="currentColor" />
      <circle cx={cx} cy={cy} r={s * 0.048} fill="white" fillOpacity="0.95" />
    </svg>
  )
}

export function DotstellLogo({ size = 'md', showTagline = false, className }: DotstellLogoProps) {
  const configs = {
    sm: { icon: 30, text: '15px', tagline: '10px', gap: '10px', spacing: '-0.3px' },
    md: { icon: 38, text: '18px', tagline: '11px', gap: '11px', spacing: '-0.4px' },
    lg: { icon: 56, text: '28px', tagline: '13px', gap: '14px', spacing: '-0.6px' },
  }
  const c = configs[size]
  return (
    <div className={cn('flex items-center', className)} style={{ gap: c.gap }}>
      <ConstellationIcon size={c.icon} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        <span style={{ fontSize: c.text, fontWeight: 700, letterSpacing: c.spacing, lineHeight: 1, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
          <span style={{ color: 'var(--foreground)' }}>dots</span>
          <span style={{ color: 'var(--primary)' }}>tell</span>
        </span>
        {showTagline && (
          <span style={{ fontSize: c.tagline, color: 'var(--muted-foreground)', letterSpacing: '0.3px', lineHeight: 1, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
            connect your knowledge
          </span>
        )}
      </div>
    </div>
  )
}
