'use client'
import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'link'
  size?: 'sm' | 'md' | 'lg' | 'icon'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-[var(--primary)] text-white hover:opacity-90': variant === 'default',
            'border border-[var(--border)] bg-transparent hover:bg-[var(--accent)] text-[var(--foreground)]': variant === 'outline',
            'bg-transparent hover:bg-[var(--accent)] text-[var(--foreground)]': variant === 'ghost',
            'bg-[var(--destructive)] text-white hover:opacity-90': variant === 'destructive',
            'underline text-[var(--primary)] bg-transparent p-0 h-auto': variant === 'link',
          },
          {
            'text-xs px-2.5 py-1.5': size === 'sm',
            'text-sm px-4 py-2': size === 'md',
            'text-base px-6 py-2.5': size === 'lg',
            'h-8 w-8 p-0': size === 'icon',
          },
          className
        )}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'
export { Button }
