'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowRight, AlertCircle, TrendingUp } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Task, Note } from '@/types'
import { formatDate, formatRelative } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { useTaskReminders } from '@/hooks/useTaskReminders'

const PRIORITY_COLORS: Record<string, string> = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' }
const STATUS_COLORS: Record<string, string>   = { todo: '#6b6b88', in_progress: '#7c6aff', done: '#10b981' }

export default function DashboardPage() {
  const [notes,   setNotes]   = useState<Note[]>([])
  const [tasks,   setTasks]   = useState<Task[]>([])
  const [counts,  setCounts]  = useState({ notes: 0, people: 0, bookmarks: 0 })
  const [loading, setLoading] = useState(true)

  useTaskReminders()

  useEffect(() => {
    async function load() {
      const [nr, pr, br, tr] = await Promise.all([
        fetch('/api/notes'), fetch('/api/people'), fetch('/api/bookmarks'), fetch('/api/tasks'),
      ])
      const [n, p, b, t] = await Promise.all([nr.json(), pr.json(), br.json(), tr.json()])
      const taskArr: Task[] = Array.isArray(t) ? t : []
      const noteArr: Note[] = Array.isArray(n) ? n : []
      setNotes(noteArr.slice(0, 5))
      setTasks(taskArr)
      setCounts({ notes: noteArr.length, people: Array.isArray(p) ? p.length : 0, bookmarks: Array.isArray(b) ? b.length : 0 })
      setLoading(false)
    }
    load()
  }, [])

  const openTasks     = tasks.filter(t => t.status !== 'done')
  const overdueTasks  = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
  const doneTasks     = tasks.filter(t => t.status === 'done')
  const inProgress    = tasks.filter(t => t.status === 'in_progress')
  const progress      = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0

  const hour     = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const STATS = [
    { label: 'Notes',      count: counts.notes,      icon: '📑', href: '/notes',     color: '#7c6aff' },
    { label: 'People',     count: counts.people,     icon: '👥', href: '/people',    color: '#10b981' },
    { label: 'Bookmarks',  count: counts.bookmarks,  icon: '🔖', href: '/bookmarks', color: '#f59e0b' },
    { label: 'Open tasks', count: openTasks.length,  icon: '✅', href: '/tasks',     color: '#ef4444' },
  ]

  return (
    <AppLayout>
      <div style={{ padding: '32px', maxWidth: 1100, margin: 0 }}>

        {/* Greeting */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#e8e8f0', margin: 0 }}>{greeting} 👋</h1>
          <p style={{ fontSize: 13, color: '#6b6b88', marginTop: 4 }}>
            {loading ? 'Loading your knowledge...' :
              `${openTasks.length} open task${openTasks.length !== 1 ? 's' : ''}${overdueTasks.length > 0 ? ` · ${overdueTasks.length} overdue` : ' · all on track'}`
            }
          </p>
        </div>

        {/* Overdue alert */}
        {!loading && overdueTasks.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px', borderRadius: 10, marginBottom: 20,
            backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
          }}>
            <AlertCircle size={15} color="#ef4444" />
            <span style={{ fontSize: 13, color: '#ef4444' }}>
              {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}
            </span>
            <Link href="/tasks" style={{ fontSize: 13, color: '#ef4444', marginLeft: 4, textDecoration: 'underline' }}>
              View &amp; resolve
            </Link>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {STATS.map(({ label, count, icon, href, color }) => (
            <Link key={label} href={href} style={{ textDecoration: 'none' }}>
              <div
                style={{ backgroundColor: '#12121a', border: '1px solid #2a2a3e', borderRadius: 12, padding: '16px 18px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = color + '66')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2a3e')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 22 }}>{icon}</span>
                  <span style={{ fontSize: 28, fontWeight: 700, color: '#e8e8f0' }}>{loading ? '—' : count}</span>
                </div>
                <p style={{ fontSize: 12, color: '#6b6b88', margin: 0 }}>{label}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Progress bar */}
        {!loading && tasks.length > 0 && (
          <div style={{ backgroundColor: '#12121a', border: '1px solid #2a2a3e', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={15} color="#7c6aff" />
                <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0' }}>Task progress</span>
              </div>
              <span style={{ fontSize: 12, color: '#6b6b88' }}>{doneTasks.length}/{tasks.length} done · {progress}%</span>
            </div>
            <div style={{ height: 6, backgroundColor: '#1e1e2e', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, backgroundColor: '#10b981', borderRadius: 99, transition: 'width 0.6s ease' }} />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
              <span style={{ fontSize: 12, color: '#6b6b88' }}>{tasks.filter(t => t.status === 'todo').length} to do</span>
              <span style={{ fontSize: 12, color: '#7c6aff' }}>{inProgress.length} in progress</span>
              <span style={{ fontSize: 12, color: '#10b981' }}>{doneTasks.length} done</span>
            </div>
          </div>
        )}

        {/* Two column */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

          {/* Recent Notes */}
          <div style={{ backgroundColor: '#12121a', border: '1px solid #2a2a3e', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #2a2a3e' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0' }}>Recent Notes</span>
              <Link href="/notes" style={{ fontSize: 12, color: '#7c6aff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                View all <ArrowRight size={11} />
              </Link>
            </div>
            <div style={{ padding: '6px 8px' }}>
              {loading ? <p style={{ padding: '12px 10px', fontSize: 13, color: '#6b6b88' }}>Loading...</p>
              : notes.length === 0 ? <EmptyState icon="📑" title="No notes yet" description="Start capturing your thoughts." action="New note" onAction={() => { window.location.href = '/notes' }} />
              : notes.map(note => (
                <Link key={note.id} href="/notes" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 10px', borderRadius: 8, textDecoration: 'none', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: '#e8e8f0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.title || 'Untitled'}</p>
                    <p style={{ fontSize: 11, color: '#6b6b88', margin: '2px 0 0' }}>{note.type}</p>
                  </div>
                  <span style={{ fontSize: 11, color: '#6b6b88', flexShrink: 0, marginLeft: 8 }}>{formatRelative(note.updated_at)}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Open Tasks */}
          <div style={{ backgroundColor: '#12121a', border: '1px solid #2a2a3e', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #2a2a3e' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0' }}>Open Tasks</span>
              <Link href="/tasks" style={{ fontSize: 12, color: '#7c6aff', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                View all <ArrowRight size={11} />
              </Link>
            </div>
            <div style={{ padding: '6px 8px' }}>
              {loading ? <p style={{ padding: '12px 10px', fontSize: 13, color: '#6b6b88' }}>Loading...</p>
              : openTasks.length === 0 ? <EmptyState icon="🎉" title="All caught up!" description="No open tasks — create one or enjoy the moment." />
              : openTasks.slice(0, 5).map(task => {
                const overdue = task.due_date && new Date(task.due_date) < new Date()
                return (
                  <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: STATUS_COLORS[task.status], flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: '#e8e8f0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                      {task.due_date && (
                        <p style={{ fontSize: 11, color: overdue ? '#ef4444' : '#6b6b88', margin: '2px 0 0' }}>
                          {overdue ? '⚠ ' : ''}Due {formatDate(task.due_date)}
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: PRIORITY_COLORS[task.priority], flexShrink: 0 }}>{task.priority}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <p style={{ fontSize: 11, color: '#3a3a5e', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px' }}>Quick actions</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { href: '/notes',     icon: '📑', label: 'New note',    color: '#7c6aff' },
              { href: '/people',    icon: '👥', label: 'Add person',  color: '#10b981' },
              { href: '/tasks',     icon: '✅', label: 'Create task', color: '#ef4444' },
              { href: '/bookmarks', icon: '🔖', label: 'Save link',   color: '#f59e0b' },
              { href: '/graph',     icon: '🌐', label: 'View graph',  color: '#a594ff' },
            ].map(({ href, icon, label, color }) => (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', borderRadius: 8, textDecoration: 'none',
                backgroundColor: '#12121a', border: '1px solid #2a2a3e',
                fontSize: 13, color: '#a0a0b8', transition: 'border-color 0.15s, color 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color + '55'; e.currentTarget.style.color = '#e8e8f0' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a3e'; e.currentTarget.style.color = '#a0a0b8' }}
              >
                <span>{icon}</span>{label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </AppLayout>
  )
}
