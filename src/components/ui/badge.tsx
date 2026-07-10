import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'destructive'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        {
          'bg-[var(--primary)]/20 text-[var(--primary)]': variant === 'default',
          'bg-[var(--secondary)] text-[var(--secondary-foreground)]': variant === 'secondary',
          'bg-emerald-500/20 text-emerald-400': variant === 'success',
          'bg-amber-500/20 text-amber-400': variant === 'warning',
          'bg-[var(--destructive)]/20 text-[var(--destructive)]': variant === 'destructive',
        },
        className
      )}
      {...props}
    />
  )
}
