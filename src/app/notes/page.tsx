'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, LayoutGrid, List, Tag, ChevronDown, ChevronRight,
  FolderOpen, ArrowDownUp, Search,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Note, NoteType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NoteCard } from '@/components/notes/NoteCard'
import { NoteRow } from '@/components/notes/NoteRow'
import { EmptyState } from '@/components/ui/empty-state'

type ViewMode = 'grid' | 'list'
type GroupMode = 'none' | 'tag'
type SortMode  = 'updated' | 'created' | 'title'

const TYPE_FILTERS: { value: NoteType | 'all'; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'markdown',  label: 'Rich text' },
  { value: 'plain',     label: 'Plain' },
  { value: 'checklist', label: 'Checklist' },
]

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'updated', label: 'Last edited' },
  { value: 'created', label: 'Date created' },
  { value: 'title',   label: 'Title A–Z' },
]

function getLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  return (localStorage.getItem(key) as T) ?? fallback
}

export default function NotesPage() {
  const router = useRouter()
  const [notes,      setNotes]      = useState<Note[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState<NoteType | 'all'>('all')
  const [view,       setView]       = useState<ViewMode>('grid')
  const [groupMode,  setGroupMode]  = useState<GroupMode>('none')
  const [sortMode,   setSortMode]   = useState<SortMode>('updated')
  const [collapsed,  setCollapsed]  = useState<Record<string, boolean>>({})
  const [sortOpen,   setSortOpen]   = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setView(getLS('notes-view', 'grid'))
    setGroupMode(getLS('notes-group', 'none'))
    setSortMode(getLS('notes-sort', 'updated'))
  }, [])

  useEffect(() => { localStorage.setItem('notes-view',  view)      }, [view])
  useEffect(() => { localStorage.setItem('notes-group', groupMode)  }, [groupMode])
  useEffect(() => { localStorage.setItem('notes-sort',  sortMode)   }, [sortMode])

  useEffect(() => {
    function h(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const fetchNotes = useCallback(async () => {
    const params = new URLSearchParams()
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (search) params.set('q', search)
    params.set('root_only', 'true')
    const res = await fetch(`/api/notes?${params}`)
    const data = await res.json()
    setNotes(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [typeFilter, search])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  async function deleteNote(id: string) {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    if (res.ok) { setNotes(prev => prev.filter(n => n.id !== id)); toast.success('Note deleted') }
  }

  // Sort
  const sorted = [...notes].sort((a, b) => {
    if (sortMode === 'title')   return (a.title || 'Untitled').localeCompare(b.title || 'Untitled')
    if (sortMode === 'created') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  })

  // Group by tag
  type NoteGroup = { key: string; label: string; notes: Note[] }
  const groups: NoteGroup[] = (() => {
    if (groupMode === 'none') return [{ key: '__all', label: 'All', notes: sorted }]
    const tagMap = new Map<string, Note[]>()
    const untagged: Note[] = []
    for (const note of sorted) {
      if (!note.tags?.length) { untagged.push(note); continue }
      for (const tag of note.tags) {
        if (!tagMap.has(tag)) tagMap.set(tag, [])
        tagMap.get(tag)!.push(note)
      }
    }
    const result: NoteGroup[] = Array.from(tagMap.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .map(([tag, notes]) => ({ key: tag, label: tag, notes }))
    if (untagged.length > 0) result.push({ key: '__untagged', label: 'Untagged', notes: untagged })
    return result
  })()

  const sortLabel = SORT_OPTIONS.find(s => s.value === sortMode)?.label ?? 'Sort'

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '20px 28px 40px', maxWidth: 1200, paddingLeft: 48 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>All Notes</h1>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
              {sorted.length} {sorted.length === 1 ? 'note' : 'notes'}
            </p>
          </div>
          <Button onClick={() => router.push('/notes/new')}>
            <Plus size={15} /> New note
          </Button>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
            <Input placeholder="Search notes…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 220, paddingLeft: 30 }} />
          </div>

          <div style={{ display: 'flex', gap: 4 }}>
            {TYPE_FILTERS.map(({ value, label }) => (
              <button key={value} type="button" onClick={() => setTypeFilter(value)} style={{
                padding: '5px 12px', borderRadius: 20, border: 'none', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                backgroundColor: typeFilter === value ? 'var(--primary)' : 'var(--secondary)',
                color: typeFilter === value ? 'white' : 'var(--muted-foreground)',
                fontWeight: typeFilter === value ? 600 : 400,
              }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          <button type="button" onClick={() => setGroupMode(m => m === 'tag' ? 'none' : 'tag')} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 8, border: '1px solid',
            borderColor: groupMode === 'tag' ? 'var(--primary)' : 'var(--border)',
            backgroundColor: groupMode === 'tag' ? 'rgba(124,106,255,0.12)' : 'transparent',
            color: groupMode === 'tag' ? 'var(--primary)' : 'var(--muted-foreground)',
            fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <Tag size={13} />
            {groupMode === 'tag' ? 'Grouped by tag' : 'Group by tag'}
          </button>

          <div ref={sortRef} style={{ position: 'relative' }}>
            <button type="button" onClick={() => setSortOpen(o => !o)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border)',
              backgroundColor: 'transparent', color: 'var(--muted-foreground)', fontSize: 12, cursor: 'pointer',
            }}>
              <ArrowDownUp size={13} /> {sortLabel} <ChevronDown size={11} />
            </button>
            {sortOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, zIndex: 50, marginTop: 4,
                backgroundColor: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: 4, minWidth: 150,
                boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
              }}>
                {SORT_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => { setSortMode(opt.value); setSortOpen(false) }} style={{
                    width: '100%', padding: '7px 12px', borderRadius: 7, border: 'none', textAlign: 'left',
                    backgroundColor: sortMode === opt.value ? 'rgba(124,106,255,0.12)' : 'transparent',
                    color: sortMode === opt.value ? 'var(--primary)' : 'var(--secondary-foreground)',
                    fontSize: 13, cursor: 'pointer', fontWeight: sortMode === opt.value ? 600 : 400,
                  }}
                    onMouseEnter={e => { if (sortMode !== opt.value) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { if (sortMode !== opt.value) e.currentTarget.style.backgroundColor = 'transparent' }}
                  >{opt.label}</button>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {(['grid', 'list'] as ViewMode[]).map(v => (
              <button key={v} type="button" onClick={() => setView(v)} title={`${v} view`} style={{
                width: 32, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                backgroundColor: view === v ? 'rgba(124,106,255,0.2)' : 'transparent',
                color: view === v ? 'var(--primary)' : 'var(--muted-foreground)',
              }}>
                {v === 'grid' ? <LayoutGrid size={14} /> : <List size={14} />}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Loading…</p>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon="📑"
            title="No notes yet"
            description="Write in rich text with formatting, or keep it plain. Type / for commands."
            action="Create your first note"
            onAction={() => router.push('/notes/new')}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: groupMode === 'tag' ? 20 : 0 }}>
            {groups.map(group => (
              <div key={group.key}>
                {groupMode === 'tag' && (
                  <button type="button" onClick={() => setCollapsed(p => ({ ...p, [group.key]: !p[group.key] }))} style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '6px 2px', marginBottom: 8, textAlign: 'left',
                  }}>
                    {collapsed[group.key]
                      ? <ChevronRight size={14} color="var(--muted-foreground)" />
                      : <ChevronDown  size={14} color="var(--muted-foreground)" />}
                    {group.key === '__untagged'
                      ? <FolderOpen size={13} color="var(--muted-foreground)" />
                      : <Tag size={12} color="var(--primary)" />}
                    <span style={{ fontSize: 13, fontWeight: 600, color: group.key === '__untagged' ? 'var(--muted-foreground)' : 'var(--primary)' }}>
                      {group.label}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)', backgroundColor: 'var(--secondary)', padding: '1px 7px', borderRadius: 99, fontWeight: 600 }}>
                      {group.notes.length}
                    </span>
                  </button>
                )}

                {!collapsed[group.key] && (
                  view === 'grid' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                      {group.notes.map(note => (
                        <NoteCard key={note.id} note={note} onClick={() => router.push(`/notes/${note.id}`)} onDelete={deleteNote} />
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {group.notes.map(note => (
                        <NoteRow key={note.id} note={note} onClick={() => router.push(`/notes/${note.id}`)} onDelete={deleteNote} />
                      ))}
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
