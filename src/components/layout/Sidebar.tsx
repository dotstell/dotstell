'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  FileText, Bookmark, Users, CheckSquare, Network,
  LayoutDashboard, LogOut, Search
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

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
    <aside className="fixed left-0 top-0 h-screen w-[var(--sidebar-width)] bg-[var(--card)] border-r border-[var(--border)] flex flex-col z-40">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[var(--border)]">
        <div className="w-7 h-7 rounded-full bg-[var(--primary)] flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-xs">D</span>
        </div>
        <span className="font-bold text-sm tracking-wide">dotstell</span>
      </div>

      {/* Search shortcut */}
      <div className="px-3 py-3">
        <Link
          href="/search"
          className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)] transition-colors border border-[var(--border)]"
        >
          <Search size={14} />
          <span>Search...</span>
          <kbd className="ml-auto text-xs bg-[var(--muted)] px-1.5 py-0.5 rounded">⌘K</kbd>
        </Link>
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
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-[var(--primary)]/15 text-[var(--primary)] font-medium'
                  : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--foreground)]'
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-3 border-t border-[var(--border)]">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-[var(--muted-foreground)] hover:bg-[var(--accent)] hover:text-[var(--destructive)] transition-colors w-full"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
