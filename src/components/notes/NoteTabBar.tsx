'use client'
import { useState } from 'react'
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
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)

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
      alignItems: 'stretch',
      borderBottom: '1px solid var(--border)',
      backgroundColor: 'var(--card)',
      flexShrink: 0,
      height: 44,
    }}>
      {/* Panel toggle */}
      <button
        type="button"
        title={paneOpen ? 'Hide panel  [⌘\\]' : 'Show panel  [⌘\\]'}
        onClick={onTogglePane}
        style={{
          width: 44, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', borderRight: '1px solid var(--border)',
          background: 'transparent', cursor: 'pointer',
          color: paneOpen ? 'var(--foreground)' : 'var(--muted-foreground)',
          transition: 'color 0.12s, background 0.12s',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        {paneOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
      </button>

      {/* Tabs scrollable area */}
      <div style={{
        display: 'flex', alignItems: 'stretch',
        flex: 1, overflowX: 'auto', minWidth: 0,
        scrollbarWidth: 'none',
      }}>
        {tabs.length === 0 && (
          <div style={{
            display: 'flex', alignItems: 'center',
            padding: '0 16px',
            fontSize: 13, color: 'var(--muted-foreground)',
            opacity: 0.5, userSelect: 'none',
          }}>
            Open a note to start a tab
          </div>
        )}

        {tabs.map(tab => {
          const isActive  = tab.id === effectiveActive
          const isHovered = hoveredTab === tab.id
          return (
            <div
              key={tab.id}
              onMouseEnter={() => setHoveredTab(tab.id)}
              onMouseLeave={() => setHoveredTab(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 8px 0 14px',
                borderRight: '1px solid var(--border)',
                background: isActive
                  ? 'var(--background)'
                  : isHovered ? 'var(--accent)' : 'transparent',
                borderBottom: isActive
                  ? '2px solid var(--primary)'
                  : '2px solid transparent',
                cursor: 'pointer', flexShrink: 0,
                maxWidth: 200, minWidth: 100,
                transition: 'background 0.1s',
                position: 'relative', top: 1,
              }}
              onClick={() => router.push(`/notes/${tab.id}`)}
            >
              <FileText
                size={13}
                style={{
                  color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
                  flexShrink: 0,
                }}
              />
              <span style={{
                fontSize: 13,
                color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                fontWeight: isActive ? 600 : 400,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                flex: 1,
              }}>
                {tab.title || 'Untitled'}
              </span>

              {/* Close — always reserve space, only show on hover or active */}
              <div
                role="button"
                onClick={e => handleClose(e, tab.id)}
                title="Close"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                  color: 'var(--muted-foreground)',
                  visibility: (isActive || isHovered) ? 'visible' : 'hidden',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--foreground) 15%, transparent)'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--foreground)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'
                }}
              >
                <X size={11} />
              </div>
            </div>
          )
        })}
      </div>

      {/* New note */}
      <button
        type="button"
        title="New note"
        onClick={() => router.push('/notes/new')}
        style={{
          width: 44, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', borderLeft: '1px solid var(--border)',
          background: 'transparent', cursor: 'pointer',
          color: 'var(--muted-foreground)',
          transition: 'color 0.12s, background 0.12s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.color = 'var(--primary)'
          ;(e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--primary) 10%, transparent)'
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'
          ;(e.currentTarget as HTMLElement).style.background = 'transparent'
        }}
      >
        <Plus size={17} />
      </button>
    </div>
  )
}
