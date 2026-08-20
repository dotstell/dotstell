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
  { label: 'Personal', color: '#7c6aff' },
  { label: 'Work',     color: '#22c55e' },
  { label: 'Research', color: '#f59e0b' },
]

// Colour-labelled notes — highlight the visual organisation feature
const MOCK_NOTES = [
  { title: 'Product Launch Plan',          snippet: 'Timeline, stakeholders and key milestones for the Q3 release.',     color: '#7c6aff', tag: 'Rich text', time: '2h ago'   },
  { title: 'Security Audit Checklist',     snippet: 'NIST · ISO27001 · PCI-DSS · CRA — open items tracked per standard.', color: '#ef4444', tag: 'Checklist', time: '4h ago'   },
  { title: 'Meeting Notes — Q3 Review',    snippet: 'What went well · blockers · action items for next sprint.',          color: '#22c55e', tag: 'Rich text', time: 'Yesterday' },
  { title: 'Research: Knowledge Graphs',   snippet: 'Links, papers and key quotes on connected note-taking systems.',     color: '#f59e0b', tag: 'Plain',     time: 'Mon'      },
  { title: 'Architecture Decision Record', snippet: 'Why we chose PostgreSQL + Redis over a document store.',             color: null,      tag: 'Rich text', time: 'Last week' },
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
          position: 'relative', borderRadius: 12, overflow: 'hidden',
          border: '1px solid var(--border)', background: 'var(--card)',
          boxShadow: '0 28px 80px rgba(0,0,0,0.45)',
        }}
      >
        {/* Chrome bar */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '9px 16px', borderBottom: '1px solid var(--border)',
            background: 'var(--secondary)',
          }}
        >
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: 'rgba(255,95,86,0.8)'  }} />
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: 'rgba(255,189,46,0.8)' }} />
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: 'rgba(39,201,63,0.8)'  }} />
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <span style={{ padding: '3px 18px', borderRadius: 5, fontSize: 11, background: 'var(--muted)', color: 'var(--muted-foreground)', letterSpacing: '0.02em' }}>
              dotstell.app/notes
            </span>
          </div>
          <div style={{ width: 66, flexShrink: 0 }} />
        </div>

        {/* ── 2-panel: sidebar + notes list ── */}
        <div style={{ display: 'flex', height: 370, overflow: 'hidden' }}>

          {/* Sidebar (hidden on mobile) */}
          <div
            className="hidden sm:flex"
            style={{
              width: 148, flexShrink: 0, flexDirection: 'column',
              padding: '10px 6px', gap: 2,
              borderRight: '1px solid var(--sidebar-border)',
              background: 'var(--sidebar-bg)',
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
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: nb.color, flexShrink: 0 }} />
                {nb.label}
              </div>
            ))}
          </div>

          {/* Notes list (main area) */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--background)' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>All Notes</div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>{MOCK_NOTES.length} notes</div>
              </div>
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                  background: 'var(--primary)', color: 'var(--primary-foreground)', cursor: 'default',
                }}
              >
                <span style={{ fontSize: 14, lineHeight: 1 }}>+</span> New note
              </div>
            </div>

            {/* Filter bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
              {['All', 'Rich text', 'Plain', 'Checklist'].map((f, i) => (
                <div
                  key={f}
                  style={{
                    padding: '3px 10px', borderRadius: 999, fontSize: 11, cursor: 'default',
                    background: i === 0 ? 'var(--primary)' : 'var(--accent)',
                    color: i === 0 ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                    fontWeight: i === 0 ? 600 : 400,
                  }}
                >
                  {f}
                </div>
              ))}
              <div style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted-foreground)', opacity: 0.55, whiteSpace: 'nowrap' }}>
                Right-click for options
              </div>
            </div>

            {/* Colour-labelled note rows */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {MOCK_NOTES.map((note, i) => (
                <div
                  key={note.title}
                  style={{
                    display: 'flex', alignItems: 'center',
                    padding: '9px 16px 9px 0',
                    borderLeft: `4px solid ${note.color ?? 'transparent'}`,
                    background: i === 0 ? 'color-mix(in srgb, var(--primary) 6%, transparent)' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'default',
                  }}
                >
                  <div style={{ padding: '0 12px', color: 'var(--muted-foreground)', opacity: 0.45, fontSize: 14, flexShrink: 0 }}>📄</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: i === 0 ? 600 : 500, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                      {note.title}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.75 }}>
                      {note.snippet}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, marginLeft: 12 }}>
                    <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, background: 'var(--accent)', color: 'var(--muted-foreground)' }}>
                      {note.tag}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--muted-foreground)', opacity: 0.55, whiteSpace: 'nowrap' }}>
                      {note.time}
                    </span>
                  </div>
                </div>
              ))}
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
            style={{ padding: '6px 16px', fontSize: 13, borderRadius: 6, background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 500, textDecoration: 'none' }}
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
              style={{ padding: '10px 24px', borderRadius: 8, background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 500, fontSize: 14, textDecoration: 'none' }}
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
            { icon: '🔓', label: 'Open source',    sub: 'AGPL-3.0 licensed. Fork it, self-host it, audit the code — the source is always open.'                        },
            { icon: '🔒', label: 'No lock-in',      sub: 'Your notes are yours. No proprietary formats, no walled gardens, no vendor chains.'                           },
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
              style={{ padding: '10px 24px', borderRadius: 8, background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 500, fontSize: 14, textDecoration: 'none' }}
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
      <footer style={{ borderTop: '1px solid var(--border)', padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--muted-foreground)' }}>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <span>Open source · Built in public</span>
          <span className="hidden sm:inline" style={{ opacity: 0.35 }}>·</span>
          <a href="https://www.dotstell.com/" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)] transition-colors">
            dotstell.com
          </a>
          <span className="hidden sm:inline" style={{ opacity: 0.35 }}>·</span>
          <a href="mailto:hello@dotstell.com" className="hover:text-[var(--foreground)] transition-colors">
            hello@dotstell.com
          </a>
        </div>
      </footer>
    </div>
  )
}
