'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { NotesSidePane } from '@/components/notes/NotesSidePane'
import { NoteTabBar } from '@/components/notes/NoteTabBar'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

const PANE_WIDTH     = 220
const PANE_OPEN_KEY  = 'dotstell-notes-pane-open'

export default function NotesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [paneOpen, setPaneOpen] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(PANE_OPEN_KEY)
    if (stored !== null) setPaneOpen(stored === 'true')
  }, [])

  function togglePane() {
    setPaneOpen(p => {
      const next = !p
      localStorage.setItem(PANE_OPEN_KEY, String(next))
      return next
    })
  }

  // Extract note id from /notes/[id]
  const match = pathname.match(/^\/notes\/([^/]+)$/)
  const currentNoteId = match?.[1] !== 'new' ? match?.[1] : undefined

  // On /notes list page, show the grid; no tabs needed
  const isListPage = pathname === '/notes'

  return (
    <AppLayout>
      <div style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--background)',
      }}>

        {/* Toggle button (always visible, fixed to left edge of content) */}
        <button
          type="button"
          title={paneOpen ? 'Hide notes panel' : 'Show notes panel'}
          onClick={togglePane}
          style={{
            position: 'absolute',
            top: 10,
            left: paneOpen ? PANE_WIDTH + 8 : 8,
            zIndex: 10,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--muted-foreground)',
            transition: 'left 0.2s',
            flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--foreground)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
        >
          {paneOpen ? <PanelLeftClose size={13} /> : <PanelLeftOpen size={13} />}
        </button>

        {/* Side pane */}
        <div style={{
          width: paneOpen ? PANE_WIDTH : 0,
          overflow: 'hidden',
          transition: 'width 0.2s cubic-bezier(0.4,0,0.2,1)',
          flexShrink: 0,
        }}>
          {paneOpen && (
            <NotesSidePane width={PANE_WIDTH} activeNoteId={currentNoteId} />
          )}
        </div>

        {/* Main area: tab bar + page content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {!isListPage && <NoteTabBar currentId={currentNoteId} />}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
        </div>

      </div>
    </AppLayout>
  )
}
