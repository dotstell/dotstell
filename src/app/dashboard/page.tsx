'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FileText, Users, Bookmark, CheckSquare, Network, ArrowRight } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Task, Note } from '@/types'
import { formatDate, formatRelative } from '@/lib/utils'

interface Stats {
  notes: number
  people: number
  bookmarks: number
  tasks: { total: number; todo: number; in_progress: number; done: number }
}

const PRIORITY_COLORS = {
  low: 'success' as const,
  medium: 'warning' as const,
  high: 'destructive' as const,
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ notes: 0, people: 0, bookmarks: 0, tasks: { total: 0, todo: 0, in_progress: 0, done: 0 } })
  const [recentNotes, setRecentNotes] = useState<Note[]>([])
  const [openTasks, setOpenTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [notesRes, peopleRes, bookmarksRes, tasksRes] = await Promise.all([
        fetch('/api/notes'),
        fetch('/api/people'),
        fetch('/api/bookmarks'),
        fetch('/api/tasks'),
      ])

      const [notes, people, bookmarks, tasks] = await Promise.all([
        notesRes.ok ? notesRes.json() : [],
        peopleRes.ok ? peopleRes.json() : [],
        bookmarksRes.ok ? bookmarksRes.json() : [],
        tasksRes.ok ? tasksRes.json() : [],
      ])

      const taskArr: Task[] = Array.isArray(tasks) ? tasks : []
      setStats({
        notes: Array.isArray(notes) ? notes.length : 0,
        people: Array.isArray(people) ? people.length : 0,
        bookmarks: Array.isArray(bookmarks) ? bookmarks.length : 0,
        tasks: {
          total: taskArr.length,
          todo: taskArr.filter(t => t.status === 'todo').length,
          in_progress: taskArr.filter(t => t.status === 'in_progress').length,
          done: taskArr.filter(t => t.status === 'done').length,
        },
      })
      setRecentNotes(Array.isArray(notes) ? notes.slice(0, 5) : [])
      setOpenTasks(taskArr.filter(t => t.status !== 'done').slice(0, 5))
      setLoading(false)
    }
    load()
  }, [])

  const STAT_CARDS = [
    { label: 'Notes', count: stats.notes, icon: FileText, href: '/notes', color: 'text-[var(--primary)]' },
    { label: 'People', count: stats.people, icon: Users, href: '/people', color: 'text-emerald-400' },
    { label: 'Bookmarks', count: stats.bookmarks, icon: Bookmark, href: '/bookmarks', color: 'text-amber-400' },
    { label: 'Tasks open', count: stats.tasks.todo + stats.tasks.in_progress, icon: CheckSquare, href: '/tasks', color: 'text-red-400' },
  ]

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-7">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-[var(--muted-foreground)]">Your knowledge at a glance</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
          {STAT_CARDS.map(({ label, count, icon: Icon, href, color }) => (
            <Link key={label} href={href}>
              <Card className="hover:border-[var(--primary)]/40 transition-all cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Icon size={18} className={color} />
                    <span className="text-2xl font-bold">{loading ? '—' : count}</span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Task progress bar */}
        {!loading && stats.tasks.total > 0 && (
          <Card className="mb-7">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Task progress</span>
                <span className="text-xs text-[var(--muted-foreground)]">{stats.tasks.done}/{stats.tasks.total} done</span>
              </div>
              <div className="h-2 bg-[var(--muted)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${stats.tasks.total > 0 ? (stats.tasks.done / stats.tasks.total) * 100 : 0}%` }}
                />
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-[var(--muted-foreground)]">
                <span>{stats.tasks.todo} to do</span>
                <span>{stats.tasks.in_progress} in progress</span>
                <span className="text-emerald-400">{stats.tasks.done} done</span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Recent Notes */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Notes</CardTitle>
                <Link href="/notes" className="text-xs text-[var(--primary)] flex items-center gap-1 hover:underline">
                  View all <ArrowRight size={11} />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-[var(--muted-foreground)]">Loading...</p>
              ) : recentNotes.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No notes yet</p>
              ) : (
                <div className="space-y-2">
                  {recentNotes.map(note => (
                    <Link key={note.id} href="/notes" className="flex items-center justify-between p-2.5 rounded-md hover:bg-[var(--accent)] transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{note.title || 'Untitled'}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">{note.type}</p>
                      </div>
                      <span className="text-xs text-[var(--muted-foreground)] flex-shrink-0 ml-2">{formatRelative(note.updated_at)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Open Tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Open Tasks</CardTitle>
                <Link href="/tasks" className="text-xs text-[var(--primary)] flex items-center gap-1 hover:underline">
                  View all <ArrowRight size={11} />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-[var(--muted-foreground)]">Loading...</p>
              ) : openTasks.length === 0 ? (
                <p className="text-sm text-[var(--muted-foreground)]">No open tasks 🎉</p>
              ) : (
                <div className="space-y-2">
                  {openTasks.map(task => (
                    <div key={task.id} className="flex items-center justify-between p-2.5 rounded-md hover:bg-[var(--accent)] transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{task.title}</p>
                        {task.due_date && (
                          <p className={`text-xs ${new Date(task.due_date) < new Date() ? 'text-red-400' : 'text-[var(--muted-foreground)]'}`}>
                            Due {formatDate(task.due_date)}
                          </p>
                        )}
                      </div>
                      <Badge variant={PRIORITY_COLORS[task.priority]} className="ml-2 flex-shrink-0">
                        {task.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <div className="mt-6">
          <p className="text-xs text-[var(--muted-foreground)] mb-3 uppercase tracking-wider">Quick actions</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/notes" className="flex items-center gap-2 px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-md text-sm hover:border-[var(--primary)]/40 transition-colors">
              <FileText size={14} className="text-[var(--primary)]" /> New note
            </Link>
            <Link href="/people" className="flex items-center gap-2 px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-md text-sm hover:border-[var(--primary)]/40 transition-colors">
              <Users size={14} className="text-emerald-400" /> Add contact
            </Link>
            <Link href="/tasks" className="flex items-center gap-2 px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-md text-sm hover:border-[var(--primary)]/40 transition-colors">
              <CheckSquare size={14} className="text-red-400" /> Create task
            </Link>
            <Link href="/graph" className="flex items-center gap-2 px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-md text-sm hover:border-[var(--primary)]/40 transition-colors">
              <Network size={14} className="text-amber-400" /> View graph
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
