'use client'
import { Bot, AlertCircle } from 'lucide-react'
import { PROVIDER_LABELS } from '@/lib/ai/types'
import { useAISettings } from '@/hooks/useAISettings'

interface AIStatusBadgeProps {
  onClick?: () => void
}

// Compact badge shown in the app header/toolbar.
// Green dot = configured, orange dot = not configured.
export function AIStatusBadge({ onClick }: AIStatusBadgeProps) {
  const { config, isConfigured, loaded } = useAISettings()

  if (!loaded) return null

  const label = isConfigured
    ? PROVIDER_LABELS[config.provider]
    : 'AI not configured'

  return (
    <button
      type="button"
      onClick={onClick}
      title={isConfigured ? `AI: ${label} / ${config.model}` : 'Click to configure AI'}
      style={{
        display:         'flex', alignItems: 'center', gap: 5,
        padding:         '4px 9px', borderRadius: 20,
        border:          '1px solid var(--border)',
        backgroundColor: 'var(--muted)', cursor: onClick ? 'pointer' : 'default',
        fontSize:        11, color: 'var(--foreground)', fontWeight: 500,
        transition:      'all 0.15s',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.backgroundColor = 'var(--accent)' }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--muted)' }}
    >
      <Bot size={11} color={isConfigured ? 'var(--primary)' : 'var(--muted-foreground)'} />
      <span>{isConfigured ? label : 'AI'}</span>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        backgroundColor: isConfigured ? '#4ade80' : '#fb923c',
        flexShrink: 0,
      }} />
    </button>
  )
}
