import { cn } from '@/lib/utils'

interface DotstellLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
  className?: string
}

const BRAND_PURPLE = '#7c6aff'
const BRAND_PURPLE_LIGHT = '#a594ff'
const TEXT_PRIMARY = '#e8e8f0'
const TEXT_MUTED = '#6b6b88'

export function DotstellLogo({ size = 'md', showTagline = false, className }: DotstellLogoProps) {
  const configs = {
    sm: { icon: 30, text: '15px', tagline: '10px', gap: '10px', letterSpacing: '-0.3px' },
    md: { icon: 38, text: '18px', tagline: '11px', gap: '11px', letterSpacing: '-0.4px' },
    lg: { icon: 56, text: '28px', tagline: '13px', gap: '14px', letterSpacing: '-0.6px' },
  }
  const c = configs[size]

  return (
    <div className={cn('flex items-center', className)} style={{ gap: c.gap }}>
      <ConstellationIcon size={c.icon} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        <span style={{
          fontSize: c.text,
          fontWeight: 700,
          letterSpacing: c.letterSpacing,
          lineHeight: 1,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
          <span style={{ color: TEXT_PRIMARY }}>dots</span>
          <span style={{ color: BRAND_PURPLE }}>tell</span>
        </span>
        {showTagline && (
          <span style={{
            fontSize: c.tagline,
            color: TEXT_MUTED,
            letterSpacing: '0.3px',
            lineHeight: 1,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}>
            connect your knowledge
          </span>
        )}
      </div>
    </div>
  )
}

function ConstellationIcon({ size: s }: { size: number }) {
  const cx = s / 2
  const cy = s / 2

  // 5 outer constellation points
  const dots = [
    { x: cx * 1.0,  y: cy * 0.18 },  // top center
    { x: cx * 1.72, y: cy * 0.68 },  // top right
    { x: cx * 1.52, y: cy * 1.65 },  // bottom right
    { x: cx * 0.48, y: cy * 1.65 },  // bottom left
    { x: cx * 0.28, y: cy * 0.68 },  // top left
  ]

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      {/* Outer pentagon lines */}
      {dots.map((dot, i) => {
        const next = dots[(i + 1) % dots.length]
        return (
          <line
            key={`l${i}`}
            x1={dot.x} y1={dot.y}
            x2={next.x} y2={next.y}
            stroke={BRAND_PURPLE}
            strokeWidth={s * 0.03}
            strokeOpacity="0.45"
            strokeLinecap="round"
          />
        )
      })}

      {/* Dashed spokes to center */}
      {dots.map((dot, i) => (
        <line
          key={`s${i}`}
          x1={cx} y1={cy}
          x2={dot.x} y2={dot.y}
          stroke={BRAND_PURPLE}
          strokeWidth={s * 0.02}
          strokeOpacity="0.3"
          strokeDasharray={`${s * 0.07} ${s * 0.05}`}
          strokeLinecap="round"
        />
      ))}

      {/* Outer dot glows */}
      {dots.map((dot, i) => (
        <circle key={`g${i}`} cx={dot.x} cy={dot.y} r={s * 0.1} fill={BRAND_PURPLE} fillOpacity="0.1" />
      ))}

      {/* Outer dots — alternating sizes and shades */}
      {dots.map((dot, i) => (
        <circle
          key={`d${i}`}
          cx={dot.x} cy={dot.y}
          r={i % 2 === 0 ? s * 0.055 : s * 0.04}
          fill={i % 2 === 0 ? BRAND_PURPLE : BRAND_PURPLE_LIGHT}
        />
      ))}

      {/* Center hub — 3 glow rings */}
      <circle cx={cx} cy={cy} r={s * 0.28} fill={BRAND_PURPLE} fillOpacity="0.06" />
      <circle cx={cx} cy={cy} r={s * 0.18} fill={BRAND_PURPLE} fillOpacity="0.15" />
      <circle cx={cx} cy={cy} r={s * 0.11} fill={BRAND_PURPLE} />

      {/* White spark at center */}
      <circle cx={cx} cy={cy} r={s * 0.048} fill="white" fillOpacity="0.95" />
    </svg>
  )
}
