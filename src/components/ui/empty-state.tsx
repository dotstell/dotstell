import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: string
  title: string
  description: string
  action?: string
  onAction?: () => void
}

export function EmptyState({ icon, title, description, action, onAction }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', textAlign: 'center',
      padding: '64px 24px', gap: 12,
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        backgroundColor: 'color-mix(in srgb, var(--primary) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--primary) 15%, transparent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, marginBottom: 4,
      }}>
        {icon}
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>{title}</h3>
      <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0, maxWidth: 300, lineHeight: 1.6 }}>{description}</p>
      {action && onAction && (
        <Button onClick={onAction} style={{ marginTop: 8 }}>{action}</Button>
      )}
    </div>
  )
}
