'use client'
import { useState, useEffect, useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'
import { AppLayout } from '@/components/layout/AppLayout'
import { NotesSidePane } from '@/components/notes/NotesSidePane'
import { NoteTabBar } from '@/components/notes/NoteTabBar'

const PANE_WIDTH    = 220
const PANE_OPEN_KEY = 'dotstell-notes-pane-open'

export default function NotesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [paneOpen, setPaneOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useLayoutEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(PANE_OPEN_KEY)
    if (stored !== null) setPaneOpen(stored === 'true')
  }, [])

  // Auto-close pane on mobile (also closes on every navigation while mobile)
  useEffect(() => {
    if (isMobile) setPaneOpen(false)
  }, [pathname, isMobile])

  function togglePane() {
    setPaneOpen(p => {
      const next = !p
      if (!isMobile) localStorage.setItem(PANE_OPEN_KEY, String(next))
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
        height: isMobile ? 'calc(100dvh - 56px - env(safe-area-inset-bottom))' : '100dvh',
        overflow: 'hidden',
        backgroundColor: 'var(--background)',
        position: 'relative',
      }}>
        {/* Side pane — overlay on mobile, push content on desktop */}
        {isMobile ? (
          paneOpen && (
            <>
              <div
                onClick={() => setPaneOpen(false)}
                style={{
                  position: 'fixed', inset: 0, zIndex: 39,
                  backgroundColor: 'rgba(0,0,0,0.4)',
                }}
              />
              <div style={{
                position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 40,
                width: PANE_WIDTH, overflowX: 'hidden',
                boxShadow: '2px 0 20px rgba(0,0,0,0.3)',
              }}>
                <NotesSidePane width={PANE_WIDTH} activeNoteId={currentNoteId} />
              </div>
            </>
          )
        ) : (
          <div style={{
            width: paneOpen ? PANE_WIDTH : 0,
            overflow: 'hidden',
            flexShrink: 0,
            transition: 'width 0.2s cubic-bezier(0.4,0,0.2,1)',
            borderRight: paneOpen ? 'none' : undefined,
          }}>
            <NotesSidePane width={PANE_WIDTH} activeNoteId={currentNoteId} />
          </div>
        )}

        {/* Main area: tab bar + page content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
          {/* Hide tab bar on mobile when inside a note — ← Notes in the editor header is sufficient */}
          {(!isMobile || !currentNoteId) && (
            <NoteTabBar
              currentId={currentNoteId}
              paneOpen={paneOpen}
              onTogglePane={togglePane}
            />
          )}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
