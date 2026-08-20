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

const NAV_ITEMS = [
  { icon: '📄', label: 'Notes',     active: true  },
  { icon: '🔖', label: 'Bookmarks', active: false },
  { icon: '👥', label: 'People',    active: false },
  { icon: '✅', label: 'Tasks',     active: false },
  { icon: '🌐', label: 'Graph',     active: false },
]

const NOTEBOOK_ITEMS = [
  { icon: '📁', label: 'Personal' },
  { icon: '📁', label: 'Work'     },
  { icon: '📁', label: 'Research' },
]

const NOTE_CARDS = [
  { title: 'Getting started',   snippet: 'Your knowledge graph starts here. Link notes to people and tasks.',   color: '#7c6aff', date: 'Today',     active: true  },
  { title: 'Project ideas',     snippet: 'Connected to [[Alice Chen]] and [[Q3 goals]] — 3 open tasks.',        color: '#22c55e', date: 'Yesterday', active: false },
  { title: 'Reading list',      snippet: 'Books, articles and resources to revisit this month.',                 color: '#f59e0b', date: 'Mon',        active: false },
  { title: 'Q3 retrospective',  snippet: 'What went well · What to improve · Action items for Q4.',             color: '#ec4899', date: 'Last week',  active: false },
]

function AppMock() {
  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 900, margin: '0 auto' }}>
      {/* Glow behind window */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: '-20px',
          background: 'radial-gradient(ellipse at 50% 50%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 68%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
          borderRadius: 24,
        }}
      />

      {/* Browser window frame */}
      <div
        style={{
          position: 'relative',
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid var(--border)',
          background: 'var(--card)',
          boxShadow: '0 28px 80px rgba(0,0,0,0.55)',
        }}
      >
        {/* Chrome bar */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '9px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--secondary)',
          }}
        >
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: 'rgba(255,95,86,0.8)'  }} />
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: 'rgba(255,189,46,0.8)' }} />
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: 'rgba(39,201,63,0.8)'  }} />
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <span
              style={{
                padding: '3px 18px', borderRadius: 5, fontSize: 11,
                background: 'var(--muted)', color: 'var(--muted-foreground)',
                letterSpacing: '0.02em',
              }}
            >
              dotstell.app/notes
            </span>
          </div>
          <div style={{ width: 66, flexShrink: 0 }} />
        </div>

        {/* ── 3-panel app layout ── */}
        <div style={{ display: 'flex', height: 340, overflow: 'hidden' }}>

          {/* Panel 1 — Nav sidebar (hidden on mobile) */}
          <div
            className="hidden sm:flex"
            style={{
              width: 148, flexShrink: 0, flexDirection: 'column',
              padding: '10px 6px',
              borderRight: '1px solid var(--sidebar-border)',
              background: 'var(--sidebar-bg)',
              gap: 2,
            }}
          >
            <div style={{ padding: '4px 8px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--sidebar-section-fg)', textTransform: 'uppercase' }}>
              Workspace
            </div>
            {NAV_ITEMS.map(item => (
              <div
                key={item.label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '6px 10px', borderRadius: 6, fontSize: 12,
                  fontWeight: item.active ? 500 : 400,
                  background: item.active ? 'var(--sidebar-active-bg)' : 'transparent',
                  color: item.active ? 'var(--sidebar-active-fg)' : 'var(--sidebar-muted)',
                  cursor: 'default',
                }}
              >
                <span style={{ fontSize: 13, lineHeight: 1, flexShrink: 0, opacity: item.active ? 1 : 0.65 }}>{item.icon}</span>
                {item.label}
              </div>
            ))}
            <div style={{ margin: '8px 0 4px', borderTop: '1px solid var(--sidebar-border)' }} />
            <div style={{ padding: '4px 8px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--sidebar-section-fg)', textTransform: 'uppercase' }}>
              Notebooks
            </div>
            {NOTEBOOK_ITEMS.map(nb => (
              <div
                key={nb.label}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '5px 10px', borderRadius: 6, fontSize: 11,
                  color: 'var(--sidebar-muted)', cursor: 'default',
                }}
              >
                <span style={{ fontSize: 11, lineHeight: 1, flexShrink: 0, opacity: 0.6 }}>{nb.icon}</span>
                {nb.label}
              </div>
            ))}
          </div>

          {/* Panel 2 — Notes list (hidden on mobile and small tablets) */}
          <div
            className="hidden md:flex"
            style={{
              width: 220, flexShrink: 0, flexDirection: 'column',
              borderRight: '1px solid var(--sidebar-border)',
              background: 'var(--sidebar-bg)',
              overflow: 'hidden',
            }}
          >
            {/* Search */}
            <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid var(--sidebar-border)' }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 10px', borderRadius: 6, fontSize: 11,
                  background: 'var(--sidebar-search-bg)', color: 'var(--sidebar-muted)',
                }}
              >
                <span style={{ opacity: 0.6 }}>🔍</span>
                <span>Search notes…</span>
              </div>
            </div>

            {/* Note cards */}
            <div style={{ flex: 1, overflow: 'hidden', padding: '6px 0' }}>
              {NOTE_CARDS.map(note => (
                <div
                  key={note.title}
                  style={{
                    padding: '8px 10px 8px 12px',
                    borderLeft: `3px solid ${note.active ? note.color : 'transparent'}`,
                    background: note.active ? 'var(--sidebar-active-bg)' : 'transparent',
                    cursor: 'default',
                    marginBottom: 2,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span
                      style={{
                        fontSize: 12, fontWeight: 600,
                        color: note.active ? 'var(--foreground)' : 'var(--muted-foreground)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140,
                      }}
                    >
                      {note.title}
                    </span>
                    <span style={{ fontSize: 9, color: 'var(--sidebar-muted)', flexShrink: 0, marginLeft: 4 }}>
                      {note.date}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 10, color: 'var(--sidebar-muted)', lineHeight: 1.4,
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {note.snippet}
                  </div>
                  {note.active && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 5 }}>
                      <span style={{ padding: '1px 5px', borderRadius: 3, fontSize: 9, background: 'rgba(124,106,255,0.18)', color: '#9080ff' }}>notes</span>
                      <span style={{ padding: '1px 5px', borderRadius: 3, fontSize: 9, background: 'rgba(124,106,255,0.18)', color: '#9080ff' }}>getting-started</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Panel 3 — Note editor */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--background)' }}>
            {/* Editor top bar */}
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 16px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              {/* Formatting toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {['B', 'I', 'U'].map(fmt => (
                  <div
                    key={fmt}
                    style={{
                      width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 4, fontSize: 11, fontWeight: fmt === 'B' ? 700 : 400,
                      fontStyle: fmt === 'I' ? 'italic' : 'normal',
                      background: 'var(--accent)', color: 'var(--muted-foreground)', cursor: 'default',
                    }}
                  >
                    {fmt}
                  </div>
                ))}
                <div style={{ width: 1, height: 14, background: 'var(--border)', margin: '0 4px' }} />
                <div style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'default' }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: '#7c6aff' }} />
                </div>
                <div style={{ width: 22, height: 22, borderRadius: 4, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'var(--muted-foreground)', cursor: 'default' }}>A</div>
              </div>
              {/* Color dot indicator */}
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#7c6aff', flexShrink: 0 }} />
            </div>

            {/* Note content */}
            <div style={{ flex: 1, padding: '20px 20px 12px', overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: 17, fontWeight: 700, marginBottom: 14,
                  color: 'var(--foreground)', letterSpacing: '-0.2px',
                }}
              >
                Getting started with Dotstell
              </div>

              <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.7 }}>
                <p style={{ marginBottom: 10 }}>
                  Your{' '}
                  <span style={{ padding: '1px 5px', borderRadius: 3, background: 'rgba(124,106,255,0.2)', color: '#a090ff' }}>
                    knowledge graph
                  </span>{' '}
                  starts here. Every note, person and task you add becomes a node — link them and watch your graph grow.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                  {['[[Project ideas]]', '[[Alice Chen]]', '[[Q3 goals]]'].map(link => (
                    <span
                      key={link}
                      style={{
                        padding: '2px 7px', borderRadius: 4, fontSize: 10,
                        background: 'var(--accent)', color: 'var(--primary)', cursor: 'default',
                      }}
                    >
                      {link}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {[
                    { done: true,  text: 'Create your first note' },
                    { done: true,  text: 'Save a bookmark with auto-fetch' },
                    { done: false, text: 'Connect a note to a person' },
                    { done: false, text: 'Explore your knowledge graph' },
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
                      <span style={{ textDecoration: item.done ? 'line-through' : 'none', opacity: item.done ? 0.4 : 1 }}>
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
          background: 'color-mix(in srgb, var(--card) 92%, transparent)',
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
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 60% 50% at 50% 0%, color-mix(in srgb, var(--primary) 16%, transparent) 0%, transparent 65%)',
          }}
        />

        <div style={{ position: 'relative', maxWidth: 640, width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <DotstellLogo size="lg" />
          </div>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px', borderRadius: 999, marginBottom: 24, border: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)', background: 'color-mix(in srgb, var(--primary) 8%, transparent)', color: 'var(--primary)', fontSize: 12 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
            Open source · Free forever
          </div>

          <h1 style={{ fontSize: 'clamp(28px, 6vw, 48px)', fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.15, marginBottom: 20 }}>
            Your knowledge is scattered.<br />
            <span style={{ color: 'var(--primary)' }}>Dotstell connects it.</span>
          </h1>

          <p style={{ fontSize: 'clamp(14px, 2.5vw, 18px)', color: 'var(--muted-foreground)', maxWidth: 500, margin: '0 auto 10px' }}>
            Notes, people, tasks and bookmarks — linked together in one living knowledge graph.
          </p>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', opacity: 0.65, marginBottom: 36 }}>
            Free and open source. No lock-in. Your data, your graph.
          </p>

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

          <p style={{ fontSize: 12, color: 'var(--muted-foreground)', opacity: 0.55 }}>
            No credit card required · AGPL-3.0 licensed ·{' '}
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
              style={{ borderRadius: 12, padding: '20px', border: '1px solid var(--border)', background: 'var(--card)' }}
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
            { icon: '🔓', label: 'Open source',    sub: 'AGPL-3.0 licensed. Fork it, self-host it, audit the code — the source is always open.'    },
            { icon: '🔒', label: 'No lock-in',      sub: 'Your notes are yours. No proprietary formats, no walled gardens, no vendor chains.'        },
            { icon: '📡', label: 'Built in public', sub: 'Development happens openly on GitHub — issues, roadmap and every change are visible to anyone.' },
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
            background: 'radial-gradient(ellipse 60% 50% at 50% 100%, color-mix(in srgb, var(--primary) 12%, transparent) 0%, transparent 65%)',
          }}
        />
        <div style={{ position: 'relative', maxWidth: 480 }}>
          <h2 style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 700, marginBottom: 16 }}>
            Start building your graph today.
          </h2>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 32 }}>
            Works in your browser or as a native desktop app for Windows — free, open source, no setup needed.
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
