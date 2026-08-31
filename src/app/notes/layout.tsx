'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { NotesSidePane } from '@/components/notes/NotesSidePane'
import { NoteTabBar } from '@/components/notes/NoteTabBar'

const PANE_WIDTH    = 220
const PANE_OPEN_KEY = 'dotstell-notes-pane-open'

function isEditable(el: Element | null) {
  if (!el) return false
  if ((el as HTMLElement).isContentEditable) return true
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

export default function NotesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [paneOpen,  setPaneOpen]  = useState(true)
  const [isMobile,  setIsMobile]  = useState(false)
  const [focusMode, setFocusMode] = useState(false)

  useEffect(() => {
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

  // F (not in editor) to enter focus mode; Escape to exit
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (focusMode) {
        if (e.key === 'Escape') {
          e.stopPropagation()
          setFocusMode(false)
        }
        return
      }
      if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (isEditable(document.activeElement)) return
        setFocusMode(true)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [focusMode])

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
      {/* Focus mode overlay — position:fixed covers the left sidebar (z-index 40-50) */}
      {focusMode ? (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          backgroundColor: 'var(--background)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>

          {/* Exit button — subtle, top-right */}
          <button
            type="button"
            onClick={() => setFocusMode(false)}
            title="Exit focus mode (Esc)"
            style={{
              position: 'fixed', top: 12, right: 16, zIndex: 101,
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 7,
              border: '1px solid var(--border)',
              backgroundColor: 'var(--card)',
              color: 'var(--muted-foreground)',
              fontSize: 11, fontWeight: 500, cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
              opacity: 0.55, transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.55' }}
          >
            <X size={11} />
            Exit focus
          </button>
        </div>
      ) : (
        <div style={{
          display: 'flex',
          height: '100vh',
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
            <NoteTabBar
              currentId={currentNoteId}
              paneOpen={paneOpen}
              onTogglePane={togglePane}
              onEnterFocus={() => setFocusMode(true)}
            />
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {children}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
