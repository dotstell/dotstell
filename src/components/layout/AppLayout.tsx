import { Sidebar } from './Sidebar'

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        className="flex-1 overflow-auto"
        style={{ marginLeft: 'var(--sidebar-width)' }}
      >
        {children}
      </main>
    </div>
  )
}
