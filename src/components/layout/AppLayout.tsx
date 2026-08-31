'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { CommandPalette } from '@/components/command/CommandPalette'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'
import { TaskReminders } from '@/components/tasks/TaskReminders'
import { AISettingsModal } from '@/components/ai/AISettingsModal'
import { AIStatusBadge } from '@/components/ai/AIStatusBadge'
import { createClient } from '@/lib/supabase/client'
import { APP_VERSION, RELEASES_URL } from '@/lib/version'

const G_ROUTES: Record<string, string> = {
  d: '/dashboard',
  n: '/notes',
  p: '/people',
  b: '/bookmarks',
  t: '/tasks',
  g: '/graph',
  a: '/tags',
  h: '/help',
}

function isEditable(el: Element | null): boolean {
  if (!el) return false
  // Walk up from active element to catch nested editables (Tiptap, etc.)
  let node: Element | null = el
  while (node && node !== document.body) {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName)) return true
    if ((node as HTMLElement).isContentEditable) return true
    node = node.parentElement
  }
  return false
}

const USER_SCOPED_KEYS = [
  'dotstell-note-tabs',
  'dotstell-note-active-tab',
  'dotstell-notified-tasks',
  'sidebar-collapsed',
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [collapsed, setCollapsed]       = useState(false)
  const [paletteOpen, setPaletteOpen]   = useState(false)
  const [aiSettingsOpen, setAISettingsOpen] = useState(false)
  const [isMobile, setIsMobile]         = useState(false)
  const [gHint, setGHint]               = useState(false)
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const waitingRef = useRef(false)

  // Wipe user-scoped localStorage state when a different account is detected
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id
      if (!uid) return
      const stored = localStorage.getItem('dotstell-user-id')
      if (stored && stored !== uid) {
        USER_SCOPED_KEYS.forEach(k => localStorage.removeItem(k))
      }
      localStorage.setItem('dotstell-user-id', uid)
    })
  }, [])

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Poll localStorage every 150ms rather than using a storage event because storage
  // events only fire in OTHER tabs — the tab that wrote the value never receives one.
  useEffect(() => {
    const sync = () => setCollapsed(localStorage.getItem('sidebar-collapsed') === 'true')
    sync()
    const interval = setInterval(sync, 150)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen(o => !o)
      }
      // Ctrl+Shift+, → AI Settings (use e.code so Shift doesn't change ',' to '<')
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'Comma') {
        e.preventDefault()
        setAISettingsOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  // G-key vim-style navigation: press G, then D/N/P/B/T/G
  // Uses capture phase so child stopPropagation calls can't block it.
  // Checks document.activeElement (more reliable than e.target).
  useEffect(() => {
    function handleGKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isEditable(document.activeElement)) return

      if (!waitingRef.current) {
        if (e.key === 'g' || e.key === 'G') {
          waitingRef.current = true
          setGHint(true)
          gTimer.current = setTimeout(() => {
            waitingRef.current = false
            setGHint(false)
          }, 1500)
        }
      } else {
        if (gTimer.current) clearTimeout(gTimer.current)
        waitingRef.current = false
        setGHint(false)
        const route = G_ROUTES[e.key.toLowerCase()]
        if (route) {
          e.preventDefault()
          router.push(route)
        }
      }
    }
    document.addEventListener('keydown', handleGKey, true)
    return () => {
      document.removeEventListener('keydown', handleGKey, true)
      if (gTimer.current) clearTimeout(gTimer.current)
    }
  }, [router])

  const marginLeft = isMobile ? 0 : collapsed ? 64 : 240

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--background)' }}>
      <Sidebar onOpenPalette={() => setPaletteOpen(true)} />
      <main style={{
        flex: 1,
        marginLeft,
        transition: isMobile ? 'none' : 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)',
        minWidth: 0,
        overflowX: 'hidden',
        backgroundColor: 'var(--background)',
        color: 'var(--foreground)',
      }}>
        {children}
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      {aiSettingsOpen && <AISettingsModal onClose={() => setAISettingsOpen(false)} />}
      {gHint && (
        <div style={{
          position: 'fixed', bottom: 48, right: 20, zIndex: 9999,
          backgroundColor: 'var(--popover)',
          border: '1px solid var(--border)',
          borderRadius: 8, padding: '6px 14px',
          fontSize: 13, fontWeight: 500,
          color: 'var(--foreground)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', gap: 8,
          pointerEvents: 'none',
          animation: 'fadeIn 0.1s ease',
        }}>
          <kbd style={{
            fontSize: 12, fontWeight: 700, fontFamily: 'monospace',
            backgroundColor: 'var(--primary)', color: 'white',
            padding: '1px 7px', borderRadius: 4,
          }}>G</kbd>
          <span style={{ color: 'var(--muted-foreground)' }}>→</span>
          <span style={{ color: 'var(--muted-foreground)', fontSize: 12 }}>D N P B T G A H</span>
        </div>
      )}
      <OnboardingFlow />
      <TaskReminders />
      {/* Hide on the note editor — its status bar occupies the same bottom-right corner */}
      {!/^\/notes\/.+/.test(pathname) && (
        <div style={{ position: 'fixed', bottom: 12, right: 16, zIndex: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AIStatusBadge onClick={() => setAISettingsOpen(true)} />
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 10, color: 'var(--muted-foreground)', letterSpacing: '0.04em',
              textDecoration: 'none', opacity: 0.45,
              transition: 'opacity 0.15s',
              pointerEvents: 'auto',
              userSelect: 'none',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.9' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.45' }}
          >
            v{APP_VERSION}
          </a>
        </div>
      )}
    </div>
  )
}
