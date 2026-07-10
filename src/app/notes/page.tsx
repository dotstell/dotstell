'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, FileText, AlignLeft, CheckSquare } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Note, NoteType } from '@/types'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NoteCard } from '@/components/notes/NoteCard'
import { EmptyState } from '@/components/ui/empty-state'

const TYPE_FILTERS: { value: NoteType | 'all'; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'markdown',  label: 'Rich text' },
  { value: 'plain',     label: 'Plain' },
  { value: 'checklist', label: 'Checklist' },
]

export default function NotesPage() {
  const router = useRouter()
  const [notes,      setNotes]      = useState<Note[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState<NoteType | 'all'>('all')

  const fetchNotes = useCallback(async () => {
    const params = new URLSearchParams()
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (search) params.set('q', search)
    const res = await fetch(`/api/notes?${params}`)
    const data = await res.json()
    setNotes(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [typeFilter, search])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  async function deleteNote(id: string) {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setNotes(prev => prev.filter(n => n.id !== id))
      toast.success('Note deleted')
    }
  }

  return (
    <AppLayout>
      <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
        <PageHeader
          title="Notes"
          description="Rich text, plain, and checklist notes"
          action={
            <Button onClick={() => router.push('/notes/new')}>
              <Plus size={16} /> New note
            </Button>
          }
        />

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <Input
            placeholder="Search notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {TYPE_FILTERS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTypeFilter(value)}
                style={{
                  padding: '5px 12px', borderRadius: 20, border: 'none',
                  fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                  backgroundColor: typeFilter === value ? '#7c6aff' : '#1e1e2e',
                  color: typeFilter === value ? 'white' : '#6b6b88',
                  fontWeight: typeFilter === value ? 600 : 400,
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Notes grid */}
        {loading ? (
          <p style={{ color: '#6b6b88', fontSize: 13 }}>Loading...</p>
        ) : notes.length === 0 ? (
          <EmptyState
            icon="📑"
            title="No notes yet"
            description="Write in rich text with formatting, or keep it plain. Type / for commands."
            action="Create your first note"
            onAction={() => router.push('/notes/new')}
          />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {notes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                onClick={() => router.push(`/notes/${note.id}`)}
                onDelete={deleteNote}
              />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
