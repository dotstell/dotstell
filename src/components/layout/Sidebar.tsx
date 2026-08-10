'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  FileText, Bookmark, Users, CheckSquare, Network,
  LayoutDashboard, LogOut, Search, ChevronLeft, ChevronRight, Tag, Menu, X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DotstellLogo, ConstellationIcon } from '@/components/brand/DotstellLogo'
import { ThemePicker } from '@/components/ui/ThemePicker'
import { useTheme, type ThemeId } from '@/hooks/useTheme'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/notes',     icon: FileText,        label: 'Notes' },
  { href: '/people',    icon: Users,           label: 'People' },
  { href: '/bookmarks', icon: Bookmark,        label: 'Bookmarks' },
  { href: '/tasks',     icon: CheckSquare,     label: 'Tasks' },
  { href: '/tags',      icon: Tag,             label: 'Tags' },
  { href: '/graph',     icon: Network,         label: 'Graph' },
]

interface TooltipState {
  label: string
  top: number
}

export function Sidebar({ onOpenPalette }: { onOpenPalette?: () => void }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [tooltip, setTooltip]     = useState<TooltipState | null>(null)
  const { theme, setTheme } = useTheme()
  const [isDesktop, setIsDesktop] = useState(false)
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const desktop = typeof window !== 'undefined' && '__TAURI__' in window
    setIsDesktop(desktop)
    if (desktop) {
      import('@tauri-apps/api/core').then(({ invoke }) =>
        invoke<string>('app_version').then(setAppVersion).catch(() => null)
      )
    }
  }, [])

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 768)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

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
    if (isMobile) return
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({ label, top: rect.top + rect.height / 2 })
  }

  function hideTip() {
    setTooltip(null)
  }

  const sidebarWidth = collapsed ? 64 : 240

  // Mobile: render hamburger button + slide-in drawer
  if (isMobile) {
    return (
      <>
        {/* Hamburger button — fixed top-left */}
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
          style={{
            position: 'fixed', top: 14, left: 14, zIndex: 50,
            width: 38, height: 38, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'var(--sidebar-bg)',
            border: '1px solid var(--sidebar-border)',
            color: 'var(--foreground)',
            cursor: 'pointer',
          }}
        >
          <Menu size={18} />
        </button>

        {/* Backdrop */}
        {mobileOpen && (
          <div
            onClick={() => setMobileOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 48,
              backgroundColor: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(2px)',
            }}
          />
        )}

        {/* Drawer */}
        <aside style={{
          position: 'fixed', left: 0, top: 0, height: '100vh', zIndex: 49,
          width: 260,
          backgroundColor: 'var(--sidebar-bg)',
          borderRight: '1px solid var(--sidebar-border)',
          display: 'flex', flexDirection: 'column',
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          overflowY: 'auto',
        }}>
          {/* Header */}
          <div style={{
            height: 64, flexShrink: 0,
            borderBottom: '1px solid var(--sidebar-border)',
            display: 'flex', alignItems: 'center',
            padding: '0 14px',
            justifyContent: 'space-between',
          }}>
            <DotstellLogo size="md" />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: '1px solid var(--sidebar-border)',
                backgroundColor: 'var(--muted)',
                color: 'var(--sidebar-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Search */}
          <div style={{ padding: '10px 10px 4px', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => { setMobileOpen(false); onOpenPalette?.() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '9px 12px', borderRadius: 8, width: '100%',
                border: '1px solid var(--sidebar-border)',
                backgroundColor: 'var(--sidebar-search-bg)',
                color: 'var(--sidebar-muted)', fontSize: 13, cursor: 'pointer',
              }}
            >
              <Search size={14} />
              <span>Search...</span>
            </button>
          </div>

          {/* Section label */}
          <div style={{ padding: '8px 16px 2px' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--sidebar-section-fg)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Menu</span>
          </div>

          {/* Nav items */}
          <nav style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
            {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
              return (
                <Link key={href} href={href} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 12px', borderRadius: 8,
                  backgroundColor: active ? 'var(--sidebar-active-bg)' : 'transparent',
                  color: active ? 'var(--sidebar-active-fg)' : 'var(--sidebar-muted)',
                  fontSize: 14, fontWeight: active ? 600 : 400,
                  textDecoration: 'none',
                }}>
                  <Icon size={18} style={{ flexShrink: 0 }} />
                  <span>{label}</span>
                  {active && <div style={{ marginLeft: 'auto', width: 3, height: 18, borderRadius: 2, backgroundColor: 'var(--primary)' }} />}
                </Link>
              )
            })}
          </nav>

          {/* Theme picker */}
          <div style={{ padding: '4px 8px', borderTop: '1px solid var(--sidebar-border)', flexShrink: 0 }}>
            <ThemePicker current={theme} onSelect={setTheme} collapsed={false} />
          </div>

          {/* Sign out */}
          <div style={{ padding: '8px', borderTop: '1px solid var(--sidebar-border)', flexShrink: 0 }}>
            <button type="button" onClick={signOut} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '11px 12px', width: '100%', borderRadius: 8,
              border: 'none', backgroundColor: 'transparent',
              color: 'var(--sidebar-muted)', fontSize: 14, cursor: 'pointer',
            }}
              onTouchStart={e => { e.currentTarget.style.color = 'var(--destructive)'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)' }}
              onTouchEnd={e => { e.currentTarget.style.color = 'var(--sidebar-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <LogOut size={17} />
              <span>Sign out</span>
            </button>
          </div>
        </aside>
      </>
    )
  }

  // Desktop: original sidebar
  return (
    <>
      <aside style={{
        position: 'fixed', left: 0, top: 0, height: '100vh', zIndex: 40,
        width: sidebarWidth,
        backgroundColor: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* ── Logo ── */}
        <div style={{
          height: 64, flexShrink: 0,
          borderBottom: '1px solid var(--sidebar-border)',
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
                  border: '1px solid var(--sidebar-border)',
                  backgroundColor: 'var(--muted)',
                  color: 'var(--sidebar-muted)',
                  display: 'flex', alignItems: 'center',
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
              as="button"
              label="Search"
              onMouseEnter={e => showTip(e, 'Search  Ctrl+K')}
              onMouseLeave={hideTip}
              onClick={onOpenPalette}
            >
              <Search size={17} />
            </SidebarIconBtn>
          ) : (
            <button
              type="button"
              onClick={onOpenPalette}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 8, width: '100%',
                border: '1px solid var(--sidebar-border)',
                backgroundColor: 'var(--sidebar-search-bg)',
                color: 'var(--sidebar-muted)', fontSize: 13, cursor: 'pointer',
              }}
            >
              <Search size={14} />
              <span>Search...</span>
              <kbd style={{
                marginLeft: 'auto', fontSize: 10,
                backgroundColor: 'var(--muted)',
                color: 'var(--sidebar-muted)',
                padding: '2px 5px', borderRadius: 4,
              }}>Ctrl+K</kbd>
            </button>
          )}
        </div>

        {/* ── Section label ── */}
        {!collapsed && (
          <div style={{ padding: '8px 16px 2px' }}>
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--sidebar-section-fg)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Menu</span>
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
                backgroundColor: active ? 'var(--sidebar-active-bg)' : 'transparent',
                color: active ? 'var(--sidebar-active-fg)' : 'var(--sidebar-muted)',
                fontSize: 13, fontWeight: active ? 600 : 400,
                textDecoration: 'none', transition: 'background 0.15s, color 0.15s',
              }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.backgroundColor = 'var(--sidebar-hover-bg)'; e.currentTarget.style.color = 'var(--sidebar-hover-fg)' } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--sidebar-muted)' } }}
              >
                <Icon size={17} style={{ flexShrink: 0 }} />
                <span>{label}</span>
                {active && <div style={{ marginLeft: 'auto', width: 3, height: 18, borderRadius: 2, backgroundColor: 'var(--primary)' }} />}
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

        {/* ── Theme picker ── */}
        <div style={{
          padding: collapsed ? '6px 12px' : '4px 8px',
          borderTop: '1px solid var(--sidebar-border)',
          flexShrink: 0,
        }}
          onMouseEnter={collapsed ? e => showTip(e as React.MouseEvent<HTMLElement>, 'Change theme') : undefined}
          onMouseLeave={collapsed ? hideTip : undefined}
        >
          <ThemePicker current={theme} onSelect={setTheme} collapsed={collapsed} />
        </div>

        {/* ── Sign out ── */}
        <div style={{ padding: collapsed ? '6px 12px' : '8px', borderTop: '1px solid var(--sidebar-border)', flexShrink: 0 }}>
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
              color: 'var(--sidebar-muted)', fontSize: 13, cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--destructive)'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--sidebar-muted)'; e.currentTarget.style.backgroundColor = 'transparent' }}
            >
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          )}
        </div>
        {/* ── Desktop badge ── */}
        {isDesktop && !collapsed && (
          <div style={{
            padding: '6px 14px 10px',
            display: 'flex', alignItems: 'center', gap: 6,
            flexShrink: 0,
          }}>
            <ConstellationIcon size={12} />
            <span style={{
              fontSize: 10, color: 'var(--sidebar-muted)', letterSpacing: '0.04em',
              fontWeight: 500,
            }}>
              Desktop{appVersion ? ` v${appVersion}` : ''}
            </span>
          </div>
        )}
        {isDesktop && collapsed && (
          <div style={{
            padding: '6px 12px 10px',
            display: 'flex', justifyContent: 'center', flexShrink: 0,
          }}
            onMouseEnter={e => showTip(e as React.MouseEvent<HTMLElement>, `Desktop app${appVersion ? ` v${appVersion}` : ''}`)}
            onMouseLeave={hideTip}
          >
            <ConstellationIcon size={14} />
          </div>
        )}
      </aside>

      {/* ── Tooltip ── */}
      {collapsed && tooltip && (
        <div style={{
          position: 'fixed',
          left: 72,
          top: tooltip.top,
          transform: 'translateY(-50%)',
          backgroundColor: 'var(--popover)',
          border: '1px solid var(--border)',
          color: 'var(--foreground)',
          fontSize: 12, fontWeight: 500,
          padding: '5px 12px',
          borderRadius: 7,
          zIndex: 200,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          {tooltip.label}
          <div style={{
            position: 'absolute', left: -5, top: '50%',
            transform: 'translateY(-50%)',
            width: 8, height: 8,
            backgroundColor: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRight: 'none', borderTop: 'none',
            rotate: '45deg',
          }} />
        </div>
      )}
    </>
  )
}

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
    backgroundColor: active ? 'var(--sidebar-active-bg)' : 'transparent',
    border: active ? '1px solid color-mix(in srgb, var(--primary) 25%, transparent)' : '1px solid transparent',
    color: active ? 'var(--sidebar-active-fg)' : 'var(--sidebar-muted)',
    textDecoration: 'none',
  }

  function handleEnter(e: React.MouseEvent<HTMLElement>) {
    if (!active) {
      e.currentTarget.style.backgroundColor = danger ? 'rgba(239,68,68,0.08)' : 'var(--sidebar-hover-bg)'
      e.currentTarget.style.color = danger ? 'var(--destructive)' : 'var(--sidebar-hover-fg)'
    }
    onMouseEnter(e)
  }

  function handleLeave(e: React.MouseEvent<HTMLElement>) {
    if (!active) {
      e.currentTarget.style.backgroundColor = 'transparent'
      e.currentTarget.style.color = 'var(--sidebar-muted)'
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
