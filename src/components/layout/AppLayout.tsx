'use client'
import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { CommandPalette } from '@/components/command/CommandPalette'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'
import { TaskReminders } from '@/components/tasks/TaskReminders'
import { createClient } from '@/lib/supabase/client'
import { APP_VERSION, RELEASES_URL } from '@/lib/version'

const USER_SCOPED_KEYS = [
  'dotstell-note-tabs',
  'dotstell-note-active-tab',
  'dotstell-notified-tasks',
  'sidebar-collapsed',
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed]     = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [isMobile, setIsMobile]       = useState(false)

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
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

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
      <OnboardingFlow />
      <TaskReminders />
      <a
        href={RELEASES_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'fixed', bottom: 12, right: 16, zIndex: 10,
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
  )
}
