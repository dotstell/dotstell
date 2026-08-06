'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, LayoutGrid, List, Tag, ChevronDown, ChevronRight,
  FolderOpen, ArrowDownUp, Search,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Note, NoteType } from '@/types'
import { AppLayout } from '@/components/layout/AppLayout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NoteCard } from '@/components/notes/NoteCard'
import { NoteRow } from '@/components/notes/NoteRow'
import { EmptyState } from '@/components/ui/empty-state'
import { PageContainer } from '@/components/layout/PageContainer'

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
  const [view,       setView]       = useState<ViewMode>(getLS('notes-view', 'grid'))
  const [groupMode,  setGroupMode]  = useState<GroupMode>(getLS('notes-group', 'none'))
  const [sortMode,   setSortMode]   = useState<SortMode>(getLS('notes-sort', 'updated'))
  const [collapsed,  setCollapsed]  = useState<Record<string, boolean>>({})
  const [sortOpen,   setSortOpen]   = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

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
    <AppLayout>
      <PageContainer>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#e8e8f0', margin: 0 }}>Notes</h1>
            <p style={{ fontSize: 13, color: '#6b6b88', margin: '2px 0 0' }}>
              {sorted.length} {sorted.length === 1 ? 'note' : 'notes'}
            </p>
          </div>
          <Button onClick={() => router.push('/notes/new')}>
            <Plus size={15} /> New note
          </Button>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b6b88', pointerEvents: 'none' }} />
            <Input placeholder="Search notes…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 220, paddingLeft: 30 }} />
          </div>

          {/* Type filters */}
          <div style={{ display: 'flex', gap: 4 }}>
            {TYPE_FILTERS.map(({ value, label }) => (
              <button key={value} type="button" onClick={() => setTypeFilter(value)} style={{
                padding: '5px 12px', borderRadius: 20, border: 'none', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                backgroundColor: typeFilter === value ? '#7c6aff' : '#1e1e2e',
                color: typeFilter === value ? 'white' : '#6b6b88',
                fontWeight: typeFilter === value ? 600 : 400,
              }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* Group by tag */}
          <button type="button" onClick={() => setGroupMode(m => m === 'tag' ? 'none' : 'tag')} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 8, border: '1px solid',
            borderColor: groupMode === 'tag' ? '#7c6aff' : '#2a2a3e',
            backgroundColor: groupMode === 'tag' ? 'rgba(124,106,255,0.12)' : 'transparent',
            color: groupMode === 'tag' ? '#7c6aff' : '#6b6b88',
            fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <Tag size={13} />
            {groupMode === 'tag' ? 'Grouped by tag' : 'Group by tag'}
          </button>

          {/* Sort */}
          <div ref={sortRef} style={{ position: 'relative' }}>
            <button type="button" onClick={() => setSortOpen(o => !o)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 8, border: '1px solid #2a2a3e',
              backgroundColor: 'transparent', color: '#6b6b88', fontSize: 12, cursor: 'pointer',
            }}>
              <ArrowDownUp size={13} /> {sortLabel} <ChevronDown size={11} />
            </button>
            {sortOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, zIndex: 50, marginTop: 4,
                backgroundColor: '#12121a', border: '1px solid #2a2a3e',
                borderRadius: 10, padding: 4, minWidth: 150,
                boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
              }}>
                {SORT_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => { setSortMode(opt.value); setSortOpen(false) }} style={{
                    width: '100%', padding: '7px 12px', borderRadius: 7, border: 'none', textAlign: 'left',
                    backgroundColor: sortMode === opt.value ? 'rgba(124,106,255,0.12)' : 'transparent',
                    color: sortMode === opt.value ? '#7c6aff' : '#a0a0b8',
                    fontSize: 13, cursor: 'pointer', fontWeight: sortMode === opt.value ? 600 : 400,
                  }}
                    onMouseEnter={e => { if (sortMode !== opt.value) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { if (sortMode !== opt.value) e.currentTarget.style.backgroundColor = 'transparent' }}
                  >{opt.label}</button>
                ))}
              </div>
            )}
          </div>

          {/* View toggle */}
          <div style={{ display: 'flex', borderRadius: 8, border: '1px solid #2a2a3e', overflow: 'hidden' }}>
            {(['grid', 'list'] as ViewMode[]).map(v => (
              <button key={v} type="button" onClick={() => setView(v)} title={`${v} view`} style={{
                width: 32, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                backgroundColor: view === v ? 'rgba(124,106,255,0.2)' : 'transparent',
                color: view === v ? '#7c6aff' : '#6b6b88',
              }}>
                {v === 'grid' ? <LayoutGrid size={14} /> : <List size={14} />}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <p style={{ color: '#6b6b88', fontSize: 13 }}>Loading…</p>
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
                {/* Group header */}
                {groupMode === 'tag' && (
                  <button type="button" onClick={() => setCollapsed(p => ({ ...p, [group.key]: !p[group.key] }))} style={{
                    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '6px 2px', marginBottom: 8, textAlign: 'left',
                  }}>
                    {collapsed[group.key]
                      ? <ChevronRight size={14} color="#6b6b88" />
                      : <ChevronDown  size={14} color="#6b6b88" />}
                    {group.key === '__untagged'
                      ? <FolderOpen size={13} color="#6b6b88" />
                      : <Tag size={12} color="#7c6aff" />}
                    <span style={{ fontSize: 13, fontWeight: 600, color: group.key === '__untagged' ? '#6b6b88' : '#a594ff' }}>
                      {group.label}
                    </span>
                    <span style={{ fontSize: 11, color: '#6b6b88', backgroundColor: '#1e1e2e', padding: '1px 7px', borderRadius: 99, fontWeight: 600 }}>
                      {group.notes.length}
                    </span>
                  </button>
                )}

                {/* Notes */}
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
      </PageContainer>
    </AppLayout>
  )
}
