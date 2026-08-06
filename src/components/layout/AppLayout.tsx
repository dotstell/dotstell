'use client'
import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { CommandPalette } from '@/components/command/CommandPalette'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed]     = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

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

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--background)' }}>
      <Sidebar onOpenPalette={() => setPaletteOpen(true)} />
      <main style={{
        flex: 1,
        marginLeft: collapsed ? '64px' : '240px',
        transition: 'margin-left 0.22s cubic-bezier(0.4,0,0.2,1)',
        minWidth: 0,
        overflowX: 'hidden',
        backgroundColor: 'var(--background)',
        color: 'var(--foreground)',
      }}>
        {children}
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}
