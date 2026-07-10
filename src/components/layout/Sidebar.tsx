'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  FileText, Bookmark, Users, CheckSquare, Network,
  LayoutDashboard, LogOut, Search
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

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-[var(--sidebar-width)] flex flex-col z-40"
      style={{ backgroundColor: '#12121a', borderRight: '1px solid #2a2a3e' }}
    >
      {/* Logo area — taller, more breathing room */}
      <div className="px-4 py-5" style={{ borderBottom: '1px solid #2a2a3e' }}>
        <DotstellLogo size="md" />
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-1">
        <Link
          href="/search"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors"
          style={{
            color: '#6b6b88',
            border: '1px solid #2a2a3e',
            backgroundColor: '#1a1a28',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#e8e8f0'
            e.currentTarget.style.backgroundColor = '#1e1e2e'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#6b6b88'
            e.currentTarget.style.backgroundColor = '#1a1a28'
          }}
        >
          <Search size={13} />
          <span>Search...</span>
          <kbd className="ml-auto text-xs px-1.5 py-0.5 rounded"
            style={{ backgroundColor: '#2a2a3e', color: '#6b6b88', fontSize: '10px' }}>
            ⌘K
          </kbd>
        </Link>
      </div>

      {/* Section label */}
      <div className="px-4 pt-4 pb-1">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#3a3a5e' }}>
          Menu
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-1 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              )}
              style={{
                backgroundColor: active ? 'rgba(124,106,255,0.12)' : 'transparent',
                color: active ? '#7c6aff' : '#6b6b88',
              }}
            >
              <Icon size={16} style={{ flexShrink: 0 }} />
              {label}
              {active && (
                <div className="ml-auto w-1 h-4 rounded-full" style={{ backgroundColor: '#7c6aff' }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom — sign out */}
      <div className="px-3 pb-4 pt-2" style={{ borderTop: '1px solid #2a2a3e' }}>
        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full transition-all"
          style={{ color: '#6b6b88' }}
          onMouseEnter={e => {
            e.currentTarget.style.color = '#ef4444'
            e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = '#6b6b88'
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <LogOut size={15} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
