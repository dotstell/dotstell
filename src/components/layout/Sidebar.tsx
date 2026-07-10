'use client'
import { useState, useEffect } from 'react'
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

const S = {
  bg:       '#12121a',
  border:   '#2a2a3e',
  muted:    '#6b6b88',
  accent:   '#1e1e2e',
  purple:   '#7c6aff',
  text:     '#e8e8f0',
  inputBg:  '#1a1a28',
}

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [tooltip,   setTooltip]   = useState<{ label: string; y: number } | null>(null)

  useEffect(() => {
    setCollapsed(localStorage.getItem('sidebar-collapsed') === 'true')
  }, [])

  function toggle() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('sidebar-collapsed', String(next))
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/auth/login')
  }

  const w = collapsed ? 64 : 240

  return (
    <>
      <aside style={{
        position: 'fixed', left: 0, top: 0, height: '100vh', zIndex: 40,
        width: w, minWidth: w,
        backgroundColor: S.bg,
        borderRight: `1px solid ${S.border}`,
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* ── Logo row ── */}
        <div style={{
          height: 64, flexShrink: 0,
          borderBottom: `1px solid ${S.border}`,
          display: 'flex', alignItems: 'center',
          padding: collapsed ? '0 14px' : '0 14px',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 8,
        }}>
          {collapsed
            ? <ConstellationIcon size={32} />
            : <>
                <DotstellLogo size="md" />
                <button type="button" onClick={toggle} style={iconBtnStyle}>
                  <ChevronLeft size={14} />
                </button>
              </>
          }
        </div>

        {/* ── Search ── */}
        <div style={{ padding: collapsed ? '10px 12px' : '10px 10px 4px', flexShrink: 0 }}>
          {collapsed
            ? <NavIconBtn href="/search" label="Search" onTip={setTooltip} yRef={80}>
                <Search size={17} />
              </NavIconBtn>
            : <Link href="/search" style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 8,
                border: `1px solid ${S.border}`, backgroundColor: S.inputBg,
                color: S.muted, fontSize: 13, textDecoration: 'none',
              }}>
                <Search size={14} />
                <span>Search...</span>
                <kbd style={{ marginLeft: 'auto', fontSize: 10, backgroundColor: S.border, color: S.muted, padding: '2px 5px', borderRadius: 4 }}>⌘K</kbd>
              </Link>
          }
        </div>

        {/* ── Section label ── */}
        {!collapsed && (
          <div style={{ padding: '10px 16px 4px' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#3a3a5e', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Menu</span>
          </div>
        )}

        {/* ── Nav ── */}
        <nav style={{ flex: 1, padding: collapsed ? '4px 12px' : '4px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV_ITEMS.map(({ href, icon: Icon, label }, idx) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            if (collapsed) {
              return (
                <NavIconBtn key={href} href={href} label={label} active={active} onTip={setTooltip} yRef={140 + idx * 48}>
                  <Icon size={18} />
                </NavIconBtn>
              )
            }
            return (
              <Link key={href} href={href} className="sidebar-nav-item" style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 8,
                backgroundColor: active ? 'rgba(124,106,255,0.12)' : 'transparent',
                color: active ? S.purple : S.muted,
                fontSize: 13, fontWeight: active ? 600 : 400,
                textDecoration: 'none', transition: 'background 0.15s, color 0.15s',
              }}>
                <Icon size={17} style={{ flexShrink: 0 }} />
                <span>{label}</span>
                {active && <div style={{ marginLeft: 'auto', width: 3, height: 18, borderRadius: 2, backgroundColor: S.purple }} />}
              </Link>
            )
          })}
        </nav>

        {/* ── Expand button (collapsed only) ── */}
        {collapsed && (
          <div style={{ padding: '8px 12px', flexShrink: 0 }}>
            <button type="button" onClick={toggle} style={{ ...iconBtnStyle, width: '100%' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* ── Sign out ── */}
        <div style={{ padding: collapsed ? '8px 12px' : '8px', borderTop: `1px solid ${S.border}`, flexShrink: 0 }}>
          {collapsed
            ? <button type="button" onClick={signOut} className="sidebar-signout-icon" style={{
                width: '100%', height: 36, borderRadius: 8,
                border: 'none', backgroundColor: 'transparent',
                color: S.muted, display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.color = S.muted; e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <LogOut size={17} />
              </button>
            : <button type="button" onClick={signOut} className="sidebar-signout" style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', width: '100%', borderRadius: 8,
                border: 'none', backgroundColor: 'transparent',
                color: S.muted, fontSize: 13, cursor: 'pointer',
                transition: 'background 0.15s, color 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.color = S.muted; e.currentTarget.style.backgroundColor = 'transparent' }}
              >
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
          }
        </div>
      </aside>

      {/* ── Tooltip ── */}
      {collapsed && tooltip && (
        <div style={{
          position: 'fixed', left: 72, top: tooltip.y,
          backgroundColor: '#1e1e2e', border: `1px solid ${S.border}`,
          color: S.text, fontSize: 12, padding: '5px 10px',
          borderRadius: 6, zIndex: 200, pointerEvents: 'none',
          whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>
          {tooltip.label}
        </div>
      )}

      <style>{`
        .sidebar-nav-item:hover { background-color: rgba(255,255,255,0.05) !important; color: ${S.text} !important; }
      `}</style>
    </>
  )
}

const iconBtnStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 8,
  border: `1px solid #2a2a3e`, backgroundColor: '#1a1a28',
  color: '#6b6b88', display: 'flex', alignItems: 'center',
  justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
}

function NavIconBtn({ href, label, active, onTip, yRef, children }: {
  href: string
  label: string
  active?: boolean
  onTip: (v: { label: string; y: number } | null) => void
  yRef: number
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      onMouseEnter={() => onTip({ label, y: yRef })}
      onMouseLeave={() => onTip(null)}
      style={{
        width: '100%', height: 40, borderRadius: 8,
        backgroundColor: active ? 'rgba(124,106,255,0.15)' : 'transparent',
        border: active ? '1px solid rgba(124,106,255,0.2)' : '1px solid transparent',
        color: active ? '#7c6aff' : '#6b6b88',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        textDecoration: 'none', transition: 'background 0.15s, color 0.15s',
      }}
      className="sidebar-icon-btn"
    >
      {children}
    </Link>
  )
}
