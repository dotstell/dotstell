import { cn } from '@/lib/utils'

interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  narrow?: boolean   // search, people/[id] — tighter content
  wide?: boolean     // tasks board, graph — full width
}

export function PageContainer({ children, className, style, narrow, wide, ...rest }: PageContainerProps) {
  const maxWidth = wide ? 'none' : narrow ? 860 : 1200

  return (
    <div
      {...rest}
      className={cn('page-container', className)}
      style={{
        padding: '28px 32px',
        maxWidth,
        width: '100%',
        margin: '0 auto',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
