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
        backgroundColor: 'rgba(124,106,255,0.08)',
        border: '1px solid rgba(124,106,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, marginBottom: 4,
      }}>
        {icon}
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: '#e8e8f0', margin: 0 }}>{title}</h3>
      <p style={{ fontSize: 13, color: '#6b6b88', margin: 0, maxWidth: 300, lineHeight: 1.6 }}>{description}</p>
      {action && onAction && (
        <Button onClick={onAction} style={{ marginTop: 8 }}>{action}</Button>
      )}
    </div>
  )
}
