import { cn } from '@/lib/utils'

interface DotstellLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showTagline?: boolean
  className?: string
}

const BRAND_PURPLE = '#7c6aff'
const BRAND_PURPLE_LIGHT = '#a594ff'
const TEXT_COLOR = '#e8e8f0'
const MUTED_COLOR = '#6b6b88'

export function DotstellLogo({ size = 'md', showTagline = false, className }: DotstellLogoProps) {
  const iconSizes = { sm: 28, md: 36, lg: 52 }
  const textSizes = { sm: 'text-sm', md: 'text-lg', lg: 'text-3xl' }
  const taglineSizes = { sm: 'text-[10px]', md: 'text-xs', lg: 'text-sm' }
  const s = iconSizes[size]

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <ConstellationIcon size={s} />
      <div className="flex flex-col leading-none gap-0.5">
        <span className={cn('font-bold tracking-tight', textSizes[size])}>
          <span style={{ color: TEXT_COLOR }}>dots</span>
          <span style={{ color: BRAND_PURPLE }}>tell</span>
        </span>
        {showTagline && (
          <span
            className={cn(taglineSizes[size])}
            style={{ color: MUTED_COLOR }}
          >
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

  const dots = [
    { x: cx * 0.95, y: cy * 0.32 },
    { x: cx * 1.65, y: cy * 0.62 },
    { x: cx * 1.48, y: cy * 1.58 },
    { x: cx * 0.62, y: cy * 1.62 },
    { x: cx * 0.30, y: cy * 0.88 },
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
      {/* Outer constellation lines */}
      {dots.map((dot, i) => {
        const next = dots[(i + 1) % dots.length]
        return (
          <line
            key={`line-outer-${i}`}
            x1={dot.x} y1={dot.y}
            x2={next.x} y2={next.y}
            stroke={BRAND_PURPLE}
            strokeWidth={s * 0.032}
            strokeOpacity="0.5"
            strokeLinecap="round"
          />
        )
      })}

      {/* Dashed spokes from center to each dot */}
      {dots.map((dot, i) => (
        <line
          key={`spoke-${i}`}
          x1={cx} y1={cy}
          x2={dot.x} y2={dot.y}
          stroke={BRAND_PURPLE}
          strokeWidth={s * 0.022}
          strokeOpacity="0.35"
          strokeDasharray={`${s * 0.07} ${s * 0.055}`}
          strokeLinecap="round"
        />
      ))}

      {/* Outer dot glow halos */}
      {dots.map((dot, i) => (
        <circle
          key={`halo-${i}`}
          cx={dot.x} cy={dot.y}
          r={s * 0.11}
          fill={BRAND_PURPLE}
          fillOpacity="0.12"
        />
      ))}

      {/* Outer dots */}
      {dots.map((dot, i) => (
        <circle
          key={`dot-${i}`}
          cx={dot.x} cy={dot.y}
          r={i % 2 === 0 ? s * 0.058 : s * 0.044}
          fill={i % 2 === 0 ? BRAND_PURPLE : BRAND_PURPLE_LIGHT}
        />
      ))}

      {/* Center hub — triple glow */}
      <circle cx={cx} cy={cy} r={s * 0.26} fill={BRAND_PURPLE} fillOpacity="0.08" />
      <circle cx={cx} cy={cy} r={s * 0.17} fill={BRAND_PURPLE} fillOpacity="0.18" />
      <circle cx={cx} cy={cy} r={s * 0.10} fill={BRAND_PURPLE} />

      {/* Center white spark */}
      <circle cx={cx} cy={cy} r={s * 0.045} fill="white" fillOpacity="0.95" />
    </svg>
  )
}
