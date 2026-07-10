import { cn } from '@/lib/utils'

interface DotstellLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
  className?: string
}

export function DotstellLogo({ size = 'md', showTagline = false, className }: DotstellLogoProps) {
  const iconSizes = { sm: 28, md: 36, lg: 48 }
  const textSizes = { sm: 'text-sm', md: 'text-lg', lg: 'text-2xl' }
  const taglineSizes = { sm: 'text-[10px]', md: 'text-xs', lg: 'text-sm' }
  const s = iconSizes[size]

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <ConstellationIcon size={s} />
      <div className="flex flex-col leading-none">
        <span className={cn('font-bold tracking-tight', textSizes[size])}>
          <span className="text-[var(--foreground)]">dots</span>
          <span className="text-[var(--primary)]">tell</span>
        </span>
        {showTagline && (
          <span className={cn('text-[var(--muted-foreground)] mt-0.5', taglineSizes[size])}>
            connect your knowledge
          </span>
        )}
      </div>
    </div>
  )
}

function ConstellationIcon({ size }: { size: number }) {
  const s = size
  // Constellation points — scaled proportionally
  const cx = s / 2
  const cy = s / 2

  // Five outer dots + center hub
  const dots = [
    { x: cx * 0.95, y: cy * 0.35 },   // top
    { x: cx * 1.6,  y: cy * 0.65 },   // top-right
    { x: cx * 1.45, y: cy * 1.55 },   // bottom-right
    { x: cx * 0.65, y: cy * 1.6 },    // bottom-left
    { x: cx * 0.35, y: cy * 0.9 },    // left
  ]

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Connection lines between outer dots */}
      {dots.map((dot, i) => {
        const next = dots[(i + 1) % dots.length]
        return (
          <line
            key={`line-${i}`}
            x1={dot.x} y1={dot.y}
            x2={next.x} y2={next.y}
            stroke="#7c6aff"
            strokeWidth={s * 0.03}
            strokeOpacity="0.45"
          />
        )
      })}

      {/* Dashed spokes to center */}
      {dots.map((dot, i) => (
        <line
          key={`spoke-${i}`}
          x1={cx} y1={cy}
          x2={dot.x} y2={dot.y}
          stroke="#7c6aff"
          strokeWidth={s * 0.022}
          strokeOpacity="0.3"
          strokeDasharray={`${s * 0.06} ${s * 0.06}`}
        />
      ))}

      {/* Outer dot glows */}
      {dots.map((dot, i) => (
        <circle key={`glow-${i}`} cx={dot.x} cy={dot.y} r={s * 0.1} fill="#7c6aff" fillOpacity="0.12" />
      ))}

      {/* Outer dots */}
      {dots.map((dot, i) => (
        <circle
          key={`dot-${i}`}
          cx={dot.x} cy={dot.y}
          r={i % 2 === 0 ? s * 0.055 : s * 0.042}
          fill={i % 2 === 0 ? '#7c6aff' : '#a594ff'}
        />
      ))}

      {/* Center hub glow layers */}
      <circle cx={cx} cy={cy} r={s * 0.22} fill="#7c6aff" fillOpacity="0.1" />
      <circle cx={cx} cy={cy} r={s * 0.14} fill="#7c6aff" fillOpacity="0.2" />

      {/* Center hub */}
      <circle cx={cx} cy={cy} r={s * 0.09} fill="#7c6aff" />

      {/* Center white highlight */}
      <circle cx={cx} cy={cy} r={s * 0.04} fill="white" fillOpacity="0.9" />
    </svg>
  )
}
