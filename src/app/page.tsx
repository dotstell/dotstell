import Link from 'next/link'
import { DotstellLogo } from '@/components/brand/DotstellLogo'
import { FeatureCarousel } from '@/components/brand/FeatureCarousel'
import { APP_VERSION } from '@/lib/version'

export const dynamic = 'force-dynamic'


export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--background)', color: 'var(--foreground)' }}>

      {/* ── Top nav ── */}
      <nav
        style={{
          position: 'sticky', top: 0, zIndex: 50,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 24px',
          borderBottom: '1px solid var(--border)',
          background: 'color-mix(in srgb, var(--card) 92%, transparent)',
          backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
        }}
      >
        <DotstellLogo size="sm" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href="https://www.dotstell.com/" target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', fontSize: 13, borderRadius: 6, color: 'var(--muted-foreground)', textDecoration: 'none' }}>About</a>
          <a href="https://github.com/dotstell/dotstell" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)] transition-colors" style={{ padding: '6px 12px', fontSize: 13, borderRadius: 6, color: 'var(--muted-foreground)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" /></svg>
            GitHub
          </a>
          <Link href="/auth/login" style={{ padding: '6px 12px', fontSize: 13, borderRadius: 6, color: 'var(--muted-foreground)', textDecoration: 'none' }}>Sign in</Link>
          <Link href="/auth/register" className="hover:opacity-90 transition-opacity" style={{ padding: '6px 16px', fontSize: 13, borderRadius: 6, background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 500, textDecoration: 'none' }}>
            Get started free
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '80px 16px 72px' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 60% 50% at 50% 0%, color-mix(in srgb, var(--primary) 16%, transparent) 0%, transparent 65%)' }} />
        <div style={{ position: 'relative', maxWidth: 640, width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <DotstellLogo size="lg" />
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px', borderRadius: 999, marginBottom: 24, border: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)', background: 'color-mix(in srgb, var(--primary) 8%, transparent)', color: 'var(--primary)', fontSize: 12 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
            v{APP_VERSION} · AI that knows your entire knowledge base · Free &amp; open source
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 6vw, 48px)', fontWeight: 700, letterSpacing: '-0.5px', lineHeight: 1.15, marginBottom: 20 }}>
            Your knowledge is scattered.<br />
            <span style={{ color: 'var(--primary)' }}>Dotstell connects it.</span>
          </h1>
          <p style={{ fontSize: 'clamp(14px, 2.5vw, 18px)', color: 'var(--muted-foreground)', maxWidth: 560, margin: '0 auto 24px' }}>
            Ideas, research, meeting notes, 1-on-1s, and everything worth remembering — capture it all, connect it with people, tasks, and bookmarks, and chat with{' '}
            <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>AI that answers from your own knowledge.</span>
          </p>

          {/* Capture → Connect → Ask */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 32, flexWrap: 'wrap' }}>
            {[
              { label: 'Capture', color: '#22c55e'  },
              { label: 'Connect', color: '#7c6aff'  },
              { label: 'Ask',     color: '#f59e0b'  },
            ].map(({ label, color }, i, arr) => (
              <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: `1px solid ${color}40`, background: `${color}12`, color }}>
                  {label}
                </span>
                {i < arr.length - 1 && (
                  <span style={{ fontSize: 14, color: 'var(--muted-foreground)', opacity: 0.4 }}>→</span>
                )}
              </span>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <Link href="/auth/register" className="hover:opacity-90 transition-opacity" style={{ padding: '10px 24px', borderRadius: 8, background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 500, fontSize: 14, textDecoration: 'none' }}>
              Get started — it&apos;s free
            </Link>
            <Link href="/auth/login" className="hover:bg-[var(--accent)] transition-colors" style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--foreground)', fontSize: 14, textDecoration: 'none' }}>
              Sign in
            </Link>
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', opacity: 0.5, marginBottom: 4 }}>
            Run AI privately with Ollama · No data sent to Dotstell · AGPL-3.0 open source
          </p>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', opacity: 0.45 }}>
            No credit card required ·{' '}
            <a href="https://www.dotstell.com/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'underline', color: 'inherit' }}>Learn more at dotstell.com</a>
          </p>
        </div>
      </section>

      {/* ── Feature carousel ── */}
      <FeatureCarousel />

      {/* ── Values strip ── */}
      <section style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--card)', padding: '56px 16px' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10" style={{ maxWidth: 960, margin: '0 auto', textAlign: 'center' }}>
          {[
            { icon: '🔓', label: 'Open source',    sub: 'AGPL-3.0 licensed. Fork it, self-host it, audit the code — the source is always open.' },
            { icon: '🔒', label: 'No lock-in',      sub: 'Your notes are yours. No proprietary formats, no walled gardens, no vendor chains.'    },
            { icon: '📡', label: 'Built in public', sub: 'Development happens openly on GitHub — issues, roadmap and every change are visible to anyone.' },
            { icon: '📱', label: 'Mobile ready',    sub: 'Fully responsive on phone, tablet, and desktop — touch-optimised with a native-feeling nav.' },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{item.icon}</div>
              <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{item.label}</h3>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.65 }}>{item.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '96px 16px' }}>
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 60% 50% at 50% 100%, color-mix(in srgb, var(--primary) 12%, transparent) 0%, transparent 65%)' }} />
        <div style={{ position: 'relative', maxWidth: 480 }}>
          <h2 style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 700, marginBottom: 16 }}>Start building your graph today.</h2>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', marginBottom: 32 }}>
            Works in your browser or as a native desktop app for Windows — free, open source, no setup needed.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/auth/register" className="hover:opacity-90 transition-opacity" style={{ padding: '10px 24px', borderRadius: 8, background: 'var(--primary)', color: 'var(--primary-foreground)', fontWeight: 500, fontSize: 14, textDecoration: 'none' }}>
              Create free account
            </Link>
            <a href="https://www.dotstell.com/" target="_blank" rel="noopener noreferrer" className="hover:bg-[var(--accent)] transition-colors" style={{ padding: '10px 24px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--foreground)', fontSize: 14, textDecoration: 'none' }}>
              Learn more ↗
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '24px 16px', textAlign: 'center', fontSize: 12, color: 'var(--muted-foreground)' }}>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <span>Open source · AGPL-3.0</span>
          <span className="hidden sm:inline" style={{ opacity: 0.35 }}>·</span>
          <a href="https://github.com/dotstell/dotstell" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)] transition-colors">GitHub</a>
          <span className="hidden sm:inline" style={{ opacity: 0.35 }}>·</span>
          <a href="https://www.dotstell.com/" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--foreground)] transition-colors">dotstell.com</a>
          <span className="hidden sm:inline" style={{ opacity: 0.35 }}>·</span>
          <a href="mailto:hello@dotstell.com" className="hover:text-[var(--foreground)] transition-colors">hello@dotstell.com</a>
        </div>
      </footer>
    </div>
  )
}
