'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowRight, AlertCircle, TrendingUp, FileText, Bookmark,
  CheckSquare, Users, Plus, Zap, Activity,
  CheckCircle2, Circle, Timer, Sparkles, Loader2, RefreshCw, Tag,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Task, Note, Bookmark as BookmarkType } from '@/types'
import { formatDate, formatRelative } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { useTaskReminders } from '@/hooks/useTaskReminders'
import { PageContainer } from '@/components/layout/PageContainer'
import { useAISettings } from '@/hooks/useAISettings'
import { isLocalHostname, completeOllamaBrowser } from '@/lib/ai/ollama-browser'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'
import { MarkdownContent } from '@/components/ui/MarkdownContent'

const PRIORITY_COLOR: Record<string, string> = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' }
const STATUS_COLOR:   Record<string, string> = { todo: 'var(--muted-foreground)', in_progress: 'var(--primary)', done: '#10b981' }
const STATUS_ICON = {
  todo:        <Circle      size={12} color="var(--muted-foreground)" />,
  in_progress: <Timer       size={12} color="var(--primary)" />,
  done:        <CheckCircle2 size={12} color="#10b981" />,
}
const NOTE_TYPE_COLOR: Record<string, string> = { markdown: 'var(--primary)', plain: 'var(--muted-foreground)', checklist: '#10b981' }
const NOTE_TYPE_LABEL: Record<string, string> = { markdown: 'Rich text', plain: 'Plain', checklist: 'Checklist' }

// ── Tiny Sparkline (SVG) ─────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 64, h = 24
  const coords = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - (v / max) * (h - 4) - 2,
  }))

  // Build a smooth cubic Bézier path through all points
  function smoothPath(pts: { x: number; y: number }[]) {
    if (pts.length === 0) return ''
    let d = `M ${pts[0].x},${pts[0].y}`
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1]
      const curr = pts[i]
      const cpX = (prev.x + curr.x) / 2
      d += ` C ${cpX},${prev.y} ${cpX},${curr.y} ${curr.x},${curr.y}`
    }
    return d
  }

  const linePath = smoothPath(coords)
  const first = coords[0], last = coords[coords.length - 1]
  const areaPath = `${linePath} L ${last.x},${h} L ${first.x},${h} Z`

  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <path d={areaPath} fill={color} opacity={0.1} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.75}
      />
    </svg>
  )
}

// ── Stat card sparkline data — items created per day (last 7d) ─
function buildSparkline(items: { created_at: string }[]): number[] {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
  return days.map(day => items.filter(i => i.created_at.slice(0, 10) === day).length)
}

// Items captured or updated per day over the last 14 days
function build14DayActivity(notes: Note[], bookmarks: BookmarkType[]): number[] {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    return d.toISOString().slice(0, 10)
  })
  return days.map(day =>
    notes.filter(n => n.updated_at.slice(0, 10) === day).length +
    bookmarks.filter(b => b.created_at.slice(0, 10) === day).length
  )
}

export default function DashboardPage() {
  const [notes,     setNotes]     = useState<Note[]>([])
  const [tasks,     setTasks]     = useState<Task[]>([])
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([])
  const [people,    setPeople]    = useState<{ id: string; created_at: string }[]>([])
  const [loading,   setLoading]   = useState(true)
  const [isMobile,  setIsMobile]  = useState(false)
  const [greeting,  setGreeting]  = useState('Hello')
  const { config: aiConfig, isConfigured: aiConfigured } = useAISettings()
  const [digest,        setDigest]        = useState('')
  const [digestLoading, setDigestLoading] = useState(false)
  const [digestError,   setDigestError]   = useState<string | null>(null)
  const [digestPeriod,  setDigestPeriod]  = useState<'day' | 'week'>('week')

  async function generateDigest(period: 'day' | 'week') {
    setDigest(''); setDigestError(null); setDigestLoading(true)
    try {
      // On live app + Ollama: fetch notes browser-side and call Ollama through the Local Agent
      if (aiConfig.provider === 'ollama' && !isLocalHostname()) {
        const supabase = createSupabaseBrowserClient()
        const since = new Date()
        if (period === 'day') since.setDate(since.getDate() - 1)
        else                  since.setDate(since.getDate() - 7)
        const { data: recentNotes } = await supabase
          .from('notes')
          .select('title, content, updated_at')
          .is('deleted_at', null)
          .gte('updated_at', since.toISOString())
          .order('updated_at', { ascending: false })
          .limit(30)
        if (!recentNotes?.length) {
          setDigest(`No notes were updated in the last ${period === 'day' ? '24 hours' : '7 days'}.`)
          return
        }
        const noteList = recentNotes.map(n =>
          `• ${n.title || 'Untitled'} (updated ${new Date(n.updated_at).toLocaleDateString()}): ${
            n.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300)
          }`
        ).join('\n')
        const result = await completeOllamaBrowser(aiConfig, [
          { role: 'system', content: `You are a personal knowledge assistant. Summarise the user's recent note activity as a structured digest.\n\nFORMAT — follow exactly:\n- Start directly with the content. No preamble like "Here is your digest".\n- Use 3–6 bullet points. Each bullet: "**Topic name:** one sentence insight."\n- After the bullets, add a "### Key Action Items" section with 2–4 numbered items.\n- No closing remarks, sign-offs, or meta commentary.\n- Use markdown bold (**text**) only for topic names at the start of each bullet.` },
          { role: 'user',   content: `Here are the notes I worked on in the last ${period === 'day' ? '24 hours' : 'week'}:\n\n${noteList}` },
        ])
        setDigest(result)
        return
      }
      // Cloud providers: server-side route
      const res  = await fetch('/api/ai/digest', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ config: aiConfig, period }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Digest failed')
      setDigest(data.digest)
    } catch (err) {
      setDigestError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setDigestLoading(false)
    }
  }

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768) }
    check()
    window.addEventListener('resize', check)
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
    return () => window.removeEventListener('resize', check)
  }, [])

  useTaskReminders()

  useEffect(() => {
    async function load() {
      const [nr, pr, br, tr] = await Promise.all([
        fetch('/api/notes?root_only=true'),
        fetch('/api/people'),
        fetch('/api/bookmarks'),
        fetch('/api/tasks'),
      ])
      const [n, p, b, t] = await Promise.all([nr.json(), pr.json(), br.json(), tr.json()])
      setNotes(Array.isArray(n) ? n : [])
      setPeople(Array.isArray(p) ? p : [])
      setBookmarks(Array.isArray(b) ? b : [])
      setTasks(Array.isArray(t) ? t : [])
      setLoading(false)
    }
    load()
  }, [])

  const openTasks    = tasks.filter(t => t.status !== 'done')
  const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
  const doneTasks    = tasks.filter(t => t.status === 'done')
  const inProgress   = tasks.filter(t => t.status === 'in_progress')
  const progress     = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0

  // Live clock — updates every minute
  const [clockDate, setClockDate] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setClockDate(new Date())
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])
  const clockTime = clockDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const clockDay  = clockDate.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  const now             = Date.now()
  const STALE_MS        = 30 * 24 * 60 * 60 * 1000
  const untaggedNoteItems  = notes.filter(n => !(n.tags ?? []).filter(t => !t.startsWith('nb:')).length)
  const untaggedBmarkItems = bookmarks.filter(b => !(b.tags ?? []).length)
  const untaggedNotes      = untaggedNoteItems.length
  const untaggedBmarks     = untaggedBmarkItems.length
  const staleNotes         = notes.filter(n => (now - new Date(n.updated_at).getTime()) > STALE_MS).length
  const uniqueTopics       = new Set(notes.flatMap(n => (n.tags ?? []).filter(t => !t.startsWith('nb:')))).size
  const activity14         = build14DayActivity(notes, bookmarks)
  const activityThisWeek   = activity14.slice(7).reduce((s, v) => s + v, 0)
  const activityLastWeek   = activity14.slice(0, 7).reduce((s, v) => s + v, 0)
  const activityStreak     = (() => { let s = 0; for (let i = activity14.length - 1; i >= 0; i--) { if (activity14[i] > 0) s++; else break } return s })()
  const pctOrganized       = notes.length > 0 ? Math.round(((notes.length - untaggedNotes) / notes.length) * 100) : 100
  const queueNotes  = untaggedNoteItems.slice(0, 4)
  const queueBmarks = untaggedBmarkItems.slice(0, Math.max(0, 5 - queueNotes.length))

  const STATS = [
    {
      label: 'Notes',     count: notes.length,      icon: FileText,  href: '/notes',
      color: 'var(--primary)',   spark: buildSparkline(notes),
    },
    {
      label: 'People',    count: people.length,     icon: Users,     href: '/people',
      color: '#10b981',   spark: buildSparkline(people),
    },
    {
      label: 'Bookmarks', count: bookmarks.length,  icon: Bookmark,  href: '/bookmarks',
      color: '#f59e0b',   spark: buildSparkline(bookmarks),
    },
    {
      label: 'Open tasks',count: openTasks.length,  icon: CheckSquare, href: '/tasks',
      color: overdueTasks.length > 0 ? '#ef4444' : 'var(--primary)',
      spark: buildSparkline(openTasks),
    },
  ]

  return (
    <AppLayout>
      <PageContainer>

        {/* ── Greeting + live clock ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24, paddingTop: isMobile ? 8 : 0 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{greeting} 👋</h1>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>
              {loading ? 'Loading your knowledge…' :
                `${openTasks.length} open task${openTasks.length !== 1 ? 's' : ''}${overdueTasks.length > 0 ? ` · ${overdueTasks.length} overdue` : ' · all on track'} · ${notes.length} notes · ${bookmarks.length} bookmarks`}
            </p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: 'var(--foreground)', margin: 0, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
              {clockTime}
            </p>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 3 }}>{clockDay}</p>
          </div>
        </div>

        {/* ── Overdue alert ── */}
        {!loading && overdueTasks.length > 0 && (
          <div role='alert' aria-live='polite' style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 16px', borderRadius: 10, marginBottom: 20,
            backgroundColor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)',
          }}>
            <AlertCircle size={14} color="#ef4444" />
            <span style={{ fontSize: 13, color: '#ef4444', flex: 1 }}>
              {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}
              {overdueTasks[0] && <span style={{ color: '#f87171', marginLeft: 8, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160, display: 'inline-block', verticalAlign: 'bottom' }}>— "{overdueTasks[0].title}"</span>}
            </span>
            <Link href="/tasks" style={{ fontSize: 12, color: '#ef4444', textDecoration: 'underline', flexShrink: 0 }}>
              View &amp; resolve →
            </Link>
          </div>
        )}

        {/* ── Stat cards with sparklines ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {STATS.map(({ label, count, icon: Icon, href, color, spark }) => (
            <Link key={label} href={href} style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '16px 18px', cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color + '55'; e.currentTarget.style.backgroundColor = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.backgroundColor = 'var(--card)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={color} />
                  </div>
                  <Sparkline data={spark} color={color} />
                </div>
                <div>
                  <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--foreground)', margin: 0, lineHeight: 1 }}>
                    {loading ? '—' : count}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '4px 0 0' }}>{label}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Task progress (donut) ── */}
        {!loading && tasks.length > 0 && (
          <div style={{
            backgroundColor: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '14px 20px', marginBottom: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <TrendingUp size={14} color="var(--primary)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Task progress</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted-foreground)' }}>{tasks.length} total</span>
            </div>
            <TaskDonut
              todo={tasks.filter(t => t.status === 'todo').length}
              inProgress={inProgress.length}
              done={doneTasks.length}
              overdue={overdueTasks.length}
            />
          </div>
        )}

        {/* ── AI Digest ── shown only when AI is configured */}
        {aiConfigured && (
          <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: digest || digestLoading ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={13} color="var(--primary)" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>AI Knowledge Digest</span>
              </div>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: 6 }}>
                {/* Period toggle */}
                <div style={{ display: 'flex', borderRadius: 7, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  {(['day', 'week'] as const).map(p => (
                    <button key={p} type="button" onClick={() => setDigestPeriod(p)} style={{
                      padding: '4px 10px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                      backgroundColor: digestPeriod === p ? 'var(--primary)' : 'transparent',
                      color: digestPeriod === p ? 'white' : 'var(--muted-foreground)',
                      transition: 'all 0.12s',
                    }}>
                      {p === 'day' ? 'Today' : 'This week'}
                    </button>
                  ))}
                </div>
                {/* Generate / Refresh */}
                <button type="button" onClick={() => generateDigest(digestPeriod)} disabled={digestLoading} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', borderRadius: 7,
                  border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                  backgroundColor: 'color-mix(in srgb, var(--primary) 8%, transparent)',
                  color: 'var(--primary)', fontSize: 12, fontWeight: 600,
                  cursor: digestLoading ? 'wait' : 'pointer', opacity: digestLoading ? 0.6 : 1,
                }}>
                  {digestLoading
                    ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
                    : digest
                    ? <><RefreshCw size={11} /> Regenerate</>
                    : <><Sparkles size={11} /> Generate digest</>
                  }
                </button>
              </div>
            </div>

            {digestError && (
              <div style={{ padding: '10px 16px', fontSize: 12, color: '#f87171' }}>
                {digestError}
              </div>
            )}

            {digest && !digestLoading && (
              <div style={{ padding: '14px 16px', fontSize: 13, lineHeight: 1.7, color: 'var(--foreground)' }}>
                <MarkdownContent>{digest}</MarkdownContent>
              </div>
            )}

            {!digest && !digestLoading && !digestError && (
              <div style={{ padding: '16px', fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center' }}>
                Click "Generate digest" for an AI summary of your recent note activity.
              </div>
            )}
          </div>
        )}

        {/* ── 3-column: Recent Notes / Open Tasks / Recent Bookmarks ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 14, marginBottom: 24 }}>

          {/* Recent Notes */}
          <Panel
            title="Recent Notes"
            icon={<FileText size={13} color="var(--primary)" />}
            href="/notes"
            action="New note"
            actionHref="/notes/new"
          >
            {loading ? <PanelLoading /> : notes.length === 0
              ? <PanelEmpty icon="📑" text="No notes yet" />
              : notes.slice(0, 6).map(note => (
                <Link key={note.id} href={`/notes/${note.id}`} style={rowStyle}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: NOTE_TYPE_COLOR[note.type] ?? 'var(--primary)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={rowTitleStyle} title={note.title || 'Untitled'}>{note.title || 'Untitled'}</p>
                    <p style={rowSubStyle}>{NOTE_TYPE_LABEL[note.type] ?? note.type}</p>
                  </div>
                  <span style={rowTimeStyle}>{formatRelative(note.updated_at)}</span>
                </Link>
              ))}
          </Panel>

          {/* Open Tasks */}
          <Panel
            title="Open Tasks"
            icon={<CheckSquare size={13} color="var(--primary)" />}
            href="/tasks"
            action="New task"
            actionHref="/tasks"
          >
            {loading ? <PanelLoading /> : openTasks.length === 0
              ? <PanelEmpty icon="🎉" text="All caught up!" />
              : openTasks.slice(0, 6).map(task => {
                const overdue = task.due_date && new Date(task.due_date) < new Date()
                return (
                  <div key={task.id} style={{ ...rowStyle, cursor: 'default' }}>
                    <span style={{ flexShrink: 0 }}>{STATUS_ICON[task.status]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={rowTitleStyle} title={task.title}>{task.title}</p>
                      {task.due_date && (
                        <p style={{ ...rowSubStyle, color: overdue ? '#ef4444' : 'var(--muted-foreground)' }}>
                          {overdue ? '⚠ ' : ''}Due {formatDate(task.due_date)}
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: PRIORITY_COLOR[task.priority], flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {task.priority}
                    </span>
                  </div>
                )
              })}
          </Panel>

          {/* Recent Bookmarks */}
          <Panel
            title="Recent Bookmarks"
            icon={<Bookmark size={13} color="#f59e0b" />}
            href="/bookmarks"
            action="All bookmarks"
            actionHref="/bookmarks"
          >
            {loading ? <PanelLoading /> : bookmarks.length === 0
              ? <PanelEmpty icon="🔖" text="No bookmarks yet" />
              : bookmarks.slice(0, 6).map(bm => (
                <a key={bm.id} href={bm.url} target="_blank" rel="noopener noreferrer" style={rowStyle}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {bm.favicon_url
                    ? <img src={bm.favicon_url} alt="" style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                    : <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: '#f59e0b22', flexShrink: 0 }} />
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={rowTitleStyle} title={bm.title || bm.url}>{bm.title || bm.url}</p>
                    <p style={rowSubStyle}>{bm.hostname ?? (() => { try { return new URL(bm.url).hostname } catch { return bm.url } })()}</p>
                  </div>
                  <span style={rowTimeStyle}>{formatRelative(bm.created_at)}</span>
                </a>
              ))}
          </Panel>

        </div>

        {/* ── Knowledge health ── */}
        {!loading && (notes.length > 0 || bookmarks.length > 0) && (
          <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>

            {/* Header */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={14} color="var(--muted-foreground)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Knowledge health</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', opacity: 0.6 }}>Last 14 days</span>
            </div>

            {/* Activity area chart — full width */}
            <div style={{ padding: '16px 18px 0' }}>
              <ActivityChart data={activity14} />
            </div>

            {/* Stats strip */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              borderBottom: '1px solid var(--secondary)',
              margin: '10px 0 0',
            }}>
              {[
                { value: activityThisWeek, label: 'This week', accent: true },
                { value: `${activityThisWeek >= activityLastWeek ? '↑' : '↓'} ${activityLastWeek}`, label: 'Last week' },
                { value: uniqueTopics, label: 'Topics' },
                { value: `${pctOrganized}%`, label: 'Organized' },
              ].map(({ value, label, accent }, i) => (
                <div key={i} style={{
                  padding: '10px 0',
                  textAlign: 'center',
                  borderRight: i < 3 ? '1px solid var(--secondary)' : 'none',
                }}>
                  <p style={{ fontSize: 17, fontWeight: 800, color: accent ? 'var(--primary)' : 'var(--foreground)', margin: 0, lineHeight: 1 }}>{value}</p>
                  <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '3px 0 0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                </div>
              ))}
            </div>

            {/* Capture streak badge */}
            {activityStreak >= 2 && (
              <div style={{ padding: '8px 18px', borderBottom: '1px solid var(--secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>🔥 {activityStreak}-day capture streak</span>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>— keep it going!</span>
              </div>
            )}

            {/* Unorganized items — shown only when there's something to do */}
            {(queueNotes.length > 0 || queueBmarks.length > 0 || staleNotes > 0) ? (
              <div style={{ padding: '12px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Needs a tag
                  </span>
                  {(untaggedNotes + untaggedBmarks) > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                      {untaggedNotes + untaggedBmarks} items · open each to add tags
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {queueNotes.map(n => (
                    <Link key={n.id} href={`/notes/${n.id}`}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '7px 8px', borderRadius: 7, textDecoration: 'none', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <FileText size={13} color="var(--muted-foreground)" style={{ flexShrink: 0, marginTop: 1, opacity: 0.55 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: n.title ? 'var(--foreground)' : 'var(--muted-foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: n.title ? 'normal' : 'italic' }}>
                          {n.title || 'Untitled note'}
                        </p>
                        <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
                          {NOTE_TYPE_LABEL[n.type] ?? n.type} · captured {formatRelative(n.created_at)} · no tags yet
                        </p>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--primary)', flexShrink: 0, opacity: 0.7, whiteSpace: 'nowrap', marginTop: 1 }}>Add tags →</span>
                    </Link>
                  ))}
                  {queueBmarks.map(b => (
                    <a key={b.id} href={b.url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '7px 8px', borderRadius: 7, textDecoration: 'none', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <Bookmark size={13} color="var(--muted-foreground)" style={{ flexShrink: 0, marginTop: 1, opacity: 0.55 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.title || b.hostname || 'Bookmark'}
                        </p>
                        <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
                          {b.hostname} · saved {formatRelative(b.created_at)} · unsorted
                        </p>
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0, opacity: 0.5, whiteSpace: 'nowrap', marginTop: 1 }}>Open ↗</span>
                    </a>
                  ))}
                </div>
                {(untaggedNotes > queueNotes.length || untaggedBmarks > queueBmarks.length) && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 6, paddingLeft: 8 }}>
                    {untaggedNotes > queueNotes.length && (
                      <Link href="/notes" style={{ fontSize: 11, color: 'var(--primary)', textDecoration: 'none', opacity: 0.75 }}>
                        +{untaggedNotes - queueNotes.length} more notes →
                      </Link>
                    )}
                    {untaggedBmarks > queueBmarks.length && (
                      <Link href="/bookmarks" style={{ fontSize: 11, color: 'var(--muted-foreground)', textDecoration: 'none', opacity: 0.7 }}>
                        +{untaggedBmarks - queueBmarks.length} bookmarks →
                      </Link>
                    )}
                  </div>
                )}
                {staleNotes > 0 && (
                  <Link href="/notes"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)', padding: '10px 8px 4px', borderRadius: 7, textDecoration: 'none', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <AlertCircle size={12} color="#f59e0b" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)', flex: 1 }}>
                      <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{staleNotes}</span> notes untouched for 30+ days — worth a review
                    </span>
                    <ArrowRight size={10} color="var(--muted-foreground)" style={{ flexShrink: 0, opacity: 0.4 }} />
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={15} color="#10b981" />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Knowledge base fully organized</p>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>Every note and bookmark is tagged — great discipline!</p>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── Quick actions ── */}
        <div>
          <p style={{ fontSize: 10, color: 'var(--muted-foreground)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={11} color="var(--muted-foreground)" /> Quick actions
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { href: '/notes/new', icon: <FileText    size={13} />, label: 'New note',     color: 'var(--primary)' },
              { href: '/people',    icon: <Users        size={13} />, label: 'Add person',   color: '#10b981' },
              { href: '/tasks',     icon: <CheckSquare  size={13} />, label: 'New task',     color: 'var(--primary)' },
              { href: '/bookmarks', icon: <Bookmark     size={13} />, label: 'Save bookmark',color: '#f59e0b' },
              { href: '/graph',     icon: <Activity     size={13} />, label: 'View graph',   color: '#22d3ee' },
            ].map(({ href, icon, label, color }) => (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '7px 14px', borderRadius: 8, textDecoration: 'none',
                backgroundColor: 'var(--card)', border: '1px solid var(--border)',
                fontSize: 12, color: 'var(--secondary-foreground)', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color + '55'; e.currentTarget.style.color = color; e.currentTarget.style.backgroundColor = color + '0d' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--secondary-foreground)'; e.currentTarget.style.backgroundColor = 'var(--card)' }}
              >
                {icon} {label}
              </Link>
            ))}
          </div>
        </div>

      </PageContainer>
    </AppLayout>
  )
}

// ── Shared panel shell ───────────────────────────────────────
function Panel({ title, icon, href, action, actionHref, children }: {
  title: string; icon: React.ReactNode; href: string; action: string; actionHref: string; children: React.ReactNode
}) {
  return (
    <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--secondary)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {icon}
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href={actionHref} style={{ fontSize: 11, color: 'var(--muted-foreground)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
          >
            <Plus size={11} />
          </Link>
          <Link href={href} style={{ fontSize: 11, color: 'var(--muted-foreground)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
          >
            All <ArrowRight size={10} />
          </Link>
        </div>
      </div>
      <div style={{ padding: '6px', flex: 1 }}>
        {children}
      </div>
    </div>
  )
}

function PanelLoading() {
  return (
    <div style={{ padding: '12px 10px' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--secondary)' }} />
          <div style={{ height: 11, borderRadius: 4, backgroundColor: 'var(--secondary)', flex: 1, opacity: 1 - i * 0.2 }} />
        </div>
      ))}
    </div>
  )
}

function PanelEmpty({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ padding: '24px 10px', textAlign: 'center' }}>
      <p style={{ fontSize: 20, margin: '0 0 4px' }}>{icon}</p>
      <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>{text}</p>
    </div>
  )
}

// ── Shared row styles ────────────────────────────────────────
const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9,
  padding: '8px 8px', borderRadius: 7, textDecoration: 'none',
  transition: 'background 0.12s', backgroundColor: 'transparent',
}
const rowTitleStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: 'var(--foreground)', margin: 0,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const rowSubStyle: React.CSSProperties = {
  fontSize: 10, color: 'var(--muted-foreground)', margin: '1px 0 0',
}
const rowTimeStyle: React.CSSProperties = {
  fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0, marginLeft: 4,
}

// ── Smooth responsive area chart — theme-aware via CSS vars ──
function ActivityChart({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const W = 280, H = 54

  const coords = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - (v / max) * (H - 10) - 5,
  }))

  let linePath = `M ${coords[0].x},${coords[0].y}`
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1], curr = coords[i]
    const cpX = (prev.x + curr.x) / 2
    linePath += ` C ${cpX},${prev.y} ${cpX},${curr.y} ${curr.x},${curr.y}`
  }
  const first = coords[0], last = coords[coords.length - 1]
  const areaPath = `${linePath} L ${last.x},${H} L ${first.x},${H} Z`

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height: H }}
      >
        <defs>
          <linearGradient id="act-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--primary)', stopOpacity: 0.28 } as React.CSSProperties} />
            <stop offset="100%" style={{ stopColor: 'var(--primary)', stopOpacity: 0.02 } as React.CSSProperties} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#act-grad)" />
        <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
        <circle cx={last.x} cy={last.y} r="3.5" fill="var(--primary)" />
        <circle cx={last.x} cy={last.y} r="6.5" fill="var(--primary)" opacity="0.15" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 9, color: 'var(--muted-foreground)', opacity: 0.5 }}>14 days ago</span>
        <span style={{ fontSize: 9, color: 'var(--primary)', opacity: 0.75, fontWeight: 600 }}>Today</span>
      </div>
    </div>
  )
}

// ── Task Donut ───────────────────────────────────────────────
function TaskDonut({ todo, inProgress, done, overdue }: {
  todo: number; inProgress: number; done: number; overdue: number
}) {
  const total = todo + inProgress + done
  if (total === 0) return null

  const R = 34, STROKE = 10, SIZE = 88, C = SIZE / 2
  const circ = 2 * Math.PI * R

  // Segments drawn clockwise from 12 o'clock: done → in-progress → todo
  const segments = [
    { label: 'Done',        value: done,       color: '#10b981' },
    { label: 'In progress', value: inProgress, color: 'var(--primary)' },
    { label: 'To do',       value: todo,       color: 'var(--border)' },
  ]

  let cumPct = 0
  const arcs = segments.map(seg => {
    const pct      = seg.value / total
    const dashLen  = circ * pct
    // strokeDashoffset = circ * 0.25 shifts start from 3 o'clock to 12 o'clock;
    // subtract cumulative arc so each segment follows the previous one.
    const dashOff  = circ * (0.25 - cumPct)
    cumPct += pct
    return { ...seg, dashLen, dashOff }
  })

  const pctDone = Math.round((done / total) * 100)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
      {/* SVG donut */}
      <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
        <svg width={SIZE} height={SIZE}>
          {/* Track ring */}
          <circle cx={C} cy={C} r={R} fill="none" stroke="var(--secondary)" strokeWidth={STROKE} />
          {arcs.map(arc => arc.value > 0 && (
            <circle
              key={arc.label}
              cx={C} cy={C} r={R}
              fill="none"
              stroke={arc.color}
              strokeWidth={STROKE}
              strokeLinecap="butt"
              strokeDasharray={`${arc.dashLen} ${circ - arc.dashLen}`}
              strokeDashoffset={arc.dashOff}
            />
          ))}
        </svg>
        {/* Center label */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--foreground)', lineHeight: 1 }}>{pctDone}%</span>
          <span style={{ fontSize: 9, color: 'var(--muted-foreground)', marginTop: 2, letterSpacing: '0.04em' }}>done</span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {segments.map(seg => (
          <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)', minWidth: 82 }}>{seg.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', minWidth: 20, textAlign: 'right' }}>{seg.value}</span>
          </div>
        ))}
        {overdue > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <AlertCircle size={11} color="#ef4444" />
            <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 500 }}>{overdue} overdue</span>
          </div>
        )}
      </div>
    </div>
  )
}

