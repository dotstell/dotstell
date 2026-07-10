import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-xl">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center">
            <span className="text-white font-bold">D</span>
          </div>
          <h1 className="text-3xl font-bold">dotstell</h1>
        </div>

        <p className="text-xl text-[var(--foreground)] mb-3 font-medium">
          Every note, message, event, person, and decision is a dot.
        </p>
        <p className="text-[var(--muted-foreground)] mb-10">
          Dotstell helps you connect them into meaningful constellations. A knowledge graph and memory platform for Engineering Managers.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/auth/register"
            className="px-6 py-2.5 rounded-md bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity"
          >
            Get started free
          </Link>
          <Link
            href="/auth/login"
            className="px-6 py-2.5 rounded-md border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors"
          >
            Sign in
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-4 text-left">
          {[
            { icon: '📑', title: 'Smart Notes', desc: 'Plain, markdown, and checklist notes in one place' },
            { icon: '👥', title: 'People Graph', desc: 'Track 1-on-1s and relationships with your team' },
            { icon: '🔗', title: 'Knowledge Links', desc: 'Connect any note, task, or person together' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
              <div className="text-2xl mb-2">{icon}</div>
              <h3 className="text-sm font-semibold mb-1">{title}</h3>
              <p className="text-xs text-[var(--muted-foreground)]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
