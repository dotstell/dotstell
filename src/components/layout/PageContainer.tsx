import { cn } from '@/lib/utils'

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  narrow?: boolean   // search, people/[id] — tighter content
  wide?: boolean     // tasks board, graph — full width
}

/**
 * Consistent page wrapper used by every content page.
 * Padding: 28px left/right. Max-width caps to avoid over-stretching on 4K.
 * Does NOT centre — content anchors to the left of the content area.
 */
export function PageContainer({ children, className, style, narrow, wide, ...rest }: PageContainerProps) {
  const maxWidth = wide ? 'none' : narrow ? 860 : 1200

  return (
    <div
      {...rest}
      className={cn(className)}
      style={{
        padding: '28px 32px',
        maxWidth,
        width: '100%',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
