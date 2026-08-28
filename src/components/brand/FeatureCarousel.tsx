'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const FEATURES: Array<{
  key: string; tab: string; accent: string;
  headline: string; desc: string; bullets: string[]; mock: React.ReactNode
}> = [
  {
    key: 'dashboard',
    tab: '🏠 Dashboard',
    accent: '#f59e0b',
    headline: 'Your entire day in one glance',
    desc: 'The Dashboard is your daily home base — overdue task alerts, AI Digest summary of recent activity, task progress and the latest notes all in one view.',
    bullets: [
      'Overdue alert banner — never miss a deadline again',
      'AI Digest — one-paragraph recap of everything you captured lately',
      'Task progress + recent notes and bookmarks activity in one view',
    ],
    mock: <DashboardMock />,
  },
  {
    key: 'notes',
    tab: '✏️ Smart Notes',
    accent: '#7c6aff',
    headline: 'Write notes that know where they belong',
    desc: 'Rich text editor with slash commands, wikilinks, tables and code blocks. Every note links into your graph automatically and AI helps you write faster.',
    bullets: [
      'Wikilinks — type [[ to connect to any note or person instantly',
      'AI Inline Assist — select any text to rewrite, expand or fix grammar',
      'AI summary, smart title & 5 auto-tags in one click',
    ],
    mock: <NotesMock />,
  },
  {
    key: 'graph',
    tab: '🌐 Knowledge Graph',
    accent: '#3b82f6',
    headline: 'See how everything connects',
    desc: 'A live visual map of your entire knowledge base — every note, person, bookmark and task as a node, every link as an edge. AI finds the gaps you miss.',
    bullets: [
      'Auto-built from wikilinks and manual connections',
      'Zoom, pan and click any node to open it instantly',
      'Graph Intelligence — AI spots missing links, clusters and dead ends',
    ],
    mock: <GraphMock />,
  },
  {
    key: 'bookmarks',
    tab: '🔖 Bookmarks',
    accent: '#06b6d4',
    headline: 'Save the internet, connect it to your thinking',
    desc: 'Paste any URL and metadata is fetched automatically. AI summarises any saved page so you never re-read it to remember why you saved it.',
    bullets: [
      'Auto-fetch title, description and favicon on save',
      'AI summary of any bookmark in one click',
      'Bulk import from Chrome, Firefox or Safari',
    ],
    mock: <BookmarksMock />,
  },
  {
    key: 'people',
    tab: '👥 People',
    accent: '#a855f7',
    headline: 'Build rich context around every person',
    desc: 'Track your professional and personal network. @mention people in notes, attach tasks and bookmarks — then ask AI to brief you on anyone in seconds.',
    bullets: [
      '@mention people in any note — linked automatically',
      'Attach notes, tasks and bookmarks to each contact',
      'Person Intelligence — AI brief on anyone from your notes',
    ],
    mock: <PeopleMock />,
  },
  {
    key: 'tasks',
    tab: '✅ Tasks',
    accent: '#22c55e',
    headline: 'Keep tasks next to why they exist',
    desc: 'Create standalone tasks or checklists inside any note. Priorities, due dates and overdue alerts — always in context with the knowledge behind them.',
    bullets: [
      'Kanban board + inline checklists inside any note',
      'Overdue alerts and due-date notifications — nothing slips',
      'Linked to the notes, people and bookmarks behind each task',
    ],
    mock: <TasksMock />,
  },
  {
    key: 'ai-chat',
    tab: '✨ AI Chat',
    accent: '#818cf8',
    headline: 'Ask questions. Get answers from your notes, tasks, and bookmarks.',
    desc: 'RAG-grounded chat searches your entire knowledge base before answering — notes, tasks, and bookmarks all in context, so replies reference what you actually wrote.',
    bullets: [
      'Ask anything about your knowledge base — not the internet',
      'Notes, tasks, and bookmarks all searchable in one chat',
      'Works with Ollama locally — no data leaves your machine',
    ],
    mock: <AIChatMock />,
  },
  {
    key: 'ai-write',
    tab: '✍️ AI Writing',
    accent: '#e879f9',
    headline: 'Never face a blank page again',
    desc: 'Open AI Write to draft anything from 8 templates or your own custom prompt. Select any text to improve it in one click — rewrite, expand, shorten, formalise, or fix grammar.',
    bullets: [
      '8 templates + custom prompt — draft anything you can describe',
      'One-click improvements: formal, concise, expanded, full rewrite',
      'Inline Assist — select any text anywhere and transform it instantly',
    ],
    mock: <AIWriteMock />,
  },
  {
    key: 'ai-digest',
    tab: '🧠 AI Digest & Insights',
    accent: '#f97316',
    headline: 'AI that keeps up so you can catch up',
    desc: 'Daily AI Digest recaps your recent notes activity. Smart titles and auto-tags as you write. Related Notes shows semantic matches as you read. Person Intelligence briefs on demand.',
    bullets: [
      'AI Digest — daily recap of what you captured and what changed',
      'Related Notes sidebar — semantically similar notes surface as you read',
      'Smart title + 5 auto-tags · Person Intelligence on any contact',
    ],
    mock: <AIIntelMock />,
  },
]

// ── Inline mocks ──────────────────────────────────────────────────────────────

function DashboardMock() {
  return (
    <MockShell title="Dashboard · Wednesday, Aug 27" accent="#7c6aff" noPad>
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, height: '100%', overflow: 'hidden' }}>
        {/* Overdue alert */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderRadius: 8, background: 'color-mix(in srgb, #ef4444 10%, transparent)', border: '1px solid color-mix(in srgb, #ef4444 25%, transparent)' }}>
          <span style={{ fontSize: 12 }}>⚠️</span>
          <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 500 }}>2 tasks overdue</span>
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)', marginLeft: 'auto' }}>Review wireframes · Define scope</span>
        </div>
        {/* AI Digest */}
        <div style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--secondary)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontSize: 11 }}>✨</span>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--primary)' }}>AI Digest</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.6, margin: 0 }}>
            You added 3 notes on auth strategy and Q3 planning. Mei appears in 4 notes this week. 1 bookmark saved from Linear.
          </p>
        </div>
        {/* Task progress */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Task progress</span>
            <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600 }}>5 / 8 done</span>
          </div>
          <div style={{ height: 5, borderRadius: 999, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: '62%', borderRadius: 999, background: 'var(--primary)' }} />
          </div>
        </div>
        {/* Recent activity */}
        <div>
          <Label>Recent activity</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {[
              { icon: '📄', text: 'Auth decision — Aug 2026' },
              { icon: '🔖', text: 'figma.com/wireframes' },
              { icon: '📄', text: 'Product Launch Plan' },
              { icon: '🔖', text: 'linear.app — Issue tracker' },
            ].map(({ icon, text }) => (
              <div key={text} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 5, background: 'var(--secondary)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>{icon} {text}</div>
            ))}
          </div>
        </div>
      </div>
    </MockShell>
  )
}

function NotesMock() {
  return (
    <MockShell title="Product Launch Plan" accent="#7c6aff">
      <p style={{ fontSize: 12, color: 'var(--foreground)', lineHeight: 1.9, margin: '0 0 14px' }}>
        Coordinate timeline with{' '}
        <Chip label="Rayan" accent="#a855f7" />
        {' '}and align with{' '}
        <Chip label="Q3 Goals" accent="#22c55e" />.
      </p>
      <CheckItem done text="Align on scope with stakeholders" />
      <CheckItem text="Review wireframes with Yuki" />
      <CheckItem text="Map deliverables into Q3 Goals" />
      <div style={{ marginTop: 14 }}>
        <Label>Connected to</Label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Pill icon="👤" label="Rayan" type="Person" accent="#a855f7" />
          <Pill icon="📄" label="Q3 Goals" type="Note" accent="#22c55e" />
          <Pill icon="✅" label="Define launch scope" type="Task" accent="#f59e0b" />
        </div>
      </div>
    </MockShell>
  )
}

function GraphMock() {
  const nodes = [
    { id: 'n1', x: 50,  y: 40,  label: 'Launch Plan',  color: '#7c6aff', r: 18 },
    { id: 'n2', x: 160, y: 25,  label: 'Marcus',       color: '#a855f7', r: 14 },
    { id: 'n3', x: 200, y: 110, label: 'Q3 Goals',     color: '#22c55e', r: 16 },
    { id: 'n4', x: 80,  y: 130, label: 'wireframes',   color: '#3b82f6', r: 12 },
    { id: 'n5', x: 270, y: 50,  label: 'Auth decision',color: '#7c6aff', r: 14 },
    { id: 'n6', x: 300, y: 130, label: 'Team meeting', color: '#7c6aff', r: 12 },
  ]
  const edges = [
    ['n1','n2'],['n1','n3'],['n1','n4'],['n3','n5'],['n2','n5'],['n5','n6'],['n3','n6'],
  ]
  return (
    <MockShell title="Knowledge Graph" accent="#7c6aff" noPad>
      <svg viewBox="0 0 340 175" style={{ width: '100%', height: 'auto' }}>
        {edges.map(([a,b],i) => {
          const na = nodes.find(n=>n.id===a)!
          const nb = nodes.find(n=>n.id===b)!
          return <line key={i} x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke="var(--border)" strokeWidth="1.2" />
        })}
        {nodes.map(n => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r={n.r} fill={`${n.color}22`} stroke={n.color} strokeWidth="1.5" />
            <text x={n.x} y={n.y + n.r + 10} textAnchor="middle" fontSize="8" fill="var(--muted-foreground)">{n.label}</text>
          </g>
        ))}
      </svg>
    </MockShell>
  )
}

function BookmarksMock() {
  const bookmarks = [
    { favicon: '🔵', title: 'Figma — Design tool',     url: 'figma.com',        tag: 'Design'   },
    { favicon: '🟠', title: 'Linear — Issue tracker',  url: 'linear.app',       tag: 'Planning' },
    { favicon: '⚫', title: 'GitHub — dotstell repo',  url: 'github.com/dots…', tag: 'Dev'      },
    { favicon: '🟣', title: 'Notion — Q3 OKR doc',    url: 'notion.so/q3-okr', tag: 'Goals'    },
  ]
  return (
    <MockShell title="Bookmarks" accent="#3b82f6">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bookmarks.map(b => (
          <div key={b.url} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--secondary)' }}>
            <span style={{ fontSize: 16 }}>{b.favicon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 500, margin: 0, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</p>
              <p style={{ fontSize: 10, margin: 0, color: 'var(--muted-foreground)', opacity: 0.65 }}>{b.url}</p>
            </div>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)', flexShrink: 0 }}>{b.tag}</span>
          </div>
        ))}
      </div>
    </MockShell>
  )
}

function PeopleMock() {
  return (
    <MockShell title="Shihab · Engineering Lead" accent="#a855f7">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#7c6aff,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>👤</div>
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: 'var(--foreground)' }}>Shihab</p>
          <p style={{ fontSize: 11, margin: 0, color: 'var(--muted-foreground)' }}>Engineering Lead · Last met Aug 27</p>
        </div>
      </div>
      <Label>Notes mentioning Shihab</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {['Product Launch Plan','Auth decision — Aug 2026','Q3 retrospective'].map(n => (
          <div key={n} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, background: 'var(--secondary)', color: 'var(--foreground)', border: '1px solid var(--border)' }}>📄 {n}</div>
        ))}
      </div>
      <Label>Linked tasks</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <CheckItem text="Review wireframes with Rayan" />
        <CheckItem done text="Sync on Q4 product roadmap" />
      </div>
    </MockShell>
  )
}

function TasksMock() {
  const cols = [
    { label: 'To do',       color: 'var(--muted-foreground)', tasks: [{ t: 'Define scope', overdue: true }, { t: 'Write API spec', overdue: false }]   },
    { label: 'In progress', color: '#f59e0b',                 tasks: [{ t: 'Review wireframes', overdue: true }, { t: 'Sync with Yuki', overdue: false }] },
    { label: 'Done',        color: '#22c55e',                 tasks: [{ t: 'Stakeholder alignment', overdue: false }] },
  ]
  return (
    <MockShell title="Tasks" accent="#f59e0b" noPad>
      <div style={{ padding: '8px 12px 0', borderBottom: '1px solid var(--border)', background: 'color-mix(in srgb, #ef4444 8%, transparent)' }}>
        <span style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>⚠ 2 overdue</span>
        <span style={{ fontSize: 10, color: 'var(--muted-foreground)', marginLeft: 8 }}>Define scope · Review wireframes</span>
      </div>
      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', height: 'calc(100% - 30px)' }}>
        {cols.map(col => (
          <div key={col.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: col.color, marginBottom: 2 }}>{col.label}</div>
            {col.tasks.map(({ t, overdue }) => (
              <div key={t} style={{ padding: '7px 9px', borderRadius: 7, border: `1px solid ${overdue ? 'color-mix(in srgb, #ef4444 30%, transparent)' : 'var(--border)'}`, background: overdue ? 'color-mix(in srgb, #ef4444 8%, transparent)' : 'var(--secondary)', fontSize: 11, color: 'var(--foreground)', lineHeight: 1.4 }}>
                {t}{overdue && <span style={{ display: 'block', fontSize: 9, color: '#ef4444', marginTop: 2 }}>Overdue</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </MockShell>
  )
}

function AIChatMock() {
  return (
    <MockShell title="AI Chat" accent="#7c6aff" noPad>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
          <ChatBubble role="user" text="What did I decide about the auth strategy?" />
          <ChatBubble role="ai" text={'Based on your note “Auth decision — Aug 2026”: you chose JWT over sessions after discussing scalability concerns with Marcus. OAuth2 proxy was ruled out due to added infrastructure complexity. Action item: revisit before Q3 launch.'} />
        </div>
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1, padding: '7px 12px', borderRadius: 6, background: 'var(--secondary)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--muted-foreground)' }}>Ask anything about your notes…</div>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--primary-foreground)', flexShrink: 0 }}>↑</div>
        </div>
      </div>
    </MockShell>
  )
}

function AIWriteMock() {
  return (
    <MockShell title="AI Write" accent="#7c6aff" noPad>
      <div style={{ display: 'flex', height: '100%' }}>
        <div style={{ width: '44%', borderRight: '1px solid var(--border)', padding: '12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 4px' }}>Templates</p>
          {['Outline','Meeting notes','Proposal','Status update','OoO email','✦ Custom prompt'].map((t,i) => (
            <div key={t} style={{ fontSize: 11, padding: '5px 9px', borderRadius: 6, background: i === 5 ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : i === 2 ? 'var(--secondary)' : 'var(--secondary)', color: i === 5 ? 'var(--primary)' : 'var(--foreground)', border: `1px solid ${i === 5 ? 'color-mix(in srgb, var(--primary) 30%, transparent)' : 'var(--border)'}`, cursor: 'default', fontWeight: i === 5 ? 500 : 400 }}>{t}</div>
          ))}
        </div>
        <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: 0 }}>Improve existing</p>
          {['Improve English','Make formal','Make concise','Expand','Full rewrite'].map((a,i) => (
            <div key={a} style={{ fontSize: 11, padding: '5px 9px', borderRadius: 6, background: 'var(--secondary)', color: 'var(--foreground)', border: '1px solid var(--border)', cursor: 'default' }}>{a}</div>
          ))}
        </div>
      </div>
    </MockShell>
  )
}

function AIIntelMock() {
  return (
    <MockShell title="AI Digest · Today" accent="#f59e0b" noPad>
      <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <Label>Today's activity summary</Label>
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.65, margin: 0 }}>You added 3 notes today focused on auth strategy and Q3 planning. 2 tasks are overdue. Mei appeared in 4 notes this week.</p>
        </div>
        <div>
          <Label>Smart title suggestion</Label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, background: 'var(--secondary)', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, flex: 1, color: 'var(--foreground)' }}>Auth flow decision · Aug 2026</span>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)' }}>Use</span>
          </div>
        </div>
        <div>
          <Label>Suggested tags</Label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['#auth','#JWT','#architecture','#security','#Q3'].map(tag => (
              <span key={tag} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 999, border: '1px solid var(--border)', color: 'var(--muted-foreground)', background: 'var(--secondary)' }}>{tag}</span>
            ))}
          </div>
        </div>
      </div>
    </MockShell>
  )
}

// ── Shared primitives ────────────────────────────────────────────────────────

function MockShell({ title, accent, children, noPad }: { title: string; accent: string; children: React.ReactNode; noPad?: boolean }) {
  return (
    <div style={{ borderRadius: 12, border: '1px solid var(--border)', background: 'var(--card)', overflow: 'hidden', height: 260 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'var(--secondary)' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: accent, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>{title}</span>
      </div>
      <div style={{ padding: noPad ? 0 : '14px', height: 'calc(100% - 41px)', overflow: 'hidden' }}>{children}</div>
    </div>
  )
}

function Chip({ label, accent }: { label: string; accent: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 4, fontSize: 12, fontWeight: 500, background: `${accent}18`, color: accent }}>[[{label}]]</span>
  )
}

function Pill({ icon, label, type, accent }: { icon: string; label: string; type: string; accent: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 6, fontSize: 11, border: `1px solid ${accent}30`, background: `${accent}10` }}>
      <span style={{ fontSize: 12 }}>{icon}</span>
      <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 9, color: 'var(--muted-foreground)', opacity: 0.6 }}>{type}</span>
    </div>
  )
}

function CheckItem({ done, text }: { done?: boolean; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${done ? '#7c6aff' : 'var(--border)'}`, background: done ? '#7c6aff' : 'transparent' }}>
        {done && <span style={{ fontSize: 8, color: '#fff', lineHeight: 1 }}>✓</span>}
      </div>
      <span style={{ fontSize: 12, color: 'var(--foreground)', textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.4 : 1 }}>{text}</span>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-foreground)', opacity: 0.55, margin: '0 0 8px' }}>{children}</p>
}

function ChatBubble({ role, text }: { role: 'user' | 'ai'; text: string }) {
  const isUser = role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '85%', padding: '8px 12px', borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: isUser ? 'var(--primary)' : 'var(--secondary)', color: isUser ? 'var(--primary-foreground)' : 'var(--foreground)', fontSize: 11, lineHeight: 1.6, border: isUser ? 'none' : '1px solid var(--border)' }}>
        {text}
      </div>
    </div>
  )
}

// ── Main carousel ─────────────────────────────────────────────────────────────

export function FeatureCarousel() {
  const [active, setActive] = useState(0)
  const f = FEATURES[active]

  useEffect(() => {
    const id = setInterval(() => setActive(i => (i + 1) % FEATURES.length), 5000)
    return () => clearInterval(id)
  }, [active])

  return (
    <section style={{ padding: '80px 16px', maxWidth: 1000, margin: '0 auto', width: '100%' }}>
      {/* Section heading */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h2 style={{ fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 700, marginBottom: 10 }}>One graph. Every thought.</h2>
        <p style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>Everything you capture lives together — and connects.</p>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', overflowX: 'auto', gap: 6, marginBottom: 36, paddingBottom: 4, scrollbarWidth: 'none' }}>
        {FEATURES.map((feat, i) => (
          <button
            key={feat.key}
            onClick={() => setActive(i)}
            style={{
              position: 'relative', overflow: 'hidden',
              padding: '7px 14px', borderRadius: 999, border: '1px solid',
              borderColor: active === i ? `${feat.accent}60` : 'var(--border)',
              background: active === i ? `${feat.accent}15` : 'transparent',
              color: active === i ? feat.accent : 'var(--muted-foreground)',
              fontSize: 12, fontWeight: active === i ? 600 : 400,
              whiteSpace: 'nowrap', cursor: 'pointer', flexShrink: 0,
              transition: 'all 0.2s',
            }}
          >
            {feat.tab}
            {active === i && (
              <span
                className="tab-progress"
                key={`${i}-progress`}
                style={{
                  position: 'absolute', bottom: 0, left: 0, height: 2,
                  background: feat.accent, borderRadius: 999,
                  animation: 'tabprogress 5s linear forwards',
                }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div
        key={active}
        style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, alignItems: 'center',
          borderRadius: 16, padding: '40px', border: '1px solid var(--border)', background: 'var(--card)',
          animation: 'fadein 0.2s ease',
        }}
        className="feature-panel max-sm:grid-cols-1"
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes fadein { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes tabprogress { from { width: 0%; } to { width: 100%; } }
          @media (prefers-reduced-motion: reduce) { .feature-panel { animation: none !important; } .tab-progress { animation: none !important; } }
          @media (max-width: 640px) { .feature-panel { grid-template-columns: 1fr !important; } }
        ` }} />

        {/* Left: text */}
        <div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 500, marginBottom: 18, border: `1px solid ${f.accent}40`, background: `${f.accent}12`, color: f.accent }}>
            {f.tab}
          </span>
          <h3 style={{ fontSize: 'clamp(18px, 3vw, 24px)', fontWeight: 700, lineHeight: 1.25, marginBottom: 14, color: 'var(--foreground)' }}>{f.headline}</h3>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.7, marginBottom: 20 }}>{f.desc}</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {f.bullets.map(b => (
              <li key={b} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, color: 'var(--foreground)' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                  <circle cx="8" cy="8" r="7.5" stroke="var(--primary)" strokeOpacity="0.4" />
                  <path d="M5 8l2 2 4-4" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {b}
              </li>
            ))}
          </ul>
          <Link
            href="/auth/register"
            className="hover:opacity-90 transition-opacity"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 8, background: f.accent, color: '#fff', fontWeight: 500, fontSize: 13, textDecoration: 'none' }}
          >
            Try it free →
          </Link>
        </div>

        {/* Right: mock */}
        <div>{f.mock}</div>
      </div>

      {/* Dot navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 28 }}>
        <button
          onClick={() => setActive(i => Math.max(0, i - 1))}
          disabled={active === 0}
          style={{ width: 32, height: 32, borderRadius: 999, border: '1px solid var(--border)', background: 'var(--card)', cursor: active === 0 ? 'not-allowed' : 'pointer', opacity: active === 0 ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--foreground)' }}
        >‹</button>
        <div style={{ display: 'flex', gap: 6 }}>
          {FEATURES.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              style={{ width: active === i ? 20 : 7, height: 7, borderRadius: 999, background: active === i ? 'var(--primary)' : 'var(--border)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.2s' }}
            />
          ))}
        </div>
        <button
          onClick={() => setActive(i => Math.min(FEATURES.length - 1, i + 1))}
          disabled={active === FEATURES.length - 1}
          style={{ width: 32, height: 32, borderRadius: 999, border: '1px solid var(--border)', background: 'var(--card)', cursor: active === FEATURES.length - 1 ? 'not-allowed' : 'pointer', opacity: active === FEATURES.length - 1 ? 0.35 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--foreground)' }}
        >›</button>
      </div>
    </section>
  )
}
