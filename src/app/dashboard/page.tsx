'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowRight, AlertCircle, TrendingUp, FileText, Bookmark,
  CheckSquare, Users, Plus, Zap, Clock, Activity,
  AlignLeft, CheckCircle2, Circle, Timer,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Task, Note, Bookmark as BookmarkType } from '@/types'
import { formatDate, formatRelative } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { useTaskReminders } from '@/hooks/useTaskReminders'
import { PageContainer } from '@/components/layout/PageContainer'

const PRIORITY_COLOR: Record<string, string> = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' }
const STATUS_COLOR:   Record<string, string> = { todo: '#6b6b88', in_progress: '#7c6aff', done: '#10b981' }
const STATUS_ICON = {
  todo:        <Circle      size={12} color="#6b6b88" />,
  in_progress: <Timer       size={12} color="#7c6aff" />,
  done:        <CheckCircle2 size={12} color="#10b981" />,
}
const NOTE_TYPE_COLOR: Record<string, string> = { markdown: '#7c6aff', plain: '#6b6b88', checklist: '#10b981' }
const NOTE_TYPE_LABEL: Record<string, string> = { markdown: 'Rich text', plain: 'Plain', checklist: 'Checklist' }

// ── Tiny Sparkline (SVG) ─────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 64, h = 24
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 4) - 2}`)
  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity={0.7}
      />
      {/* Filled area under the line */}
      <polygon
        points={`0,${h} ${pts.join(' ')} ${w},${h}`}
        fill={color}
        opacity={0.08}
      />
    </svg>
  )
}

// ── Activity item builder ────────────────────────────────────
type ActivityItem = {
  id: string
  type: 'note' | 'bookmark' | 'task'
  label: string
  action: string
  href: string
  time: string
  color: string
}

function buildActivity(
  notes: Note[],
  bookmarks: BookmarkType[],
  tasks: Task[],
): ActivityItem[] {
  const items: ActivityItem[] = [
    ...notes.slice(0, 6).map(n => ({
      id: n.id, type: 'note' as const,
      label: n.title || 'Untitled note',
      action: 'edited note',
      href: `/notes/${n.id}`,
      time: n.updated_at,
      color: '#7c6aff',
    })),
    ...bookmarks.slice(0, 4).map(b => ({
      id: b.id, type: 'bookmark' as const,
      label: b.title || b.url,
      action: 'saved bookmark',
      href: '/bookmarks',
      time: b.created_at,
      color: '#f59e0b',
    })),
    ...tasks.filter(t => t.status === 'done').slice(0, 4).map(t => ({
      id: t.id, type: 'task' as const,
      label: t.title,
      action: 'completed task',
      href: '/tasks',
      time: t.updated_at,
      color: '#10b981',
    })),
  ]
  return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 12)
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

export default function DashboardPage() {
  const [notes,     setNotes]     = useState<Note[]>([])
  const [tasks,     setTasks]     = useState<Task[]>([])
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([])
  const [people,    setPeople]    = useState<{ id: string; created_at: string }[]>([])
  const [loading,   setLoading]   = useState(true)

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

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const activity = buildActivity(notes, bookmarks, tasks)

  const STATS = [
    {
      label: 'Notes',     count: notes.length,      icon: FileText,  href: '/notes',
      color: '#7c6aff',   spark: buildSparkline(notes),
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
      color: overdueTasks.length > 0 ? '#ef4444' : '#a594ff',
      spark: buildSparkline(openTasks),
    },
  ]

  return (
    <AppLayout>
      <PageContainer>

        {/* ── Greeting ── */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f0', margin: 0 }}>{greeting} 👋</h1>
          <p style={{ fontSize: 13, color: '#6b6b88', marginTop: 4 }}>
            {loading ? 'Loading your knowledge…' :
              `${openTasks.length} open task${openTasks.length !== 1 ? 's' : ''}${overdueTasks.length > 0 ? ` · ${overdueTasks.length} overdue` : ' · all on track'} · ${notes.length} notes · ${bookmarks.length} bookmarks`}
          </p>
        </div>

        {/* ── Overdue alert ── */}
        {!loading && overdueTasks.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 16px', borderRadius: 10, marginBottom: 20,
            backgroundColor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)',
          }}>
            <AlertCircle size={14} color="#ef4444" />
            <span style={{ fontSize: 13, color: '#ef4444', flex: 1 }}>
              {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}
              {overdueTasks[0] && <span style={{ color: '#f87171', marginLeft: 8, fontStyle: 'italic' }}>— "{overdueTasks[0].title}"</span>}
            </span>
            <Link href="/tasks" style={{ fontSize: 12, color: '#ef4444', textDecoration: 'underline', flexShrink: 0 }}>
              View &amp; resolve →
            </Link>
          </div>
        )}

        {/* ── Stat cards with sparklines ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {STATS.map(({ label, count, icon: Icon, href, color, spark }) => (
            <Link key={label} href={href} style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: '#12121a', border: '1px solid #2a2a3e',
                borderRadius: 12, padding: '16px 18px', cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color + '55'; e.currentTarget.style.backgroundColor = '#14141f' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a3e'; e.currentTarget.style.backgroundColor = '#12121a' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={color} />
                  </div>
                  <Sparkline data={spark} color={color} />
                </div>
                <div>
                  <p style={{ fontSize: 26, fontWeight: 800, color: '#e8e8f0', margin: 0, lineHeight: 1 }}>
                    {loading ? '—' : count}
                  </p>
                  <p style={{ fontSize: 12, color: '#6b6b88', margin: '4px 0 0' }}>{label}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Task progress bar ── */}
        {!loading && tasks.length > 0 && (
          <div style={{
            backgroundColor: '#12121a', border: '1px solid #2a2a3e',
            borderRadius: 12, padding: '14px 20px', marginBottom: 24,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={14} color="#7c6aff" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0' }}>Task progress</span>
              </div>
              <span style={{ fontSize: 12, color: '#6b6b88' }}>{doneTasks.length}/{tasks.length} done · {progress}%</span>
            </div>
            <div style={{ height: 5, backgroundColor: '#1e1e2e', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #7c6aff, #10b981)', borderRadius: 99, transition: 'width 0.8s ease' }} />
            </div>
            <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
              {[
                { label: `${tasks.filter(t => t.status === 'todo').length} to do`,      color: '#6b6b88' },
                { label: `${inProgress.length} in progress`,                             color: '#7c6aff' },
                { label: `${doneTasks.length} done`,                                     color: '#10b981' },
                { label: `${overdueTasks.length} overdue`,                               color: '#ef4444' },
              ].map(({ label, color }) => (
                <span key={label} style={{ fontSize: 12, color }}>{label}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── 3-column: Recent Notes / Open Tasks / Recent Bookmarks ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 24 }}>

          {/* Recent Notes */}
          <Panel
            title="Recent Notes"
            icon={<FileText size={13} color="#7c6aff" />}
            href="/notes"
            action="New note"
            actionHref="/notes/new"
          >
            {loading ? <PanelLoading /> : notes.length === 0
              ? <PanelEmpty icon="📑" text="No notes yet" />
              : notes.slice(0, 6).map(note => (
                <Link key={note.id} href={`/notes/${note.id}`} style={rowStyle}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: NOTE_TYPE_COLOR[note.type] ?? '#7c6aff', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={rowTitleStyle}>{note.title || 'Untitled'}</p>
                    <p style={rowSubStyle}>{NOTE_TYPE_LABEL[note.type] ?? note.type}</p>
                  </div>
                  <span style={rowTimeStyle}>{formatRelative(note.updated_at)}</span>
                </Link>
              ))}
          </Panel>

          {/* Open Tasks */}
          <Panel
            title="Open Tasks"
            icon={<CheckSquare size={13} color="#a594ff" />}
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
                      <p style={rowTitleStyle}>{task.title}</p>
                      {task.due_date && (
                        <p style={{ ...rowSubStyle, color: overdue ? '#ef4444' : '#6b6b88' }}>
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
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {bm.favicon_url
                    ? <img src={bm.favicon_url} alt="" style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                    : <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: '#f59e0b22', flexShrink: 0 }} />
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={rowTitleStyle}>{bm.title || bm.url}</p>
                    <p style={rowSubStyle}>{bm.hostname ?? (() => { try { return new URL(bm.url).hostname } catch { return bm.url } })()}</p>
                  </div>
                  <span style={rowTimeStyle}>{formatRelative(bm.created_at)}</span>
                </a>
              ))}
          </Panel>

        </div>

        {/* ── Activity feed ── */}
        {!loading && activity.length > 0 && (
          <div style={{ backgroundColor: '#12121a', border: '1px solid #2a2a3e', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #1e1e2e' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={14} color="#6b6b88" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0' }}>Recent activity</span>
              </div>
              <span style={{ fontSize: 11, color: '#3a3a5e' }}>Last 7 days</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', padding: '8px' }}>
              {activity.map((item, idx) => (
                <Link key={`${item.id}-${idx}`} href={item.href} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8, textDecoration: 'none',
                  transition: 'background 0.12s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    backgroundColor: item.color + '15',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {item.type === 'note'     && <FileText     size={12} color={item.color} />}
                    {item.type === 'bookmark' && <Bookmark     size={12} color={item.color} />}
                    {item.type === 'task'     && <CheckCircle2 size={12} color={item.color} />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: '#d0d0e8', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </p>
                    <p style={{ fontSize: 10, color: '#4a4a6a', margin: '1px 0 0' }}>
                      {item.action} · {formatRelative(item.time)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Quick actions ── */}
        <div>
          <p style={{ fontSize: 10, color: '#3a3a5e', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={11} color="#3a3a5e" /> Quick actions
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { href: '/notes/new', icon: <FileText    size={13} />, label: 'New note',     color: '#7c6aff' },
              { href: '/people',    icon: <Users        size={13} />, label: 'Add person',   color: '#10b981' },
              { href: '/tasks',     icon: <CheckSquare  size={13} />, label: 'New task',     color: '#a594ff' },
              { href: '/bookmarks', icon: <Bookmark     size={13} />, label: 'Save bookmark',color: '#f59e0b' },
              { href: '/graph',     icon: <Activity     size={13} />, label: 'View graph',   color: '#22d3ee' },
            ].map(({ href, icon, label, color }) => (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '7px 14px', borderRadius: 8, textDecoration: 'none',
                backgroundColor: '#12121a', border: '1px solid #2a2a3e',
                fontSize: 12, color: '#a0a0b8', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color + '55'; e.currentTarget.style.color = color; e.currentTarget.style.backgroundColor = color + '0d' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a3e'; e.currentTarget.style.color = '#a0a0b8'; e.currentTarget.style.backgroundColor = '#12121a' }}
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
    <div style={{ backgroundColor: '#12121a', border: '1px solid #2a2a3e', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid #1e1e2e', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {icon}
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href={actionHref} style={{ fontSize: 11, color: '#3a3a5e', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#7c6aff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3a3a5e')}
          >
            <Plus size={11} />
          </Link>
          <Link href={href} style={{ fontSize: 11, color: '#3a3a5e', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
            onMouseEnter={e => (e.currentTarget.style.color = '#7c6aff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#3a3a5e')}
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
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#1e1e2e' }} />
          <div style={{ height: 11, borderRadius: 4, backgroundColor: '#1e1e2e', flex: 1, opacity: 1 - i * 0.2 }} />
        </div>
      ))}
    </div>
  )
}

function PanelEmpty({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ padding: '24px 10px', textAlign: 'center' }}>
      <p style={{ fontSize: 20, margin: '0 0 4px' }}>{icon}</p>
      <p style={{ fontSize: 12, color: '#3a3a5e', margin: 0 }}>{text}</p>
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
  fontSize: 12, fontWeight: 500, color: '#d8d8f0', margin: 0,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const rowSubStyle: React.CSSProperties = {
  fontSize: 10, color: '#6b6b88', margin: '1px 0 0',
}
const rowTimeStyle: React.CSSProperties = {
  fontSize: 10, color: '#4a4a6a', flexShrink: 0, marginLeft: 4,
}
