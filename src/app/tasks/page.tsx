'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Calendar, User, Flag } from 'lucide-react'
import { toast } from 'sonner'
import { Task, TaskStatus, TaskPriority } from '@/types'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { formatDate, cn } from '@/lib/utils'

const DEFAULT_TASK: Partial<Task> = {
  title: '', description: '', status: 'todo', priority: 'medium', tags: [],
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-blue-500/20 text-blue-400',
  medium: 'bg-amber-500/20 text-amber-400',
  high: 'bg-red-500/20 text-red-400',
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

const STATUS_COLUMNS: TaskStatus[] = ['todo', 'in_progress', 'done']

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Task>>(DEFAULT_TASK)
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board')

  const fetchTasks = useCallback(async () => {
    const res = await fetch('/api/tasks')
    const data = await res.json()
    setTasks(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  async function save() {
    if (!editing.title?.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    try {
      const isEdit = !!(editing as Task).id
      const res = await fetch(
        isEdit ? `/api/tasks/${(editing as Task).id}` : '/api/tasks',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editing),
        }
      )
      if (!res.ok) throw new Error()
      toast.success(isEdit ? 'Task updated' : 'Task created')
      setDialogOpen(false)
      fetchTasks()
    } catch {
      toast.error('Failed to save task')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(task: Task, status: TaskStatus) {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status } : t))
    }
  }

  async function deleteTask(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setTasks(prev => prev.filter(t => t.id !== id))
      toast.success('Task deleted')
    }
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase()
    if (!tag || editing.tags?.includes(tag)) return
    setEditing(p => ({ ...p, tags: [...(p.tags ?? []), tag] }))
    setTagInput('')
  }

  const isOverdue = (task: Task) =>
    task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <PageHeader
          title="Tasks"
          description="Track your work and deadlines"
          action={
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {(['board', 'list'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setViewMode(m)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${viewMode === m ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'}`}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
              <Button onClick={() => { setEditing({ ...DEFAULT_TASK }); setDialogOpen(true) }}>
                <Plus size={16} /> New task
              </Button>
            </div>
          }
        />

        {loading ? (
          <div className="text-[var(--muted-foreground)] text-sm">Loading...</div>
        ) : viewMode === 'board' ? (
          <div className="grid grid-cols-3 gap-4">
            {STATUS_COLUMNS.map(status => {
              const colTasks = tasks.filter(t => t.status === status)
              return (
                <div key={status} className="bg-[var(--muted)] rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">{STATUS_LABELS[status]}</h3>
                    <span className="text-xs text-[var(--muted-foreground)] bg-[var(--border)] px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isOverdue={!!isOverdue(task)}
                        onEdit={() => { setEditing(task); setDialogOpen(true) }}
                        onDelete={() => deleteTask(task.id)}
                        onStatusChange={s => updateStatus(task, s)}
                      />
                    ))}
                    <button
                      onClick={() => { setEditing({ ...DEFAULT_TASK, status }); setDialogOpen(true) }}
                      className="w-full text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] py-2 rounded border border-dashed border-[var(--border)] hover:border-[var(--primary)]/40 transition-colors"
                    >
                      + Add task
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-[var(--muted-foreground)] mb-4">No tasks yet</p>
                <Button onClick={() => { setEditing({ ...DEFAULT_TASK }); setDialogOpen(true) }} variant="outline">Create your first task</Button>
              </div>
            ) : tasks.map(task => (
              <div key={task.id} className={cn(
                'group flex items-center gap-3 bg-[var(--card)] border rounded-lg p-3 transition-all',
                isOverdue(task) ? 'border-red-500/30' : 'border-[var(--border)] hover:border-[var(--primary)]/40'
              )}>
                <button
                  onClick={() => updateStatus(task, task.status === 'done' ? 'todo' : 'done')}
                  className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${task.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-[var(--border)] hover:border-emerald-500'}`}
                >
                  {task.status === 'done' && <span className="text-white text-xs">✓</span>}
                </button>
                <span className={cn('text-sm flex-1', task.status === 'done' && 'line-through text-[var(--muted-foreground)]')}>
                  {task.title}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                {task.due_date && (
                  <span className={`text-xs flex items-center gap-1 ${isOverdue(task) ? 'text-red-400' : 'text-[var(--muted-foreground)]'}`}>
                    <Calendar size={10} />{formatDate(task.due_date)}
                  </span>
                )}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-[var(--muted-foreground)]" onClick={() => { setEditing(task); setDialogOpen(true) }}>✏️</Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-[var(--muted-foreground)] hover:text-[var(--destructive)]" onClick={() => deleteTask(task.id)}><Trash2 size={12} /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{(editing as Task).id ? 'Edit task' : 'New task'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input placeholder="Task title *" value={editing.title ?? ''} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))} />
            <Textarea placeholder="Description..." rows={3} value={editing.description ?? ''} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-[var(--muted-foreground)] mb-1 block">Status</label>
                <Select value={editing.status} onValueChange={v => setEditing(p => ({ ...p, status: v as TaskStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-[var(--muted-foreground)] mb-1 block">Priority</label>
                <Select value={editing.priority} onValueChange={v => setEditing(p => ({ ...p, priority: v as TaskPriority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--muted-foreground)] mb-1 block">Due date</label>
              <Input type="date" value={editing.due_date ? editing.due_date.slice(0, 10) : ''} onChange={e => setEditing(p => ({ ...p, due_date: e.target.value || null }))} />
            </div>
            <div>
              <div className="flex flex-wrap gap-1 mb-2">
                {(editing.tags ?? []).map(tag => (
                  <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => setEditing(p => ({ ...p, tags: p.tags?.filter(t => t !== tag) }))}>
                    {tag} ×
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Add tag..." value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} className="text-xs" />
                <Button variant="outline" size="sm" onClick={addTag}>Add</Button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

function TaskCard({ task, isOverdue, onEdit, onDelete, onStatusChange }: {
  task: Task
  isOverdue: boolean
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (s: TaskStatus) => void
}) {
  return (
    <div className={cn(
      'group bg-[var(--card)] border rounded-lg p-3 text-sm cursor-pointer hover:border-[var(--primary)]/40 transition-all',
      isOverdue ? 'border-red-500/30' : 'border-[var(--border)]'
    )}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className={cn('font-medium text-xs', task.status === 'done' && 'line-through text-[var(--muted-foreground)]')}>
          {task.title}
        </p>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100">
          <button onClick={onEdit} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs">✏️</button>
          <button onClick={onDelete} className="text-[var(--muted-foreground)] hover:text-[var(--destructive)] text-xs"><Trash2 size={10} /></button>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
        {task.due_date && (
          <span className={`text-xs flex items-center gap-0.5 ${isOverdue ? 'text-red-400' : 'text-[var(--muted-foreground)]'}`}>
            <Calendar size={9} />{formatDate(task.due_date)}
          </span>
        )}
      </div>
      <select
        value={task.status}
        onChange={e => onStatusChange(e.target.value as TaskStatus)}
        onClick={e => e.stopPropagation()}
        className="mt-2 w-full bg-[var(--muted)] text-xs rounded px-1.5 py-1 border border-[var(--border)] text-[var(--muted-foreground)]"
      >
        <option value="todo">To Do</option>
        <option value="in_progress">In Progress</option>
        <option value="done">Done</option>
      </select>
    </div>
  )
}
