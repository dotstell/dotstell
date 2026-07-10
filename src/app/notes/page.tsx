'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Note, NoteType } from '@/types'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NoteCard } from '@/components/notes/NoteCard'
import { NoteEditor } from '@/components/notes/NoteEditor'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'

const DEFAULT_NOTE: Partial<Note> = {
  title: '',
  content: '',
  type: 'plain',
  checklist_items: [],
  tags: [],
}

const TYPE_FILTERS: { value: NoteType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'plain', label: 'Plain' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'checklist', label: 'Checklist' },
]

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<NoteType | 'all'>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Partial<Note>>(DEFAULT_NOTE)
  const [saving, setSaving] = useState(false)

  const fetchNotes = useCallback(async () => {
    const params = new URLSearchParams()
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (search) params.set('q', search)
    const res = await fetch(`/api/notes?${params}`)
    const data = await res.json()
    setNotes(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [typeFilter, search])

  useEffect(() => {
    fetchNotes()
  }, [fetchNotes])

  function openNew() {
    setEditingNote({ ...DEFAULT_NOTE, type: 'plain' })
    setDialogOpen(true)
  }

  function openEdit(note: Note) {
    setEditingNote(note)
    setDialogOpen(true)
  }

  async function saveNote() {
    setSaving(true)
    try {
      const isEdit = !!(editingNote as Note).id
      const url = isEdit ? `/api/notes/${(editingNote as Note).id}` : '/api/notes'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingNote),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success(isEdit ? 'Note updated' : 'Note created')
      setDialogOpen(false)
      fetchNotes()
    } catch {
      toast.error('Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  async function deleteNote(id: string) {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setNotes(prev => prev.filter(n => n.id !== id))
      toast.success('Note deleted')
    }
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <PageHeader
          title="Notes"
          description="Your thoughts, ideas, and meeting notes"
          action={
            <Button onClick={openNew}>
              <Plus size={16} /> New note
            </Button>
          }
        />

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Input
            placeholder="Search notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex gap-1">
            {TYPE_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setTypeFilter(value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  typeFilter === value
                    ? 'bg-[var(--primary)] text-white'
                    : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes grid */}
        {loading ? (
          <div className="text-[var(--muted-foreground)] text-sm">Loading...</div>
        ) : notes.length === 0 ? (
          <EmptyState
            icon="📑"
            title="No notes yet"
            description="Capture your thoughts, meeting notes, or ideas. Use plain text, markdown, or a checklist."
            action="Create your first note"
            onAction={openNew}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {notes.map(note => (
              <NoteCard key={note.id} note={note} onClick={() => openEdit(note)} onDelete={deleteNote} />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{(editingNote as Note).id ? 'Edit note' : 'New note'}</DialogTitle>
          </DialogHeader>
          <NoteEditor note={editingNote} onChange={updates => setEditingNote(prev => ({ ...prev, ...updates }))} />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveNote} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
