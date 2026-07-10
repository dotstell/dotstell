'use client'
import { useState, useEffect, useCallback } from 'react'
import { use } from 'react'
import { ArrowLeft, Plus, Mail, Building2, Phone } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Person, Note } from '@/types'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NoteCard } from '@/components/notes/NoteCard'
import { NoteEditor } from '@/components/notes/NoteEditor'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const DEFAULT_NOTE: Partial<Note> = { title: '', content: '', type: 'plain', checklist_items: [], tags: [] }

export default function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [person, setPerson] = useState<Person | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Partial<Note>>(DEFAULT_NOTE)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    const [personRes, notesRes] = await Promise.all([
      fetch(`/api/people/${id}`),
      fetch(`/api/notes?person_id=${id}`),
    ])
    if (personRes.ok) setPerson(await personRes.json())
    if (notesRes.ok) setNotes(await notesRes.json())
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  function openNewNote() {
    setEditingNote({ ...DEFAULT_NOTE, person_id: id })
    setDialogOpen(true)
  }

  async function saveNote() {
    setSaving(true)
    try {
      const isEdit = !!(editingNote as Note).id
      const url = isEdit ? `/api/notes/${(editingNote as Note).id}` : '/api/notes'
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editingNote, person_id: id }),
      })
      if (!res.ok) throw new Error()
      toast.success('Note saved')
      setDialogOpen(false)
      fetchData()
    } catch {
      toast.error('Failed to save note')
    } finally {
      setSaving(false)
    }
  }

  async function deleteNote(noteId: string) {
    const res = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' })
    if (res.ok) {
      setNotes(prev => prev.filter(n => n.id !== noteId))
      toast.success('Note deleted')
    }
  }

  if (loading) return <AppLayout><div className="p-6 text-[var(--muted-foreground)]">Loading...</div></AppLayout>
  if (!person) return <AppLayout><div className="p-6">Person not found</div></AppLayout>

  return (
    <AppLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <Link href="/people" className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] mb-5 transition-colors">
          <ArrowLeft size={14} /> Back to People
        </Link>

        {/* Person header */}
        <div className="flex items-start gap-4 mb-8 bg-[var(--card)] border border-[var(--border)] rounded-xl p-5">
          <div className="w-14 h-14 rounded-full bg-[var(--primary)]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-[var(--primary)] font-bold text-xl">{person.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold">{person.name}</h1>
            {person.role && <p className="text-[var(--muted-foreground)] text-sm">{person.role}</p>}
            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-[var(--muted-foreground)]">
              {person.company && <span className="flex items-center gap-1"><Building2 size={11} />{person.company}</span>}
              {person.email && <span className="flex items-center gap-1"><Mail size={11} />{person.email}</span>}
              {person.phone && <span className="flex items-center gap-1"><Phone size={11} />{person.phone}</span>}
            </div>
            {person.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {person.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
              </div>
            )}
          </div>
        </div>

        {/* 1-on-1 Notes */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">1-on-1 Notes ({notes.length})</h2>
          <Button size="sm" onClick={openNewNote}><Plus size={14} /> Add note</Button>
        </div>

        {notes.length === 0 ? (
          <div className="text-center py-10 bg-[var(--card)] border border-[var(--border)] rounded-lg">
            <p className="text-[var(--muted-foreground)] text-sm mb-3">No notes for {person.name} yet</p>
            <Button variant="outline" size="sm" onClick={openNewNote}>Add first note</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {notes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                onClick={() => { setEditingNote(note); setDialogOpen(true) }}
                onDelete={deleteNote}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{(editingNote as Note).id ? 'Edit note' : `New note with ${person.name}`}</DialogTitle>
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
