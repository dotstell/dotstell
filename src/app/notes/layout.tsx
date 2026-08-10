'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { NotesSidePane } from '@/components/notes/NotesSidePane'
import { NoteTabBar } from '@/components/notes/NoteTabBar'

const PANE_WIDTH    = 220
const PANE_OPEN_KEY = 'dotstell-notes-pane-open'

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
  const currentNoteId = (match && match[1] !== 'new') ? match[1] : undefined

  return (
    <AppLayout>
      <div style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--background)',
      }}>
        {/* Side pane */}
        <div style={{
          width: paneOpen ? PANE_WIDTH : 0,
          overflow: 'hidden',
          flexShrink: 0,
          transition: 'width 0.2s cubic-bezier(0.4,0,0.2,1)',
          borderRight: paneOpen ? 'none' : undefined,
        }}>
          <NotesSidePane width={PANE_WIDTH} activeNoteId={currentNoteId} />
        </div>

        {/* Main area: tab bar (always) + page content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          <NoteTabBar
            currentId={currentNoteId}
            paneOpen={paneOpen}
            onTogglePane={togglePane}
          />
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
