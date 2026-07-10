'use client'
import { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const sync = () => {
      setCollapsed(localStorage.getItem('sidebar-collapsed') === 'true')
    }
    sync()
    const interval = setInterval(sync, 150)
    return () => clearInterval(interval)
  }, [])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#0a0a0f' }}>
      <Sidebar />
      <main style={{
        flex: 1,
        marginLeft: collapsed ? '64px' : '240px',
        transition: 'margin-left 0.2s ease',
        overflow: 'auto',
        minHeight: '100vh',
      }}>
        {children}
      </main>
    </div>
  )
}
