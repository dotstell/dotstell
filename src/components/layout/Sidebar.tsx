'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  FileText, Bookmark, Users, CheckSquare, Network,
  LayoutDashboard, LogOut, Search, ChevronLeft, ChevronRight
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DotstellLogo, ConstellationIcon } from '@/components/brand/DotstellLogo'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/notes',     icon: FileText,        label: 'Notes' },
  { href: '/people',    icon: Users,           label: 'People' },
  { href: '/bookmarks', icon: Bookmark,        label: 'Bookmarks' },
  { href: '/tasks',     icon: CheckSquare,     label: 'Tasks' },
  { href: '/graph',     icon: Network,         label: 'Graph' },
]

interface TooltipState {
  label: string
  top: number
}

export function Sidebar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [tooltip, setTooltip]     = useState<TooltipState | null>(null)

  useEffect(() => {
    setCollapsed(localStorage.getItem('sidebar-collapsed') === 'true')
  }, [])

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
    setTooltip(null)
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/auth/login')
  }

  function showTip(e: React.MouseEvent<HTMLElement>, label: string) {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({ label, top: rect.top + rect.height / 2 })
  }

  function hideTip() {
    setTooltip(null)
  }

  const sidebarWidth = collapsed ? 64 : 240

  return (
    <>
      <aside style={{
        position: 'fixed', left: 0, top: 0, height: '100vh', zIndex: 40,
        width: sidebarWidth,
        backgroundColor: '#12121a',
        borderRight: '1px solid #2a2a3e',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* ── Logo ── */}
        <div style={{
          height: 64, flexShrink: 0,
          borderBottom: '1px solid #2a2a3e',
          display: 'flex', alignItems: 'center',
          padding: '0 14px',
          justifyContent: collapsed ? 'center' : 'space-between',
        }}>
          {collapsed ? (
            <button
              type="button"
              onClick={toggle}
              onMouseEnter={e => showTip(e, 'dotstell')}
              onMouseLeave={hideTip}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <ConstellationIcon size={32} />
            </button>
          ) : (
            <>
              <DotstellLogo size="md" />
              <button
                type="button"
                onClick={toggle}
                style={{
                  width: 26, height: 26, borderRadius: 7,
                  border: '1px solid #2a2a3e', backgroundColor: '#1a1a28',
                  color: '#6b6b88', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
                }}
              >
                <ChevronLeft size={14} />
              </button>
            </>
          )}
        </div>

        {/* ── Search ── */}
        <div style={{ padding: collapsed ? '10px 12px' : '10px 10px 4px', flexShrink: 0 }}>
          {collapsed ? (
            <SidebarIconBtn
              as="link" href="/search"
              label="Search"
              onMouseEnter={e => showTip(e, 'Search')}
              onMouseLeave={hideTip}
            >
              <Search size={17} />
            </SidebarIconBtn>
          ) : (
            <Link href="/search" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', borderRadius: 8,
              border: '1px solid #2a2a3e', backgroundColor: '#1a1a28',
              color: '#6b6b88', fontSize: 13, textDecoration: 'none',
            }}>
              <Search size={14} />
              <span>Search...</span>
              <kbd style={{ marginLeft: 'auto', fontSize: 10, backgroundColor: '#2a2a3e', color: '#6b6b88', padding: '2px 5px', borderRadius: 4 }}>⌘K</kbd>
            </Link>
          )}
        </div>

        {/* ── Section label ── */}
        {!collapsed && (
          <div style={{ padding: '8px 16px 2px' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#3a3a5e', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Menu</span>
          </div>
        )}

        {/* ── Nav items ── */}
        <nav style={{ flex: 1, padding: collapsed ? '4px 12px' : '4px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            if (collapsed) {
              return (
                <SidebarIconBtn
                  key={href}
                  as="link" href={href}
                  active={active}
                  label={label}
                  onMouseEnter={e => showTip(e, label)}
                  onMouseLeave={hideTip}
                >
                  <Icon size={18} />
                </SidebarIconBtn>
              )
            }
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8,
                backgroundColor: active ? 'rgba(124,106,255,0.12)' : 'transparent',
                color: active ? '#7c6aff' : '#6b6b88',
                fontSize: 13, fontWeight: active ? 600 : 400,
                textDecoration: 'none', transition: 'background 0.15s, color 0.15s',
              }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#e8e8f0' } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6b6b88' } }}
              >
                <Icon size={17} style={{ flexShrink: 0 }} />
                <span>{label}</span>
                {active && <div style={{ marginLeft: 'auto', width: 3, height: 18, borderRadius: 2, backgroundColor: '#7c6aff' }} />}
              </Link>
            )
          })}
        </nav>

        {/* ── Expand button (collapsed only) ── */}
        {collapsed && (
          <div style={{ padding: '6px 12px', flexShrink: 0 }}>
            <SidebarIconBtn
              as="button"
              label="Expand menu"
              onMouseEnter={e => showTip(e, 'Expand menu')}
              onMouseLeave={hideTip}
              onClick={toggle}
            >
              <ChevronRight size={14} />
            </SidebarIconBtn>
          </div>
        )}

        {/* ── Sign out ── */}
        <div style={{ padding: collapsed ? '6px 12px' : '8px', borderTop: '1px solid #2a2a3e', flexShrink: 0 }}>
          {collapsed ? (
            <SidebarIconBtn
              as="button"
              label="Sign out"
              danger
              onMouseEnter={e => showTip(e, 'Sign out')}
              onMouseLeave={hideTip}
              onClick={signOut}
            >
              <LogOut size={17} />
            </SidebarIconBtn>
          ) : (
            <button type="button" onClick={signOut} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px', width: '100%', borderRadius: 8,
              border: 'none', backgroundColor: 'transparent',
              color: '#6b6b88', fontSize: 13, cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6b6b88'; e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          )}
        </div>
      </aside>

      {/* ── Tooltip — always positioned next to the hovered element ── */}
      {collapsed && tooltip && (
        <div style={{
          position: 'fixed',
          left: 72,
          top: tooltip.top,
          transform: 'translateY(-50%)',
          backgroundColor: '#1e1e2e',
          border: '1px solid #3a3a5e',
          color: '#e8e8f0',
          fontSize: 12,
          fontWeight: 500,
          padding: '5px 12px',
          borderRadius: 7,
          zIndex: 200,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          {tooltip.label}
          {/* Arrow */}
          <div style={{
            position: 'absolute',
            left: -5,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 8, height: 8,
            backgroundColor: '#1e1e2e',
            border: '1px solid #3a3a5e',
            borderRight: 'none', borderTop: 'none',
            rotate: '45deg',
          }} />
        </div>
      )}
    </>
  )
}

// ── Reusable icon button for collapsed sidebar ──
interface IconBtnProps {
  as: 'link' | 'button'
  href?: string
  label: string
  active?: boolean
  danger?: boolean
  children: React.ReactNode
  onMouseEnter: (e: React.MouseEvent<HTMLElement>) => void
  onMouseLeave: () => void
  onClick?: () => void
}

function SidebarIconBtn({ as, href, active, danger, children, onMouseEnter, onMouseLeave, onClick }: IconBtnProps) {
  const baseStyle: React.CSSProperties = {
    width: '100%', height: 40, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
    backgroundColor: active ? 'rgba(124,106,255,0.15)' : 'transparent',
    border: active ? '1px solid rgba(124,106,255,0.25)' : '1px solid transparent',
    color: active ? '#7c6aff' : '#6b6b88',
    textDecoration: 'none',
  }

  function handleEnter(e: React.MouseEvent<HTMLElement>) {
    if (!active) {
      e.currentTarget.style.backgroundColor = danger ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.05)'
      e.currentTarget.style.color = danger ? '#ef4444' : '#e8e8f0'
    }
    onMouseEnter(e)
  }

  function handleLeave(e: React.MouseEvent<HTMLElement>) {
    if (!active) {
      e.currentTarget.style.backgroundColor = 'transparent'
      e.currentTarget.style.color = '#6b6b88'
    }
    onMouseLeave()
  }

  if (as === 'link' && href) {
    return (
      <Link href={href} style={baseStyle} onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
        {children}
      </Link>
    )
  }

  return (
    <button type="button" style={baseStyle} onMouseEnter={handleEnter} onMouseLeave={handleLeave} onClick={onClick}>
      {children}
    </button>
  )
}
