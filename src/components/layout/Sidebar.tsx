'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  FileText, Bookmark, Users, CheckSquare, Network,
  LayoutDashboard, LogOut, Search, ChevronLeft, ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { DotstellLogo } from '@/components/brand/DotstellLogo'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/notes', icon: FileText, label: 'Notes' },
  { href: '/people', icon: Users, label: 'People' },
  { href: '/bookmarks', icon: Bookmark, label: 'Bookmarks' },
  { href: '/tasks', icon: CheckSquare, label: 'Tasks' },
  { href: '/graph', icon: Network, label: 'Graph' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [tooltip, setTooltip] = useState<string | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    if (stored === 'true') setCollapsed(true)
  }, [])

  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const width = collapsed ? '64px' : '240px'

  return (
    <>
      {/* Sidebar */}
      <aside
        style={{
          width,
          minWidth: width,
          backgroundColor: '#12121a',
          borderRight: '1px solid #2a2a3e',
          transition: 'width 0.2s ease',
          overflow: 'hidden',
          position: 'fixed',
          left: 0,
          top: 0,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 40,
        }}
      >
        {/* Logo + collapse button */}
        <div style={{
          padding: collapsed ? '16px 0' : '16px',
          borderBottom: '1px solid #2a2a3e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          minHeight: '64px',
        }}>
          {!collapsed && <DotstellLogo size="md" />}
          {collapsed && (
            <div style={{
              width: 32, height: 32,
              borderRadius: '50%',
              backgroundColor: 'rgba(124,106,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#7c6aff' }} />
            </div>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapse}
              style={{
                width: 24, height: 24,
                borderRadius: '6px',
                border: '1px solid #2a2a3e',
                backgroundColor: '#1a1a28',
                color: '#6b6b88',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <ChevronLeft size={13} />
            </button>
          )}
        </div>

        {/* Search — only when expanded */}
        {!collapsed && (
          <div style={{ padding: '10px 12px 4px' }}>
            <Link
              href="/search"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid #2a2a3e',
                backgroundColor: '#1a1a28',
                color: '#6b6b88',
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              <Search size={13} />
              <span>Search...</span>
              <kbd style={{
                marginLeft: 'auto', fontSize: 10,
                backgroundColor: '#2a2a3e', color: '#6b6b88',
                padding: '1px 5px', borderRadius: 4,
              }}>⌘K</kbd>
            </Link>
          </div>
        )}

        {/* Collapsed search icon */}
        {collapsed && (
          <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'center' }}>
            <Link
              href="/search"
              onMouseEnter={() => setTooltip('Search')}
              onMouseLeave={() => setTooltip(null)}
              style={{
                width: 36, height: 36,
                borderRadius: 8,
                backgroundColor: '#1a1a28',
                border: '1px solid #2a2a3e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#6b6b88',
              }}
            >
              <Search size={15} />
            </Link>
          </div>
        )}

        {/* Section label */}
        {!collapsed && (
          <div style={{ padding: '12px 16px 4px' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#3a3a5e', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Menu
            </span>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '4px 8px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                onMouseEnter={() => collapsed ? setTooltip(label) : null}
                onMouseLeave={() => setTooltip(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: collapsed ? 0 : 10,
                  padding: collapsed ? '10px 0' : '9px 12px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 8,
                  backgroundColor: active ? 'rgba(124,106,255,0.12)' : 'transparent',
                  color: active ? '#7c6aff' : '#6b6b88',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  textDecoration: 'none',
                  transition: 'background-color 0.15s, color 0.15s',
                  position: 'relative',
                }}
                className="nav-item"
              >
                <Icon size={16} style={{ flexShrink: 0 }} />
                {!collapsed && <span>{label}</span>}
                {!collapsed && active && (
                  <div style={{
                    marginLeft: 'auto',
                    width: 3, height: 16,
                    borderRadius: 2,
                    backgroundColor: '#7c6aff',
                  }} />
                )}
              </Link>
            )
          })}
        </nav>

        {/* Expand button when collapsed */}
        {collapsed && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
            <button
              type="button"
              onClick={toggleCollapse}
              style={{
                width: 28, height: 28,
                borderRadius: 6,
                border: '1px solid #2a2a3e',
                backgroundColor: '#1a1a28',
                color: '#6b6b88',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}

        {/* Sign out */}
        <div style={{ padding: collapsed ? '8px 0' : '8px', borderTop: '1px solid #2a2a3e', display: 'flex', justifyContent: collapsed ? 'center' : 'stretch' }}>
          <button
            type="button"
            onClick={handleSignOut}
            onMouseEnter={() => collapsed ? setTooltip('Sign out') : null}
            onMouseLeave={() => setTooltip(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: collapsed ? 0 : 10,
              padding: collapsed ? '10px 0' : '9px 12px',
              width: collapsed ? 36 : '100%',
              height: collapsed ? 36 : 'auto',
              justifyContent: 'center',
              borderRadius: 8,
              backgroundColor: 'transparent',
              border: 'none',
              color: '#6b6b88',
              fontSize: 13,
              cursor: 'pointer',
            }}
            className="signout-btn"
          >
            <LogOut size={15} />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Tooltip for collapsed state */}
      {collapsed && tooltip && (
        <div style={{
          position: 'fixed',
          left: 72,
          top: '50%',
          transform: 'translateY(-50%)',
          backgroundColor: '#1e1e2e',
          border: '1px solid #2a2a3e',
          color: '#e8e8f0',
          fontSize: 12,
          padding: '4px 10px',
          borderRadius: 6,
          zIndex: 100,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          {tooltip}
        </div>
      )}

      {/* Hover styles */}
      <style>{`
        .nav-item:hover { background-color: rgba(255,255,255,0.04) !important; color: #e8e8f0 !important; }
        .signout-btn:hover { background-color: rgba(239,68,68,0.08) !important; color: #ef4444 !important; }
      `}</style>
    </>
  )
}
