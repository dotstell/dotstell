'use client'
import { useRouter } from 'next/navigation'
import { X, FileText } from 'lucide-react'
import { useNoteTabs } from '@/hooks/useNoteTabs'

interface Props {
  currentId?: string
}

export function NoteTabBar({ currentId }: Props) {
  const router = useRouter()
  const { tabs, activeId, closeTab } = useNoteTabs(currentId)

  if (tabs.length === 0) return null

  function handleClose(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    const nextId = closeTab(id)
    if (nextId) {
      router.push(`/notes/${nextId}`)
    } else {
      router.push('/notes')
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      borderBottom: '1px solid var(--border)',
      backgroundColor: 'var(--card)',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      flexShrink: 0,
      minHeight: 36,
    }}>
      {tabs.map(tab => {
        const isActive = tab.id === (activeId ?? currentId)
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => router.push(`/notes/${tab.id}`)}
            title={tab.title || 'Untitled'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 12px',
              height: 36,
              border: 'none',
              borderRight: '1px solid var(--border)',
              background: isActive ? 'var(--background)' : 'transparent',
              borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
              cursor: 'pointer',
              flexShrink: 0,
              maxWidth: 180,
              transition: 'background 0.12s',
              position: 'relative',
              top: 1,
            }}
            onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--accent)' }}
            onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <FileText
              size={11}
              style={{ color: isActive ? 'var(--primary)' : 'var(--muted-foreground)', flexShrink: 0 }}
            />
            <span style={{
              fontSize: 12,
              color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
              fontWeight: isActive ? 600 : 400,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}>
              {tab.title || 'Untitled'}
            </span>
            <span
              role="button"
              onClick={e => handleClose(e, tab.id)}
              title="Close tab"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 14,
                height: 14,
                borderRadius: 3,
                flexShrink: 0,
                color: 'var(--muted-foreground)',
                opacity: isActive ? 1 : 0,
                transition: 'opacity 0.12s, background 0.1s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'var(--border)'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--foreground)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'
              }}
            >
              <X size={10} />
            </span>
          </button>
        )
      })}
    </div>
  )
}
