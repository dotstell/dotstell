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

const TAB_H = 40

export function NoteTabBar({ currentId, paneOpen, onTogglePane }: Props) {
  const router = useRouter()
  const { tabs, activeId, closeTab } = useNoteTabs(currentId)
  const [hovered, setHovered] = useState<string | null>(null)

  const active = activeId ?? currentId

  function handleClose(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    const nextId = closeTab(id)
    router.push(nextId ? `/notes/${nextId}` : '/notes')
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      height: TAB_H,
      flexShrink: 0,
      backgroundColor: 'var(--card)',
      borderBottom: '1px solid var(--border)',
    }}>

      {/* ── Panel toggle ── */}
      <IconBtn
        title={paneOpen ? 'Hide notes panel' : 'Show notes panel'}
        onClick={onTogglePane}
        active={paneOpen}
        borderRight
      >
        {paneOpen ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
      </IconBtn>

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex', alignItems: 'stretch',
        flex: 1, minWidth: 0,
        overflowX: 'auto', overflowY: 'hidden',
        scrollbarWidth: 'none',
      }}>
        {tabs.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center',
            padding: '0 16px', fontSize: 13,
            color: 'var(--muted-foreground)', opacity: 0.45,
            userSelect: 'none', whiteSpace: 'nowrap',
          }}>
            Open a note to start a tab
          </div>
        ) : tabs.map(tab => {
          const isActive  = tab.id === active
          const isHovered = hovered === tab.id

          return (
            <div
              key={tab.id}
              onMouseEnter={() => setHovered(tab.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => router.push(`/notes/${tab.id}`)}
              title={tab.title || 'Untitled'}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '0 10px 0 13px',
                minWidth: 110, maxWidth: 190,
                height: TAB_H,
                flexShrink: 0,
                cursor: 'pointer',
                userSelect: 'none',
                position: 'relative',
                // Active tab: white/bg lift, primary bottom border
                backgroundColor: isActive
                  ? 'var(--background)'
                  : isHovered ? 'color-mix(in srgb, var(--foreground) 5%, transparent)' : 'transparent',
                borderRight: '1px solid var(--border)',
                borderBottom: isActive
                  ? `2px solid var(--primary)`
                  : '2px solid transparent',
                transition: 'background 0.12s',
              }}
            >
              <FileText
                size={13}
                style={{
                  flexShrink: 0,
                  color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
                  opacity: isActive ? 1 : 0.7,
                }}
              />
              <span style={{
                flex: 1, minWidth: 0,
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {tab.title || 'Untitled'}
              </span>

              {/* Close button — always reserved, shown on hover/active */}
              <div
                onClick={e => handleClose(e, tab.id)}
                role="button"
                title="Close tab"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 18, height: 18, borderRadius: 4,
                  flexShrink: 0,
                  visibility: (isActive || isHovered) ? 'visible' : 'hidden',
                  color: 'var(--muted-foreground)',
                  transition: 'background 0.1s, color 0.1s',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'color-mix(in srgb, var(--destructive) 15%, transparent)'
                  el.style.color = 'var(--destructive)'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLElement
                  el.style.background = 'transparent'
                  el.style.color = 'var(--muted-foreground)'
                }}
              >
                <X size={11} />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── New note ── */}
      <IconBtn
        title="New note"
        onClick={() => router.push('/notes/new')}
        borderLeft
        primary
      >
        <Plus size={16} />
      </IconBtn>
    </div>
  )
}

// ── Shared icon button ────────────────────────────────────────
function IconBtn({
  children, title, onClick, active, borderLeft, borderRight, primary,
}: {
  children: React.ReactNode
  title: string
  onClick: () => void
  active?: boolean
  borderLeft?: boolean
  borderRight?: boolean
  primary?: boolean
}) {
  const [hov, setHov] = useState(false)

  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: 44, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none',
        borderLeft: borderLeft ? '1px solid var(--border)' : undefined,
        borderRight: borderRight ? '1px solid var(--border)' : undefined,
        cursor: 'pointer',
        transition: 'background 0.12s, color 0.12s',
        backgroundColor: hov
          ? primary
            ? 'color-mix(in srgb, var(--primary) 12%, transparent)'
            : 'color-mix(in srgb, var(--foreground) 6%, transparent)'
          : active
            ? 'color-mix(in srgb, var(--primary) 8%, transparent)'
            : 'transparent',
        color: hov
          ? primary ? 'var(--primary)' : 'var(--foreground)'
          : active ? 'var(--primary)' : 'var(--muted-foreground)',
      }}
    >
      {children}
    </button>
  )
}
