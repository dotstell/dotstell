import Link from 'next/link'
import { DotstellLogo } from '@/components/brand/DotstellLogo'

export const dynamic = 'force-dynamic'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-2xl">

        {/* Hero logo */}
        <div className="flex justify-center mb-8">
          <DotstellLogo size="lg" />
        </div>

        {/* Hero text */}
        <h1 className="text-4xl font-bold tracking-tight mb-4 leading-tight">
          Your knowledge is scattered.<br />
          <span className="text-[var(--primary)]">Dotstell connects it.</span>
        </h1>

        <p className="text-[var(--muted-foreground)] text-lg mb-3 max-w-lg mx-auto">
          Notes, people, tasks, and bookmarks — linked together in one living knowledge graph.
        </p>
        <p className="text-[var(--muted-foreground)] text-sm mb-10">
          Free and open source. No lock-in. Your data, your graph.
        </p>

        {/* CTAs */}
        <div className="flex items-center justify-center gap-3 mb-16">
          <Link
            href="/auth/register"
            className="px-6 py-2.5 rounded-md bg-[var(--primary)] text-white font-medium hover:opacity-90 transition-opacity text-sm"
          >
            Get started — it&apos;s free
          </Link>
          <Link
            href="/auth/login"
            className="px-6 py-2.5 rounded-md border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)] transition-colors text-sm"
          >
            Sign in
          </Link>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
          {[
            {
              icon: '📑',
              title: 'Smart Notes',
              desc: 'Rich text editor with slash commands, tables, code blocks and [[wikilinks]] — all searchable',
            },
            {
              icon: '🔖',
              title: 'Smart Bookmarks',
              desc: 'Save any URL — title, description and favicon fetched automatically and linked to your graph',
            },
            {
              icon: '🌐',
              title: 'Knowledge Graph',
              desc: 'See how your ideas, people and tasks connect in a living visual map',
            },
            {
              icon: '🔗',
              title: 'Everything Linked',
              desc: 'Connect any note to any person, task or bookmark — nothing lives in isolation',
            },
          ].map(({ icon, title, desc }) => (
            <div
              key={title}
              className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--primary)]/40 transition-colors"
            >
              <div className="text-2xl mb-3">{icon}</div>
              <h3 className="text-sm font-semibold mb-1">{title}</h3>
              <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-xs text-[var(--muted-foreground)] mt-10">
          Open source · Built in public · Part of the Dotstell ecosystem ·{' '}
          <a href="mailto:hello@dotstell.com" className="hover:text-[var(--foreground)] transition-colors">
            hello@dotstell.com
          </a>
        </p>
      </div>
    </main>
  )
}
