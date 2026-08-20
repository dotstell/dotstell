import Link from 'next/link'
import { DotstellLogo } from '@/components/brand/DotstellLogo'

export const dynamic = 'force-dynamic'

const FEATURES = [
  {
    icon: '✏️',
    title: 'Smart Notes',
    desc: 'Rich text with slash commands, tables, code blocks, text colours, highlights and [[wikilinks]]. Drag to reorder, pin, and colour-label.',
  },
  {
    icon: '🔖',
    title: 'Smart Bookmarks',
    desc: 'Save any URL — title, description and favicon fetched automatically and linked into your graph.',
  },
  {
    icon: '🌐',
    title: 'Knowledge Graph',
    desc: 'A live visual map of how every note, person, task and bookmark connects to everything else.',
  },
  {
    icon: '👥',
    title: 'People & Connections',
    desc: 'Build a personal network — link notes, bookmarks and tasks to the people who matter.',
  },
  {
    icon: '📁',
    title: 'Notebooks & Organisation',
    desc: 'Group into notebooks, add tags, pin favourites and colour-label — then find anything with full-text search.',
  },
  {
    icon: '✅',
    title: 'Tasks & Checklists',
    desc: 'Inline checklists inside any note or standalone task notes — context and work always together.',
  },
]

function AppMock() {
  return (
    <div className="relative w-full max-w-3xl mx-auto">
      {/* Purple glow behind mock */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, borderRadius: 16,
          background: 'radial-gradient(ellipse at 50% 50%, rgba(124,106,255,0.28), transparent 70%)',
          filter: 'blur(32px)',
          pointerEvents: 'none',
        }}
      />

      {/* Window frame */}
      <div
        style={{
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid var(--border)',
          background: 'var(--card)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        }}
      >
        {/* Chrome bar */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--secondary)',
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,90,90,0.65)' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,190,70,0.65)' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(70,200,90,0.65)' }} />
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <span
              style={{
                padding: '2px 16px', borderRadius: 4, fontSize: 11,
                background: 'var(--muted)', color: 'var(--muted-foreground)',
              }}
            >
              dotstell.app
            </span>
          </div>
        </div>

        {/* App layout */}
        <div style={{ display: 'flex', minHeight: 300 }}>
          {/* Sidebar */}
          <div
            className="hidden sm:flex"
            style={{
              width: 176, flexShrink: 0, flexDirection: 'column', gap: 2,
              padding: 8, borderRight: '1px solid var(--sidebar-border)',
              background: 'var(--sidebar-bg)',
            }}
          >
            {[
              { label: '📝 Notes', active: true },
              { label: '🔖 Bookmarks', active: false },
              { label: '👥 People', active: false },
              { label: '✅ Tasks', active: false },
              { label: '🌐 Graph', active: false },
            ].map(item => (
              <div
                key={item.label}
                style={{
                  padding: '6px 8px', borderRadius: 6, fontSize: 12,
                  background: item.active ? 'var(--sidebar-active-bg)' : 'transparent',
                  color: item.active ? 'var(--sidebar-active-fg)' : 'var(--sidebar-muted)',
                }}
              >
                {item.label}
              </div>
            ))}

            <div style={{ margin: '6px 0', borderTop: '1px solid var(--sidebar-border)' }} />

            {[
              { label: 'Getting started', color: '#7c6aff', active: true },
              { label: 'Project ideas', color: '#22c55e', active: false },
              { label: 'Reading list', color: '#f59e0b', active: false },
              { label: 'Q3 goals', color: '#ec4899', active: false },
            ].map(note => (
              <div
                key={note.label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '5px 8px', borderRadius: 6, fontSize: 11,
                  background: note.active ? 'var(--sidebar-active-bg)' : 'transparent',
                  color: note.active ? 'var(--foreground)' : 'var(--sidebar-muted)',
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: note.color, flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {note.label}
                </span>
              </div>
            ))}
          </div>

          {/* Note content */}
          <div style={{ flex: 1, padding: 20, overflow: 'hidden' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: 'var(--foreground)' }}>
              Getting started with Dotstell
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
              <p style={{ marginBottom: 10 }}>
                Your{' '}
                <span style={{ padding: '1px 6px', borderRadius: 4, background: 'rgba(124,106,255,0.18)', color: '#a090ff' }}>
                  knowledge graph
                </span>{' '}
                starts here. Link notes to people, tasks and bookmarks.
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {['[[Project ideas]]', '[[Alice Chen]]', '[[Q3 goals]]'].map(link => (
                  <span
                    key={link}
                    style={{
                      padding: '2px 7px', borderRadius: 4, fontSize: 10,
                      background: 'var(--accent)', color: 'var(--primary)',
                    }}
                  >
                    {link}
                  </span>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { done: true, text: 'Create your first note' },
                  { done: true, text: 'Save a bookmark' },
                  { done: false, text: 'Connect a note to a person' },
                  { done: false, text: 'Explore the knowledge graph' },
                ].map(item => (
                  <div key={item.text} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `1px solid ${item.done ? '#7c6aff' : 'var(--border)'}`,
                        background: item.done ? '#7c6aff' : 'transparent',
                      }}
                    >
                      {item.done && <span style={{ fontSize: 8, color: '#fff', lineHeight: 1 }}>✓</span>}
                    </div>
                    <span style={{ textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.45 : 1 }}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--background)', color: 'var(--foreground)' }}>

      {/* ── Top nav ──────────────────────────────────────────────── */}
      <nav
        style={{
          position: 'sticky', top: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(10,10,20,0.88)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
        }}
      >
        <DotstellLogo size="sm" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a
            href="https://www.dotstell.com/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ padding: '6px 12px', fontSize: 13, borderRadius: 6, color: 'var(--muted-foreground)', textDecoration: 'none' }}
          >
            About
          </a>
          <Link
            href="/auth/login"
            style={{ padding: '6px 12px', fontSize: 13, borderRadius: 6, color: 'var(--muted-foreground)', textDecoration: 'none' }}
          >
            Sign in
          </Link>
          <Link
            href="/auth/register"
            className="hover:opacity-90 transition-opacity"
            style={{
              padding: '6px 16px', fontSize: 13, borderRadius: 6,
              background: 'var(--primary)', color: '#fff',
              fontWeight: 500, textDecoration: 'none',
            }}
          >
            Get started free
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '80px 16px 72px' }}>
        {/* Glow */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(124,106,255,0.16) 0%, transparent 65%)',
          }}
        />

        <div style={{ position: 'relative', maxWidth: 640, width: '100%' }}>
          {/* Logo */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <DotstellLogo size="lg" />
          </div>

          {/* Status pill */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px', borderRadius: 999, marginBottom: 24, border: '1px solid rgba(124,106,255,0.35)', background: 'rgba(124,106,255,0.08)', color: 'var(--primary)', fontSize: 12 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
            Open source · Free forever
          </div>

          {/* Headline */}
          <h1
            style={{ fontSize: 'clamp(28px, 6vw, 48px)', fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.15, marginBottom: 20 }}
          >
            Your knowledge is scattered.<br />
            <span style={{ color: 'var(--primary)' }}>Dotstell connects it.</span>
          </h1>

          {/* Subheadline */}
          <p style={{ fontSize: 'clamp(14px, 2.5vw, 18px)', color: 'var(--muted-foreground)', marginBottom: 10, maxWidth: 500, margin: '0 auto 10px' }}>
            Notes, people, tasks and bookmarks — linked together in one living knowledge graph.
          </p>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', opacity: 0.65, marginBottom: 36 }}>
            Free and open source. No lock-in. Your data, your graph.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            <Link
              href="/auth/register"
              className="hover:opacity-90 transition-opacity"
              style={{ padding: '10px 24px', borderRadius: 8, background: 'var(--primary)', color: '#fff', fontWeight: 500, fontSize: 14, textDecoration: 'none' }}
            >
              Get started — it&apos;s free
            </Link>
            <Link
              href="/auth/login"
              className="hover:bg-[var(--accent)] transition-colors"
              style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--foreground)', fontSize: 14, textDecoration: 'none' }}
            >
              Sign in
            </Link>
          </div>

          {/* Trust line */}
          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', opacity: 0.55 }}>
            No credit card required · MIT licensed ·{' '}
            <a
              href="https://www.dotstell.com/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'underline', color: 'inherit' }}
            >
              Learn more at dotstell.com
            </a>
          </p>
        </div>
      </section>

      {/* ── App preview ──────────────────────────────────────────── */}
      <section style={{ padding: '0 16px 80px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <p style={{ textAlign: 'center', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted-foreground)', opacity: 0.5, marginBottom: 20 }}>
          Everything in one place
        </p>
        <AppMock />
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section style={{ padding: '0 16px 96px', maxWidth: 960, margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 700, marginBottom: 12 }}>
            One graph. Every thought.
          </h2>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
            Everything you capture lives together — and connects.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon, title, desc }) => (
            <div
              key={title}
              className="hover:border-[var(--primary)]/40 transition-colors"
              style={{
                borderRadius: 12, padding: '20px', border: '1px solid var(--border)',
                background: 'var(--card)',
              }}
            >
              <div style={{ fontSize: 24, marginBottom: 12 }}>{icon}</div>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{title}</h3>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Values strip ─────────────────────────────────────────── */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--card)', padding: '56px 16px' }}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10" style={{ maxWidth: 800, margin: '0 auto', textAlign: 'center' }}>
          {[
            { icon: '🔓', label: 'Open source', sub: 'MIT licensed. Fork it, self-host it, audit the code — it all belongs to you.' },
            { icon: '🔒', label: 'No lock-in', sub: 'Your notes are yours. No proprietary formats, no walled gardens, no vendor chains.' },
            { icon: '🚀', label: 'Built in public', sub: 'Every feature shipped transparently, one commit at a time on GitHub.' },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{item.icon}</div>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{item.label}</h3>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.65 }}>{item.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ───────────────────────────────────────────── */}
      <section style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '96px 16px' }}>
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 60% 50% at 50% 100%, rgba(124,106,255,0.12) 0%, transparent 65%)',
          }}
        />
        <div style={{ position: 'relative', maxWidth: 480 }}>
          <h2 style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 700, marginBottom: 16 }}>
            Start building your graph today.
          </h2>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 32 }}>
            Free, open source, and works in your browser — no setup needed.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link
              href="/auth/register"
              className="hover:opacity-90 transition-opacity"
              style={{ padding: '10px 24px', borderRadius: 8, background: 'var(--primary)', color: '#fff', fontWeight: 500, fontSize: 14, textDecoration: 'none' }}
            >
              Create free account
            </Link>
            <a
              href="https://www.dotstell.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:bg-[var(--accent)] transition-colors"
              style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--foreground)', fontSize: 14, textDecoration: 'none' }}
            >
              Learn more ↗
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid var(--border)',
          padding: '24px 16px',
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--muted-foreground)',
        }}
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <span>Open source · Built in public</span>
          <span className="hidden sm:inline" style={{ opacity: 0.35 }}>·</span>
          <a
            href="https://www.dotstell.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--foreground)] transition-colors"
          >
            dotstell.com
          </a>
          <span className="hidden sm:inline" style={{ opacity: 0.35 }}>·</span>
          <a
            href="mailto:hello@dotstell.com"
            className="hover:text-[var(--foreground)] transition-colors"
          >
            hello@dotstell.com
          </a>
        </div>
      </footer>
    </div>
  )
}
