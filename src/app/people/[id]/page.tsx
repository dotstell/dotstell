'use client'
import { useState, useEffect, useCallback } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Mail, Building2, Phone, FileText, CheckSquare, Bookmark, Users } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Person, Note } from '@/types'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NoteCard } from '@/components/notes/NoteCard'
import { NoteEditor } from '@/components/notes/NoteEditor'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/ui/empty-state'

const DEFAULT_NOTE: Partial<Note> = { title: '', content: '', type: 'plain', checklist_items: [], tags: [] }

interface LinkedItem { id: string; type: string; label: string }

const LINKED_ICON: Record<string, React.ElementType> = { note: FileText, task: CheckSquare, bookmark: Bookmark, person: Users }
const LINKED_COLOR: Record<string, string> = { note: 'var(--primary)', task: '#ef4444', bookmark: '#f59e0b', person: '#10b981' }
const LINKED_HREF: Record<string, (id: string) => string> = {
  note: (id) => `/notes/${id}`,
  task: () => '/tasks',
  bookmark: () => '/bookmarks',
  person: (id) => `/people/${id}`,
}

export default function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [person, setPerson] = useState<Person | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([])
  const [noteLinkedTypes, setNoteLinkedTypes] = useState<Record<string, string[]>>({})
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Partial<Note>>(DEFAULT_NOTE)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const router = useRouter()

  const fetchData = useCallback(async () => {
    const [personRes, notesRes, linksRes] = await Promise.all([
      fetch(`/api/people/${id}`),
      fetch(`/api/notes?person_id=${id}`),
      fetch(`/api/links?target_id=${id}`),
    ])
    if (personRes.ok) setPerson(await personRes.json())
    const fetchedNotes: Note[] = notesRes.ok ? await notesRes.json() : []
    setNotes(fetchedNotes)

    // Fetch linked types per note to show connection badges on cards
    if (fetchedNotes.length > 0) {
      const typeMaps = await Promise.all(
        fetchedNotes.map(async (n) => {
          try {
            const r = await fetch(`/api/links?source_id=${n.id}`)
            if (!r.ok) return { id: n.id, types: [] as string[] }
            const links: { target_type: string; label?: string }[] = await r.json()
            const types = links
              .filter(l => l.label !== '__wikilink__')
              .map(l => l.target_type)
            return { id: n.id, types }
          } catch { return { id: n.id, types: [] as string[] } }
        })
      )
      const map: Record<string, string[]> = {}
      typeMaps.forEach(({ id, types }) => { map[id] = types })
      setNoteLinkedTypes(map)
    }

    if (linksRes.ok) {
      const links = await linksRes.json()
      const filtered = Array.isArray(links) ? links.filter((l: { label?: string }) => l.label !== '__wikilink__') : []
      const enriched: LinkedItem[] = await Promise.all(
        filtered.map(async (link: { source_id: string; source_type: string }) => {
          try {
            const r = await fetch(`/api/${link.source_type === 'person' ? 'people' : link.source_type + 's'}/${link.source_id}`)
            if (r.ok) {
              const item = await r.json()
              return { id: link.source_id, type: link.source_type, label: item.title ?? item.name ?? link.source_id }
            }
          } catch {}
          return { id: link.source_id, type: link.source_type, label: link.source_id }
        })
      )
      setLinkedItems(enriched)
    }
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

  function openDeleteConfirm(noteId: string) {
    setPendingDeleteId(noteId)
    setConfirmOpen(true)
  }

  async function deleteNote(noteId: string) {
    const res = await fetch(`/api/notes/${noteId}`, { method: 'DELETE' })
    if (res.ok) {
      setNotes(prev => prev.filter(n => n.id !== noteId))
      toast.success('Note deleted')
    }
  }

  if (loading) return <AppLayout><div className="p-6 text-[var(--muted-foreground)]">Loading...</div></AppLayout>
  if (!person) return (
    <AppLayout>
      <PageContainer narrow>
        <EmptyState
          icon="👤"
          title="Person not found"
          description="This person doesn't exist or may have been deleted."
          action="Back to People"
          onAction={() => router.push('/people')}
        />
      </PageContainer>
    </AppLayout>
  )

  return (
    <AppLayout>
      <PageContainer narrow>
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
                onDelete={openDeleteConfirm}
                linkedTypes={noteLinkedTypes[note.id]}
              />
            ))}
          </div>
        )}
        {/* Linked items — notes, tasks, bookmarks connected to this person via Link item */}
        {linkedItems.length > 0 && (
          <div className="mt-8">
            <h2 className="text-base font-semibold mb-4">Linked items ({linkedItems.length})</h2>
            <div className="flex flex-col gap-2">
              {linkedItems.map(item => {
                const Icon = LINKED_ICON[item.type] ?? FileText
                const color = LINKED_COLOR[item.type] ?? 'var(--primary)'
                const href = LINKED_HREF[item.type]?.(item.id) ?? '#'
                return (
                  <Link
                    key={item.id}
                    href={href}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40 transition-colors no-underline"
                  >
                    <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: color + '20' }}>
                      <Icon size={13} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{item.label}</p>
                      <p className="text-xs capitalize" style={{ color: 'var(--muted-foreground)' }}>{item.type}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </PageContainer>

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

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete note?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-[var(--muted-foreground)]">
            This note will be permanently deleted and cannot be recovered.
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (pendingDeleteId) await deleteNote(pendingDeleteId)
                setConfirmOpen(false)
                setPendingDeleteId(null)
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
