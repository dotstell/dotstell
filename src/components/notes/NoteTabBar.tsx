'use client'
import { useRouter } from 'next/navigation'
import { X, FileText, Plus, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useNoteTabs } from '@/hooks/useNoteTabs'

interface Props {
  currentId?: string
  paneOpen: boolean
  onTogglePane: () => void
}

export function NoteTabBar({ currentId, paneOpen, onTogglePane }: Props) {
  const router = useRouter()
  const { tabs, activeId, closeTab } = useNoteTabs(currentId)

  const effectiveActive = activeId ?? currentId

  function handleClose(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    const nextId = closeTab(id)
    if (nextId) router.push(`/notes/${nextId}`)
    else router.push('/notes')
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      borderBottom: '1px solid var(--border)',
      backgroundColor: 'var(--card)',
      flexShrink: 0,
      minHeight: 38,
    }}>
      {/* Side pane toggle — integrated into tab bar */}
      <button
        type="button"
        title={paneOpen ? 'Hide notes panel' : 'Show notes panel'}
        onClick={onTogglePane}
        style={{
          width: 38,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRight: '1px solid var(--border)',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--muted-foreground)',
          flexShrink: 0,
          transition: 'color 0.12s, background 0.12s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.color = 'var(--foreground)'
          ;(e.currentTarget as HTMLElement).style.background = 'var(--accent)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'
          ;(e.currentTarget as HTMLElement).style.background = 'transparent'
        }}
      >
        {paneOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
      </button>

      {/* Tabs — scrollable area */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        flex: 1,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        minWidth: 0,
      }}>
        {tabs.length === 0 && (
          <span style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
            padding: '0 14px',
            userSelect: 'none',
            opacity: 0.6,
          }}>
            No open notes
          </span>
        )}

        {tabs.map(tab => {
          const isActive = tab.id === effectiveActive
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
                padding: '0 10px 0 12px',
                height: 38,
                border: 'none',
                borderRight: '1px solid var(--border)',
                background: isActive ? 'var(--background)' : 'transparent',
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                cursor: 'pointer',
                flexShrink: 0,
                maxWidth: 180,
                minWidth: 80,
                transition: 'background 0.1s',
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
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  flexShrink: 0,
                  color: 'var(--muted-foreground)',
                  opacity: isActive ? 0.7 : 0,
                  transition: 'opacity 0.1s, background 0.1s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--border)'
                  ;(e.currentTarget as HTMLElement).style.opacity = '1'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--foreground)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.opacity = isActive ? '0.7' : '0'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'
                }}
              >
                <X size={10} />
              </span>
            </button>
          )
        })}
      </div>

      {/* New note button — always at the right */}
      <button
        type="button"
        title="New note (Ctrl+Alt+N)"
        onClick={() => router.push('/notes/new')}
        style={{
          width: 38,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderLeft: '1px solid var(--border)',
          background: 'transparent',
          cursor: 'pointer',
          color: 'var(--muted-foreground)',
          flexShrink: 0,
          transition: 'color 0.12s, background 0.12s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.color = 'var(--primary)'
          ;(e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--primary) 8%, transparent)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'
          ;(e.currentTarget as HTMLElement).style.background = 'transparent'
        }}
      >
        <Plus size={15} />
      </button>
    </div>
  )
}
