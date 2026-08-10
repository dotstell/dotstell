import Link from 'next/link'
import { DotstellLogo } from '@/components/brand/DotstellLogo'

export const dynamic = 'force-dynamic'

// ── Animated knowledge graph SVG ────────────────────────────────
function KnowledgeGraphViz() {
  const nodes = [
    { id: 'hub',    x: 200, y: 190, r: 15, color: '#7c6aff', label: 'dotstell', ly: 215 },
    { id: 'notes',  x: 200, y:  72, r: 11, color: '#a78bfa', label: 'Notes',    ly:  59 },
    { id: 'people', x:  84, y: 265, r: 10, color: '#10b981', label: 'People',   ly: 283 },
    { id: 'bmarks', x: 322, y: 265, r: 10, color: '#f59e0b', label: 'Bookmarks',ly: 283 },
    { id: 'tasks',  x: 322, y: 122, r:  9, color: '#ef4444', label: 'Tasks',    ly: 110 },
    { id: 'idea1',  x:  84, y: 130, r:  7, color: '#8b5cf6', label: 'Ideas',    ly: 118 },
    { id: 'sub1',   x: 236, y:  44, r:  5, color: '#a78bfa', label: '',         ly:  36 },
    { id: 'link2',  x: 352, y: 200, r:  5, color: '#f59e0b', label: '',         ly: 193 },
  ]
  const nm = Object.fromEntries(nodes.map(n => [n.id, n]))
  const edges = [
    { f: 'hub',   t: 'notes',  d: '0.1s', dr: '1.1s' },
    { f: 'hub',   t: 'people', d: '0.4s', dr: '1.1s' },
    { f: 'hub',   t: 'bmarks', d: '0.7s', dr: '1.1s' },
    { f: 'hub',   t: 'tasks',  d: '1.0s', dr: '1.0s' },
    { f: 'hub',   t: 'idea1',  d: '1.2s', dr: '0.9s' },
    { f: 'hub',   t: 'sub1',   d: '1.4s', dr: '0.8s' },
    { f: 'hub',   t: 'link2',  d: '1.5s', dr: '0.8s' },
    { f: 'notes', t: 'tasks',  d: '1.8s', dr: '0.7s' },
    { f: 'people',t: 'bmarks', d: '2.0s', dr: '0.7s' },
    { f: 'notes', t: 'idea1',  d: '2.2s', dr: '0.6s' },
  ]
  function len(a: string, b: string) {
    const p = nm[a], q = nm[b]
    return Math.hypot(q.x - p.x, q.y - p.y)
  }
  return (
    <svg
      viewBox="0 0 406 310"
      style={{ width: '100%', maxWidth: 460, overflow: 'visible', filter: 'drop-shadow(0 0 40px rgba(124,106,255,0.18))' }}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="rg-hub" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7c6aff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#7c6aff" stopOpacity="0" />
        </radialGradient>
        <filter id="glow-sm"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="glow-lg"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>

      {/* Background halo */}
      <circle cx="200" cy="190" r="130" fill="url(#rg-hub)">
        <animate attributeName="r" values="120;145;120" dur="6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;1;0.7" dur="6s" repeatCount="indefinite" />
      </circle>

      {/* Edges */}
      {edges.map(e => {
        const l = len(e.f, e.t)
        const f = nm[e.f], t = nm[e.t]
        return (
          <line key={`${e.f}-${e.t}`}
            x1={f.x} y1={f.y} x2={t.x} y2={t.y}
            stroke="#7c6aff" strokeWidth="1" strokeOpacity="0"
            strokeDasharray={l} strokeDashoffset={l}
          >
            <animate attributeName="stroke-dashoffset" from={l} to="0" dur={e.dr} begin={e.d} fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1" />
            <animate attributeName="stroke-opacity" from="0" to="0.3" dur="0.3s" begin={e.d} fill="freeze" />
          </line>
        )
      })}

      {/* Nodes */}
      {nodes.map((n, i) => (
        <g key={n.id} filter="url(#glow-sm)">
          {/* Outer pulse ring */}
          <circle cx={n.x} cy={n.y} r={n.r * 2.4} fill={n.color} fillOpacity="0">
            <animate attributeName="fill-opacity" values="0;0.1;0" dur={`${3 + i * 0.5}s`} repeatCount="indefinite" begin={`${i * 0.3}s`} />
            <animate attributeName="r" values={`${n.r*2};${n.r*3.2};${n.r*2}`} dur={`${3+i*0.5}s`} repeatCount="indefinite" begin={`${i*0.3}s`} />
          </circle>
          {/* Main node */}
          <circle cx={n.x} cy={n.y} r={n.r}
            fill={n.color} fillOpacity="0.18"
            stroke={n.color} strokeWidth="1.5" strokeOpacity="0"
          >
            <animate attributeName="stroke-opacity" from="0" to="0.85" dur="0.4s" begin={`${0.08 + i * 0.13}s`} fill="freeze" />
            <animate attributeName="fill-opacity" from="0" to="0.18" dur="0.4s" begin={`${0.08 + i * 0.13}s`} fill="freeze" />
          </circle>
          {/* Inner dot */}
          <circle cx={n.x} cy={n.y} r={n.r * 0.42} fill={n.color} opacity="0">
            <animate attributeName="opacity" from="0" to="1" dur="0.35s" begin={`${0.18 + i * 0.13}s`} fill="freeze" />
          </circle>
          {/* Label */}
          {n.label && (
            <text x={n.x} y={n.ly} textAnchor="middle" fill={n.color} fontSize="10.5" fontWeight="600"
              opacity="0" fontFamily="system-ui,-apple-system,sans-serif"
            >
              <animate attributeName="opacity" from="0" to="0.9" dur="0.4s" begin={`${0.35 + i * 0.13}s`} fill="freeze" />
              {n.label}
            </text>
          )}
        </g>
      ))}

      {/* Hub pulse rings */}
      {[0, 1].map(i => (
        <circle key={i} cx="200" cy="190" r="15" fill="none" stroke="#7c6aff" strokeWidth="1" strokeOpacity="0">
          <animate attributeName="r" values="15;55;80" dur={`${2.4 + i}s`} begin={`${i * 1.2}s`} repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.7;0.15;0" dur={`${2.4 + i}s`} begin={`${i * 1.2}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  )
}

// ── App UI preview mockup (pure HTML/CSS) ───────────────────────
function AppPreview() {
  const noteItems = [
    { title: 'Team standup', active: true, dot: '#7c6aff' },
    { title: 'Decision: auth flow', active: false, dot: '#10b981' },
    { title: 'API design review', active: false, dot: '#7c6aff' },
    { title: 'Q3 planning notes', active: false, dot: '#f59e0b' },
    { title: 'Hiring pipeline', active: false, dot: '#7c6aff' },
  ]
  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden',
      border: '1px solid rgba(124,106,255,0.35)',
      boxShadow: '0 32px 96px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), 0 0 80px rgba(124,106,255,0.08)',
      background: '#0c0c1d',
      width: '100%', maxWidth: 560,
    }}>
      {/* Window chrome */}
      <div style={{ height: 38, background: '#080814', borderBottom: '1px solid #1a1a30', display: 'flex', alignItems: 'center', padding: '0 14px', gap: 6 }}>
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }} />
        <span style={{ width: 11, height: 11, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
        <div style={{ flex: 1, height: 20, background: '#111128', borderRadius: 5, marginLeft: 10, display: 'flex', alignItems: 'center', paddingLeft: 10, gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(124,106,255,0.5)', flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: '#4040a0', fontFamily: 'monospace' }}>dotstell.app/notes</span>
        </div>
      </div>

      {/* App body */}
      <div style={{ display: 'flex', height: 320 }}>
        {/* Sidebar icons */}
        <div style={{ width: 46, background: '#070712', borderRight: '1px solid #1a1a30', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 14, gap: 14 }}>
          {[
            { bg: '#7c6aff', active: false },
            { bg: '#7c6aff', active: true },
            { bg: '#10b981', active: false },
            { bg: '#f59e0b', active: false },
            { bg: '#ef4444', active: false },
          ].map((item, i) => (
            <div key={i} style={{
              width: 28, height: 28, borderRadius: 8,
              background: item.active ? item.bg : 'rgba(255,255,255,0.05)',
              border: item.active ? 'none' : '1px solid rgba(255,255,255,0.06)',
              position: 'relative',
            }}>
              {item.active && <div style={{ position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)', width: 3, height: 18, borderRadius: 2, background: item.bg }} />}
            </div>
          ))}
        </div>

        {/* Notes list */}
        <div style={{ width: 155, borderRight: '1px solid #1a1a30', padding: '10px 6px', background: '#0c0c1d', overflow: 'hidden' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#3a3a70', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '0 6px 8px' }}>All notes</div>
          {noteItems.map(n => (
            <div key={n.title} style={{
              padding: '7px 8px', borderRadius: 7, fontSize: 10.5, marginBottom: 2,
              background: n.active ? 'rgba(124,106,255,0.14)' : 'transparent',
              color: n.active ? '#c0b0ff' : '#4848a0',
              display: 'flex', alignItems: 'center', gap: 7,
              borderLeft: n.active ? '2px solid #7c6aff' : '2px solid transparent',
            }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: n.dot, opacity: n.active ? 1 : 0.35, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
            </div>
          ))}
        </div>

        {/* Editor */}
        <div style={{ flex: 1, padding: '14px 18px', overflow: 'hidden', background: '#0a0a18' }}>
          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 14, borderBottom: '1px solid #1a1a30', paddingBottom: 10 }}>
            {['Team standup', 'API design'].map((t, i) => (
              <div key={t} style={{
                fontSize: 10, padding: '4px 10px', borderRadius: '6px 6px 0 0',
                background: i === 0 ? 'rgba(124,106,255,0.15)' : 'transparent',
                color: i === 0 ? '#a090ff' : '#3a3a70',
                borderBottom: i === 0 ? '2px solid #7c6aff' : '2px solid transparent',
              }}>{t}</div>
            ))}
          </div>
          {/* Note title */}
          <div style={{ fontSize: 17, fontWeight: 700, color: '#e0e0f0', marginBottom: 10 }}>Team standup</div>
          {/* Tags */}
          <div style={{ display: 'flex', gap: 5, marginBottom: 14 }}>
            {['nb:engineering', 'standup'].map(tag => (
              <span key={tag} style={{ fontSize: 9, color: '#7c6aff', background: 'rgba(124,106,255,0.15)', padding: '2px 7px', borderRadius: 99, border: '1px solid rgba(124,106,255,0.25)' }}>{tag}</span>
            ))}
          </div>
          {/* Content lines */}
          {[
            { text: 'Review PR #204', check: true, checked: false, color: '#ef4444' },
            { text: 'Sync with [[Sarah Chen]]', check: true, checked: true, color: '#10b981' },
            { text: 'Update [[API Design doc]]', check: false, checked: false, color: '#a090ff' },
            { text: 'Yesterday · fixed auth bug · merged #198', check: false, checked: false, color: '#3a3a70' },
          ].map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
              {item.check && (
                <div style={{ width: 12, height: 12, borderRadius: 3, border: `1.5px solid ${item.color}`, background: item.checked ? item.color : 'transparent', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.checked && <div style={{ width: 5, height: 5, borderRadius: 1, background: 'white' }} />}
                </div>
              )}
              {!item.check && <div style={{ width: 3, height: 3, borderRadius: '50%', background: item.color, flexShrink: 0, marginLeft: 4 }} />}
              <span style={{ fontSize: 11, color: item.checked ? '#2a2a5a' : item.color === '#a090ff' ? '#c0b0ff' : item.color === '#3a3a70' ? '#3a3a70' : '#e0e0f0', textDecoration: item.checked ? 'line-through' : 'none' }}>
                {item.text}
              </span>
            </div>
          ))}
          <div style={{ marginTop: 16, fontSize: 10, color: '#2a2a5a', fontStyle: 'italic' }}>Start writing… type / for commands</div>
        </div>
      </div>
    </div>
  )
}

// ── Landing page ─────────────────────────────────────────────────
export default function LandingPage() {
  const features = [
    {
      color: '#7c6aff',
      bg: 'rgba(124,106,255,0.08)',
      border: 'rgba(124,106,255,0.2)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c6aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
      title: 'Smart Notes',
      desc: 'Rich text editor with slash commands, tabs, notebooks, wikilinks, and templates — everything connected.',
      tag: 'Write & Link',
    },
    {
      color: '#f59e0b',
      bg: 'rgba(245,158,11,0.08)',
      border: 'rgba(245,158,11,0.2)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
      ),
      title: 'Smart Bookmarks',
      desc: 'Drop a URL — title, description, and favicon fetched instantly. Tag, search, and browse 936+ links with ease.',
      tag: 'Save & Find',
    },
    {
      color: '#10b981',
      bg: 'rgba(16,185,129,0.08)',
      border: 'rgba(16,185,129,0.2)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
      ),
      title: 'Knowledge Graph',
      desc: 'Every note, person, task, and bookmark becomes a node. Watch your knowledge map build itself in real time.',
      tag: 'See & Explore',
    },
    {
      color: '#ef4444',
      bg: 'rgba(239,68,68,0.08)',
      border: 'rgba(239,68,68,0.2)',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
        </svg>
      ),
      title: 'Tasks & People',
      desc: 'Track what matters and who matters. Link tasks to notes, people to bookmarks — nothing lives in isolation.',
      tag: 'Track & Connect',
    },
  ]

  const steps = [
    { n: '01', title: 'Write a note', desc: 'Start typing. Use [[double brackets]] to link to anything — people, bookmarks, other notes.', color: '#7c6aff' },
    { n: '02', title: 'Save what inspires you', desc: 'Paste any URL. Metadata is fetched automatically. Tag it, link it, find it again in seconds.', color: '#f59e0b' },
    { n: '03', title: 'Watch the graph grow', desc: 'Every link you make becomes an edge. Open Graph view and see the shape of your thinking.', color: '#10b981' },
  ]

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(22px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes gradShift {
          0%,100% { background-position:0% 50%; }
          50%      { background-position:100% 50%; }
        }
        @keyframes orbFloat {
          0%,100% { transform:translate(0,0) scale(1); }
          33%     { transform:translate(24px,-36px) scale(1.04); }
          66%     { transform:translate(-18px,18px) scale(0.97); }
        }
        @keyframes orbFloat2 {
          0%,100% { transform:translate(0,0) scale(1); }
          40%     { transform:translate(-30px,20px) scale(1.05); }
          70%     { transform:translate(22px,-24px) scale(0.96); }
        }
        @keyframes vizFloat {
          0%,100% { transform:translateY(0); }
          50%     { transform:translateY(-10px); }
        }
        .a1{animation:fadeUp .8s cubic-bezier(.16,1,.3,1) .05s both}
        .a2{animation:fadeUp .8s cubic-bezier(.16,1,.3,1) .18s both}
        .a3{animation:fadeUp .8s cubic-bezier(.16,1,.3,1) .30s both}
        .a4{animation:fadeUp .8s cubic-bezier(.16,1,.3,1) .44s both}
        .a5{animation:fadeUp .8s cubic-bezier(.16,1,.3,1) .58s both}
        .a6{animation:fadeUp .8s cubic-bezier(.16,1,.3,1) .72s both}
        .grad-text {
          background:linear-gradient(135deg,#7c6aff 0%,#a78bfa 45%,#38bdf8 100%);
          background-size:200% 200%;
          -webkit-background-clip:text; -webkit-text-fill-color:transparent;
          background-clip:text;
          animation:gradShift 5s ease infinite;
        }
        .btn-cta {
          display:inline-flex;align-items:center;gap:6px;
          padding:13px 26px;border-radius:10px;font-size:15px;font-weight:600;
          background:#7c6aff;color:#fff;text-decoration:none;
          transition:opacity .15s, transform .15s, box-shadow .15s;
          box-shadow:0 4px 24px rgba(124,106,255,.4);
        }
        .btn-cta:hover{opacity:.91;transform:translateY(-2px);box-shadow:0 8px 32px rgba(124,106,255,.55);}
        .btn-ghost {
          display:inline-flex;align-items:center;gap:6px;
          padding:13px 24px;border-radius:10px;font-size:15px;font-weight:500;
          border:1px solid rgba(255,255,255,.12);color:rgba(232,232,240,.8);
          text-decoration:none;transition:background .15s,border-color .15s,transform .15s;
          background:rgba(255,255,255,.03);
        }
        .btn-ghost:hover{background:rgba(255,255,255,.07);border-color:rgba(124,106,255,.5);transform:translateY(-2px);}
        .feat-card{
          background:rgba(15,15,30,.7);
          border:1px solid rgba(255,255,255,.07);
          border-radius:16px;padding:26px;
          backdrop-filter:blur(12px);
          transition:transform .22s ease, border-color .22s ease, box-shadow .22s ease;
        }
        .feat-card:hover{
          transform:translateY(-5px);
          border-color:rgba(124,106,255,.4);
          box-shadow:0 20px 60px rgba(0,0,0,.35), 0 0 0 1px rgba(124,106,255,.12);
        }
        .step-card{
          border:1px solid rgba(255,255,255,.06);
          border-radius:16px;padding:28px 24px;
          background:rgba(15,15,30,.5);backdrop-filter:blur(10px);
          transition:border-color .2s ease;
        }
        .step-card:hover{border-color:rgba(124,106,255,.3);}
        .orb1{
          position:absolute;border-radius:50%;pointer-events:none;
          width:600px;height:600px;
          background:radial-gradient(circle,rgba(124,106,255,.18) 0%,transparent 70%);
          filter:blur(60px);top:-200px;left:-150px;
          animation:orbFloat 18s ease-in-out infinite;
        }
        .orb2{
          position:absolute;border-radius:50%;pointer-events:none;
          width:500px;height:500px;
          background:radial-gradient(circle,rgba(56,189,248,.12) 0%,transparent 70%);
          filter:blur(60px);bottom:-150px;right:-100px;
          animation:orbFloat2 22s ease-in-out infinite;
        }
        .viz-wrap{animation:vizFloat 7s ease-in-out infinite;}
        .preview-wrap{animation:vizFloat 9s ease-in-out infinite 1s;}
        @media(max-width:860px){
          .hero-inner{flex-direction:column!important;text-align:center;}
          .hero-text{align-items:center!important;}
          .hero-visual{display:none!important;}
          .feat-grid{grid-template-columns:1fr 1fr!important;}
          .steps-grid{grid-template-columns:1fr!important;}
          .graph-inner{flex-direction:column!important;gap:40px!important;}
        }
        @media(max-width:540px){
          .feat-grid{grid-template-columns:1fr!important;}
        }
        .nav-link{color:rgba(232,232,240,.65);text-decoration:none;font-size:14px;transition:color .15s;}
        .nav-link:hover{color:rgba(232,232,240,1);}
        .tag-pill{
          display:inline-flex;align-items:center;gap:6px;
          padding:5px 14px;border-radius:99px;font-size:12px;font-weight:500;
          border:1px solid rgba(124,106,255,.3);
          background:rgba(124,106,255,.1);color:#a090ff;
        }
        .trust-item{display:flex;align-items:center;gap:7px;font-size:13px;color:rgba(200,200,220,.5);}
        .trust-dot{width:4px;height:4px;border-radius:50%;background:rgba(200,200,220,.3);}
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', overflowX: 'hidden' }}>

        {/* ── NAV ── */}
        <nav style={{
          position: 'sticky', top: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 32px', height: 60,
          background: 'rgba(10,10,20,0.8)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <DotstellLogo size="md" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <a href="#features" className="nav-link">Features</a>
            <a href="#graph" className="nav-link">Knowledge Graph</a>
            <a href="#how" className="nav-link">How it works</a>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/auth/login" className="btn-ghost" style={{ padding: '9px 18px', fontSize: 14 }}>Sign in</Link>
            <Link href="/auth/register" className="btn-cta" style={{ padding: '9px 20px', fontSize: 14 }}>Get started free →</Link>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section style={{ position: 'relative', overflow: 'hidden', padding: '80px 32px 100px', minHeight: '90vh', display: 'flex', alignItems: 'center' }}>
          <div className="orb1" />
          <div className="orb2" />

          <div className="hero-inner" style={{ maxWidth: 1120, margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: 64, position: 'relative', zIndex: 1 }}>

            {/* Left: text */}
            <div className="hero-text" style={{ flex: '0 0 auto', maxWidth: 540, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
              <div className="tag-pill a1" style={{ marginBottom: 24 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#a090ff"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Knowledge management, reimagined
              </div>

              <h1 className="a2" style={{ fontSize: 'clamp(40px,5.5vw,64px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-1.5px', margin: '0 0 24px' }}>
                Stop losing<br />
                <span className="grad-text">your best ideas.</span>
              </h1>

              <p className="a3" style={{ fontSize: 18, lineHeight: 1.65, color: 'rgba(200,200,220,0.7)', margin: '0 0 32px', maxWidth: 460 }}>
                Dotstell connects your notes, bookmarks, people, and tasks into a living knowledge graph — so the right idea surfaces at the right moment.
              </p>

              <div className="a4" style={{ display: 'flex', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
                <Link href="/auth/register" className="btn-cta">Start for free →</Link>
                <Link href="/auth/login" className="btn-ghost">Sign in</Link>
              </div>

              <div className="a5" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {['Free forever', 'Open source', 'No lock-in', 'Your data'].map((t, i) => (
                  <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {i > 0 && <span className="trust-dot" />}
                    <span className="trust-item">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      {t}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {/* Right: app preview */}
            <div className="hero-visual a6 preview-wrap" style={{ flex: 1, minWidth: 0 }}>
              <AppPreview />
            </div>
          </div>
        </section>

        {/* ── PAIN ROW ── */}
        <div style={{ padding: '0 32px 80px', maxWidth: 1120, margin: '0 auto' }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16,
            background: 'rgba(15,15,30,0.6)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16, padding: '28px 24px', backdropFilter: 'blur(12px)',
          }}>
            {[
              { icon: '📋', pain: 'Notes you never find', fix: 'Notebooks, tabs & instant search', color: '#7c6aff' },
              { icon: '🔖', pain: 'Bookmarks you never read', fix: 'Auto-enriched, tagged & linked', color: '#f59e0b' },
              { icon: '🕸️', pain: 'Ideas that never connect', fix: 'Visual graph of everything', color: '#10b981' },
            ].map(item => (
              <div key={item.pain} style={{ textAlign: 'center', padding: '8px 16px' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{item.icon}</div>
                <div style={{ fontSize: 13, color: 'rgba(200,200,220,0.4)', marginBottom: 6, textDecoration: 'line-through' }}>{item.pain}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: item.color }}>{item.fix}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FEATURES ── */}
        <section id="features" style={{ padding: '20px 32px 100px' }}>
          <div style={{ maxWidth: 1120, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, letterSpacing: '-0.8px', margin: '0 0 14px' }}>
                Everything you need,<br /><span className="grad-text">nothing you don't.</span>
              </h2>
              <p style={{ fontSize: 17, color: 'rgba(200,200,220,0.55)', maxWidth: 480, margin: '0 auto' }}>
                Four interconnected tools that work as one.
              </p>
            </div>

            <div className="feat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
              {features.map(f => (
                <div key={f.title} className="feat-card">
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: f.bg, border: `1px solid ${f.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                    {f.icon}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: f.color, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>{f.tag}</div>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 10px', color: 'var(--foreground)' }}>{f.title}</h3>
                  <p style={{ fontSize: 13.5, color: 'rgba(200,200,220,0.55)', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── KNOWLEDGE GRAPH SECTION ── */}
        <section id="graph" style={{ padding: '60px 32px 100px', background: 'linear-gradient(180deg, transparent, rgba(124,106,255,0.04) 30%, rgba(124,106,255,0.07) 60%, transparent)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ maxWidth: 1120, margin: '0 auto' }}>
            <div className="graph-inner" style={{ display: 'flex', alignItems: 'center', gap: 80 }}>

              {/* Graph viz */}
              <div className="viz-wrap" style={{ flex: '0 0 auto', width: '100%', maxWidth: 460 }}>
                <KnowledgeGraphViz />
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#7c6aff', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16 }}>Knowledge Graph</div>
                <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, letterSpacing: '-0.8px', margin: '0 0 20px', lineHeight: 1.12 }}>
                  See how<br /><span className="grad-text">everything connects.</span>
                </h2>
                <p style={{ fontSize: 16.5, color: 'rgba(200,200,220,0.6)', lineHeight: 1.7, margin: '0 0 32px' }}>
                  Every note you write, every bookmark you save, every person you track — they all become nodes in your personal knowledge graph. Links become edges. Patterns emerge you never saw before.
                </p>
                {[
                  { label: 'Cross-entity linking', desc: 'Connect notes to people, tasks to bookmarks — not just note-to-note.' },
                  { label: 'Visual navigation', desc: 'Explore your graph interactively. Click any node to open it.' },
                  { label: 'Automatic connections', desc: '[[wikilinks]] in your notes create graph edges instantly.' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', gap: 14, marginBottom: 18 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(124,106,255,0.2)', border: '1px solid rgba(124,106,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7c6aff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', marginBottom: 2 }}>{item.label}</div>
                      <div style={{ fontSize: 13, color: 'rgba(200,200,220,0.5)', lineHeight: 1.5 }}>{item.desc}</div>
                    </div>
                  </div>
                ))}
                <Link href="/auth/register" className="btn-cta" style={{ display: 'inline-flex', marginTop: 8 }}>
                  Build your graph →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section id="how" style={{ padding: '60px 32px 100px' }}>
          <div style={{ maxWidth: 1120, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 800, letterSpacing: '-0.7px', margin: '0 0 12px' }}>
                Up and running <span className="grad-text">in minutes.</span>
              </h2>
              <p style={{ fontSize: 16, color: 'rgba(200,200,220,0.5)', margin: 0 }}>No setup. No migration. Just start.</p>
            </div>

            <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
              {steps.map(s => (
                <div key={s.n} className="step-card">
                  <div style={{ fontSize: 36, fontWeight: 900, color: s.color, opacity: 0.25, lineHeight: 1, marginBottom: 16, letterSpacing: '-2px' }}>{s.n}</div>
                  <div style={{ width: 32, height: 2, borderRadius: 1, background: s.color, marginBottom: 20, opacity: 0.7 }} />
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 10px', color: 'var(--foreground)' }}>{s.title}</h3>
                  <p style={{ fontSize: 14, color: 'rgba(200,200,220,0.5)', lineHeight: 1.65, margin: 0 }}>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section style={{ padding: '80px 32px 100px', position: 'relative', overflow: 'hidden' }}>
          <div style={{
            maxWidth: 740, margin: '0 auto', textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(124,106,255,0.12) 0%, rgba(56,189,248,0.06) 100%)',
            border: '1px solid rgba(124,106,255,0.25)', borderRadius: 24,
            padding: '72px 48px',
            boxShadow: '0 0 80px rgba(124,106,255,0.1)',
          }}>
            <div style={{ fontSize: 42, marginBottom: 20 }}>✦</div>
            <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, letterSpacing: '-0.8px', margin: '0 0 18px', lineHeight: 1.1 }}>
              Ready to connect<br /><span className="grad-text">your knowledge?</span>
            </h2>
            <p style={{ fontSize: 17, color: 'rgba(200,200,220,0.6)', margin: '0 0 40px', lineHeight: 1.65 }}>
              Join builders, researchers, and thinkers who use Dotstell to capture and connect their best ideas. Free forever, open source, no credit card needed.
            </p>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/auth/register" className="btn-cta" style={{ fontSize: 16, padding: '15px 32px' }}>
                Start for free — no card needed
              </Link>
              <a href="https://github.com/dotstell/dotstell" target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ fontSize: 15 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                View on GitHub
              </a>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer style={{ padding: '32px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <DotstellLogo size="sm" showTagline />
            <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
              <Link href="/auth/register" style={{ fontSize: 13, color: 'rgba(200,200,220,0.4)', textDecoration: 'none' }}>Get started</Link>
              <Link href="/auth/login" style={{ fontSize: 13, color: 'rgba(200,200,220,0.4)', textDecoration: 'none' }}>Sign in</Link>
              <a href="https://github.com/dotstell/dotstell" target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: 'rgba(200,200,220,0.4)', textDecoration: 'none' }}>GitHub</a>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(200,200,220,0.25)' }}>
              © 2025 Dotstell · Open source · Built in public
            </div>
          </div>
        </footer>

      </div>
    </>
  )
}
