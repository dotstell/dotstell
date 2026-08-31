'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileText, Bookmark, CheckSquare, Users } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', exact: true  },
  { href: '/notes',     icon: FileText,        label: 'Notes',     exact: false },
  { href: '/bookmarks', icon: Bookmark,        label: 'Bookmarks', exact: false },
  { href: '/tasks',     icon: CheckSquare,     label: 'Tasks',     exact: false },
  { href: '/people',    icon: Users,           label: 'People',    exact: false },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60, height: 56,
      backgroundColor: 'var(--card)',
      borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'stretch',
    }}>
      {NAV_ITEMS.map(({ href, icon: Icon, label, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3,
              textDecoration: 'none',
              backgroundColor: active ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent',
              color: active ? 'var(--primary)' : 'var(--muted-foreground)',
              touchAction: 'manipulation',
            }}
          >
            <Icon size={20} />
            <span style={{ fontSize: 10, fontWeight: active ? 600 : 400, lineHeight: 1 }}>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
