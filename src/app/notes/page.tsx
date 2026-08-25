'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import {
  DndContext, DragEndEvent, DragOverlay, closestCenter,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, useSortable,
  rectSortingStrategy, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, LayoutGrid, List, Tag, ChevronDown, ChevronRight,
  FolderOpen, ArrowDownUp, Search, Pin, PinOff, Copy, BookOpen, Trash2, RotateCcw, X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Note, NoteType } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NoteCard } from '@/components/notes/NoteCard'
import { NoteRow } from '@/components/notes/NoteRow'
import { EmptyState } from '@/components/ui/empty-state'
import { useNotebooks, notebookTag, NOTEBOOK_TAG_PREFIX } from '@/hooks/useNotebooks'

type ViewMode = 'grid' | 'list'
type GroupMode = 'none' | 'tag'
type SortMode  = 'updated' | 'created' | 'title' | 'manual'

interface CtxMenu {
  x: number
  y: number
  note: Note
  subMenu: 'notebook' | null
}

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
  { value: 'manual',  label: 'Manual order' },
]

const NOTE_COLORS = [
  { label: 'Red',    value: '#ef4444' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Yellow', value: '#eab308' },
  { label: 'Green',  value: '#22c55e' },
  { label: 'Teal',   value: '#14b8a6' },
  { label: 'Blue',   value: '#3b82f6' },
  { label: 'Purple', value: '#8b5cf6' },
  { label: 'Pink',   value: '#ec4899' },
]

function getLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  return (localStorage.getItem(key) as T) ?? fallback
}

// ── Sortable wrapper ─────────────────────────────────────────────────────────
function SortableItem({ id, disabled, children }: { id: string; disabled: boolean; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        opacity: isDragging ? 0.35 : 1,
        cursor: disabled ? undefined : 'grab',
      }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}

export default function NotesPage() {
  const router = useRouter()
  const { notebooks } = useNotebooks()
  const [mounted,    setMounted]    = useState(false)
  const [notes,      setNotes]      = useState<Note[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [typeFilter, setTypeFilter] = useState<NoteType | 'all'>('all')
  const [view,       setView]       = useState<ViewMode>('grid')
  const [groupMode,  setGroupMode]  = useState<GroupMode>('none')
  const [sortMode,   setSortMode]   = useState<SortMode>('updated')
  const [collapsed,  setCollapsed]  = useState<Record<string, boolean>>({})
  const [sortOpen,   setSortOpen]   = useState(false)
  const [ctxMenu,    setCtxMenu]    = useState<CtxMenu | null>(null)
  const [activeId,   setActiveId]   = useState<string | null>(null)
  const [isMobile,   setIsMobile]   = useState(false)
  const [showTrash,  setShowTrash]  = useState(false)
  const [trashNotes, setTrashNotes] = useState<Note[]>([])
  const [trashLoading, setTrashLoading] = useState(false)
  const [confirmState, setConfirmState] = useState<{
    open: boolean; title: string; body: string; confirmLabel: string; onConfirm: () => void
  }>({ open: false, title: '', body: '', confirmLabel: '', onConfirm: () => {} })

  function openConfirm(opts: { title: string; body: string; confirmLabel: string; onConfirm: () => void }) {
    setConfirmState({ ...opts, open: true })
  }
  function closeConfirm() { setConfirmState(s => ({ ...s, open: false })) }
  const sortRef  = useRef<HTMLDivElement>(null)
  const ctxRef   = useRef<HTMLDivElement>(null)

  // Gate DnD and client-only rendering to prevent SSR hydration mismatch
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 8 } })
  )

  useEffect(() => {
    setView(getLS('notes-view', 'grid'))
    setGroupMode(getLS('notes-group', 'none'))
    setSortMode(getLS('notes-sort', 'updated') as SortMode)
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

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return
    function h(e: MouseEvent) {
      if (ctxRef.current && ctxRef.current.contains(e.target as Node)) return
      setCtxMenu(null)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ctxMenu])

  const fetchNotes = useCallback(async () => {
    const params = new URLSearchParams()
    if (typeFilter !== 'all') params.set('type', typeFilter)
    if (search) params.set('q', search)
    if (sortMode === 'manual') params.set('sort', 'manual')
    params.set('root_only', 'true')
    const res = await fetch(`/api/notes?${params}`)
    const data = await res.json()
    setNotes(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [typeFilter, search, sortMode])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  // Re-fetch when the sidebar (or any other component) mutates a note
  useEffect(() => {
    window.addEventListener('dotstell:notes-updated', fetchNotes)
    return () => window.removeEventListener('dotstell:notes-updated', fetchNotes)
  }, [fetchNotes])

  async function deleteNote(id: string) {
    const res = await fetch(`/api/notes/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setNotes(prev => prev.filter(n => n.id !== id))
      toast.success('Moved to trash')
      window.dispatchEvent(new CustomEvent('dotstell:notes-updated'))
    }
  }

  const fetchTrash = useCallback(async () => {
    setTrashLoading(true)
    const res = await fetch('/api/notes/trash')
    const data = await res.json()
    setTrashNotes(Array.isArray(data) ? data : [])
    setTrashLoading(false)
  }, [])

  // Load trash notes when the trash view is opened
  useEffect(() => { if (showTrash) fetchTrash() }, [showTrash, fetchTrash])

  async function restoreNote(id: string) {
    const res = await fetch(`/api/notes/${id}/restore`, { method: 'POST' })
    if (res.ok) {
      setTrashNotes(prev => prev.filter(n => n.id !== id))
      toast.success('Note restored')
      window.dispatchEvent(new CustomEvent('dotstell:notes-updated'))
    }
  }

  async function permanentDeleteNote(id: string, title: string) {
    openConfirm({
      title: 'Delete forever?',
      body: `"${title || 'Untitled'}" will be permanently deleted and cannot be recovered.`,
      confirmLabel: 'Delete forever',
      onConfirm: async () => {
        const res = await fetch(`/api/notes/${id}/permanent`, { method: 'DELETE' })
        if (res.ok) { setTrashNotes(prev => prev.filter(n => n.id !== id)); toast.success('Permanently deleted') }
      },
    })
  }

  function confirmEmptyTrash() {
    openConfirm({
      title: 'Empty trash?',
      body: `All ${trashNotes.length} note${trashNotes.length === 1 ? '' : 's'} in trash will be permanently deleted. This cannot be undone.`,
      confirmLabel: 'Empty trash',
      onConfirm: async () => {
        const res = await fetch('/api/notes/trash', { method: 'DELETE' })
        if (res.ok) { setTrashNotes([]); toast.success('Trash emptied') }
      },
    })
  }

  // How long ago a note was deleted (human readable)
  function deletedAgo(deletedAt: string) {
    const ms = Date.now() - new Date(deletedAt).getTime()
    const days = Math.floor(ms / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return '1 day ago'
    return `${days} days ago`
  }

  function daysUntilPurge(deletedAt: string) {
    const ms = Date.now() - new Date(deletedAt).getTime()
    const daysIn = Math.floor(ms / (1000 * 60 * 60 * 24))
    return Math.max(0, 30 - daysIn)
  }

  function togglePin(note: Note) {
    const pinned = !note.pinned
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, pinned } : n))
    toast.success(pinned ? 'Note pinned' : 'Note unpinned')
    fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned }),
    }).then(res => {
      if (!res.ok) setNotes(prev => prev.map(n => n.id === note.id ? { ...n, pinned: note.pinned } : n))
      else window.dispatchEvent(new CustomEvent('dotstell:notes-updated'))
    }).catch(() => {
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, pinned: note.pinned } : n))
    })
  }

  async function duplicateNote(note: Note) {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:           (note.title || 'Untitled') + ' (copy)',
        content:         note.content,
        type:            note.type,
        tags:            note.tags,
        checklist_items: note.checklist_items,
        person_id:       note.person_id,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setNotes(prev => [created, ...prev])
      toast.success('Note duplicated')
      window.dispatchEvent(new CustomEvent('dotstell:notes-updated'))
    }
  }

  function moveToNotebook(note: Note, notebookName: string | null) {
    // Remove all existing nb: tags, then add the new one (if any)
    const cleanTags = (note.tags ?? []).filter(t => !t.startsWith(NOTEBOOK_TAG_PREFIX))
    const newTags   = notebookName ? [...cleanTags, notebookTag(notebookName)] : cleanTags
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, tags: newTags } : n))
    toast.success(notebookName ? `Moved to "${notebookName}"` : 'Removed from notebook')
    fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: newTags }),
    }).then(res => {
      if (!res.ok) setNotes(prev => prev.map(n => n.id === note.id ? { ...n, tags: note.tags } : n))
      else window.dispatchEvent(new CustomEvent('dotstell:notes-updated'))
    }).catch(() => {
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, tags: note.tags } : n))
    })
  }

  function setNoteColor(note: Note, color: string | null) {
    // State stores undefined for "no color" (omits the key); API expects null to clear it
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, color: color ?? undefined } : n))
    setCtxMenu(null)
    fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: color ?? null }),
    }).then(res => {
      if (!res.ok) setNotes(prev => prev.map(n => n.id === note.id ? { ...n, color: note.color } : n))
      else window.dispatchEvent(new CustomEvent('dotstell:notes-updated'))
    }).catch(() => {
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, color: note.color } : n))
    })
  }

  // ── Drag-and-drop ────────────────────────────────────────────────────────
  function handleDragStart(e: { active: { id: string | number } }) {
    setActiveId(String(e.active.id))
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIdx = notes.findIndex(n => n.id === active.id)
    const newIdx = notes.findIndex(n => n.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return

    const reordered = arrayMove(notes, oldIdx, newIdx)
    setNotes(reordered)

    // Persist new sort_order for all notes
    await Promise.all(
      reordered.map((n, i) =>
        fetch(`/api/notes/${n.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: i }),
        })
      )
    )
    window.dispatchEvent(new CustomEvent('dotstell:notes-updated'))
  }

  // ── Sort and group ───────────────────────────────────────────────────────
  const sorted = (() => {
    if (sortMode === 'manual') {
      // In manual mode order is managed by DB / drag-and-drop state; pinned float to top
      const pinned   = notes.filter(n => n.pinned)
      const unpinned = notes.filter(n => !n.pinned)
      return [...pinned, ...unpinned]
    }
    const arr = [...notes]
    if (sortMode === 'title')   arr.sort((a, b) => (a.title || 'Untitled').localeCompare(b.title || 'Untitled'))
    else if (sortMode === 'created') arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    else arr.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    // Pinned always at top for non-manual modes too
    return [...arr.filter(n => n.pinned), ...arr.filter(n => !n.pinned)]
  })()

  type NoteGroup = { key: string; label: string; notes: Note[] }
  const groups: NoteGroup[] = (() => {
    if (groupMode === 'none') return [{ key: '__all', label: 'All', notes: sorted }]
    const tagMap = new Map<string, Note[]>()
    const untagged: Note[] = []
    for (const note of sorted) {
      const visibleTags = note.tags?.filter(t => !t.startsWith(NOTEBOOK_TAG_PREFIX)) ?? []
      if (!visibleTags.length) { untagged.push(note); continue }
      for (const tag of visibleTags) {
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

  const sortLabel  = SORT_OPTIONS.find(s => s.value === sortMode)?.label ?? 'Sort'
  const dndEnabled = sortMode === 'manual' && groupMode === 'none'
  const activeNote = activeId ? notes.find(n => n.id === activeId) : null

  // ── Context menu helpers ─────────────────────────────────────────────────
  function openCtx(e: React.MouseEvent, note: Note) {
    e.preventDefault()
    e.stopPropagation()
    // Clamp at open-time so no window.* access during render
    const x = Math.min(e.clientX, window.innerWidth  - 200)
    const y = Math.min(e.clientY, window.innerHeight - 240)
    setCtxMenu({ x, y, note, subMenu: null })
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: '20px 28px 40px', maxWidth: 1200, paddingLeft: isMobile ? 16 : 48 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>
              {showTrash ? 'Trash' : 'All Notes'}
            </h1>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
              {showTrash
                ? `${trashNotes.length} ${trashNotes.length === 1 ? 'note' : 'notes'} · auto-delete after 30 days`
                : `${sorted.length} ${sorted.length === 1 ? 'note' : 'notes'}${sorted.some(n => n.pinned) ? ` · ${sorted.filter(n => n.pinned).length} pinned` : ''}`
              }
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {showTrash ? (
              <>
                {trashNotes.length > 0 && (
                  <button type="button" onClick={confirmEmptyTrash} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 8, border: '1px solid var(--destructive)',
                    backgroundColor: 'transparent', color: 'var(--destructive)',
                    fontSize: 13, cursor: 'pointer', fontWeight: 500,
                  }}>
                    <Trash2 size={14} /> Empty trash
                  </button>
                )}
                <button type="button" onClick={() => setShowTrash(false)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)',
                  backgroundColor: 'transparent', color: 'var(--muted-foreground)',
                  fontSize: 13, cursor: 'pointer',
                }}>
                  <X size={14} /> Close trash
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setShowTrash(true)} title="View trash" style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
                  backgroundColor: 'transparent', color: 'var(--muted-foreground)',
                  fontSize: 12, cursor: 'pointer',
                }}>
                  <Trash2 size={13} /> Trash
                </button>
                <Button onClick={() => router.push('/notes/new')}>
                  <Plus size={15} /> New note
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── Trash view ───────────────────────────────────────────────────── */}
        {showTrash && (
          <div>
            {trashLoading ? (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 13 }}>Loading…</p>
            ) : trashNotes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <p style={{ fontSize: 36, margin: '0 0 12px' }}>🗑</p>
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--foreground)', margin: '0 0 4px' }}>Trash is empty</p>
                <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: 0 }}>Deleted notes appear here for 30 days before being removed permanently.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {trashNotes.map(note => {
                  const remaining = daysUntilPurge(note.deleted_at!)
                  return (
                    <div key={note.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 10,
                      border: '1px solid var(--border)', backgroundColor: 'var(--card)',
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {note.title || 'Untitled'}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: 12, color: remaining <= 3 ? 'var(--destructive)' : 'var(--muted-foreground)' }}>
                          Deleted {deletedAgo(note.deleted_at!)} · {remaining === 0 ? 'deletes today' : `${remaining} day${remaining === 1 ? '' : 's'} left`}
                        </p>
                      </div>
                      <button type="button" onClick={() => restoreNote(note.id)} title="Restore note" style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border)',
                        backgroundColor: 'transparent', color: 'var(--foreground)',
                        fontSize: 12, cursor: 'pointer', flexShrink: 0,
                      }}>
                        <RotateCcw size={13} /> Restore
                      </button>
                      <button type="button" onClick={() => permanentDeleteNote(note.id, note.title)} title="Delete permanently" style={{
                        display: 'flex', alignItems: 'center',
                        padding: 6, borderRadius: 7, border: 'none',
                        backgroundColor: 'transparent', color: 'var(--muted-foreground)',
                        cursor: 'pointer', flexShrink: 0,
                      }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Controls + content — hidden when trash view is open */}
        {!showTrash && <><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
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
              padding: '5px 12px', borderRadius: 8, border: '1px solid',
              borderColor: sortMode === 'manual' ? 'var(--primary)' : 'var(--border)',
              backgroundColor: sortMode === 'manual' ? 'rgba(124,106,255,0.12)' : 'transparent',
              color: sortMode === 'manual' ? 'var(--primary)' : 'var(--muted-foreground)',
              fontSize: 12, cursor: 'pointer',
            }}>
              <ArrowDownUp size={13} /> {sortLabel} <ChevronDown size={11} />
            </button>
            {sortOpen && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, zIndex: 50, marginTop: 4,
                backgroundColor: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 10, padding: 4, minWidth: 160,
                boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
              }}>
                {SORT_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => { setSortMode(opt.value); setSortOpen(false) }} style={{
                    width: '100%', padding: '7px 12px', borderRadius: 7, border: 'none', textAlign: 'left',
                    backgroundColor: sortMode === opt.value ? 'rgba(124,106,255,0.12)' : 'transparent',
                    color: sortMode === opt.value ? 'var(--primary)' : 'var(--secondary-foreground)',
                    fontSize: 13, cursor: 'pointer', fontWeight: sortMode === opt.value ? 600 : 400,
                    display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start',
                  }}
                    onMouseEnter={e => { if (sortMode !== opt.value) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={e => { if (sortMode !== opt.value) e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    <span>{opt.label}</span>
                    {opt.value === 'manual' && <span style={{ fontSize: 10, color: 'var(--muted-foreground)', fontWeight: 400 }}>drag to reorder</span>}
                  </button>
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

        {dndEnabled && (
          <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginBottom: 12, marginTop: -8 }}>
            Drag cards to reorder · Right-click for more options
          </p>
        )}

        {/* Content — gate DnD on mounted to avoid SSR hydration mismatch */}
        {!mounted || loading ? (
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={e => setActiveId(String(e.active.id))}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
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
                    <SortableContext
                      items={group.notes.map(n => n.id)}
                      strategy={view === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
                    >
                      {view === 'grid' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                          {group.notes.map(note => (
                            <SortableItem key={note.id} id={note.id} disabled={!dndEnabled}>
                              <NoteCard
                                note={note}
                                onClick={() => router.push(`/notes/${note.id}`)}
                                onDelete={deleteNote}
                                onContextMenu={e => openCtx(e, note)}
                                onPin={() => togglePin(note)}
                              />
                            </SortableItem>
                          ))}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {group.notes.map(note => (
                            <SortableItem key={note.id} id={note.id} disabled={!dndEnabled}>
                              <NoteRow
                                note={note}
                                onClick={() => router.push(`/notes/${note.id}`)}
                                onDelete={deleteNote}
                                onContextMenu={e => openCtx(e, note)}
                                onPin={() => togglePin(note)}
                              />
                            </SortableItem>
                          ))}
                        </div>
                      )}
                    </SortableContext>
                  )}
                </div>
              ))}
            </div>

            <DragOverlay>
              {activeNote && (
                <div style={{ opacity: 0.85, transform: 'rotate(1.5deg)', pointerEvents: 'none' }}>
                  {view === 'grid' ? (
                    <NoteCard note={activeNote} onClick={() => {}} onDelete={() => {}} />
                  ) : (
                    <NoteRow note={activeNote} onClick={() => {}} onDelete={() => {}} />
                  )}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
        </>}
      </div>

      {/* ── Confirm modal ──────────────────────────────────────────────── */}
      {confirmState.open && (
        <>
          <div onClick={closeConfirm} style={{
            position: 'fixed', inset: 0, zIndex: 9998,
            backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
          }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 9999,
            width: '100%', maxWidth: 420,
            backgroundColor: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            boxShadow: '0 24px 60px rgba(0,0,0,0.65)',
            padding: '24px 24px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 20 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                backgroundColor: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Trash2 size={17} color="var(--destructive)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>
                  {confirmState.title}
                </p>
                <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.55 }}>
                  {confirmState.body}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" onClick={closeConfirm} style={{
                padding: '7px 18px', borderRadius: 8,
                border: '1px solid var(--border)',
                backgroundColor: 'transparent', color: 'var(--foreground)',
                fontSize: 13, cursor: 'pointer', fontWeight: 500,
              }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                Cancel
              </button>
              <button type="button" onClick={() => { confirmState.onConfirm(); closeConfirm() }} style={{
                padding: '7px 18px', borderRadius: 8, border: 'none',
                backgroundColor: 'var(--destructive)', color: 'white',
                fontSize: 13, cursor: 'pointer', fontWeight: 600,
                transition: 'opacity 0.15s',
              }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Context menu ───────────────────────────────────────────────── */}
      {ctxMenu && (
        <div
          ref={ctxRef}
          style={{
            position: 'fixed',
            top: ctxMenu.y,
            left: ctxMenu.x,
            zIndex: 9999,
            backgroundColor: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 10, padding: 4, minWidth: 190,
            boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
          }}
        >
          {/* Pin / Unpin */}
          <CtxBtn
            icon={ctxMenu.note.pinned ? PinOff : Pin}
            label={ctxMenu.note.pinned ? 'Unpin note' : 'Pin note'}
            onClick={() => { togglePin(ctxMenu.note); setCtxMenu(null) }}
          />

          {/* Color label */}
          <div style={{ padding: '6px 12px 6px', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', margin: '2px 0' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Color
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button
                type="button"
                title="No color"
                onClick={() => setNoteColor(ctxMenu.note, null)}
                style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  border: ctxMenu.note.color ? '2px solid var(--border)' : '2px solid var(--foreground)',
                  background: 'transparent', cursor: 'pointer', position: 'relative',
                }}
              >
                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'var(--muted-foreground)', lineHeight: 1 }}>✕</span>
              </button>
              {NOTE_COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  title={c.label}
                  onClick={() => setNoteColor(ctxMenu.note, c.value)}
                  style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    backgroundColor: c.value, cursor: 'pointer',
                    border: ctxMenu.note.color === c.value ? '2.5px solid var(--foreground)' : '2px solid transparent',
                    outline: ctxMenu.note.color === c.value ? `2px solid ${c.value}` : 'none',
                    outlineOffset: 1,
                    transition: 'transform 0.1s, border 0.1s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                />
              ))}
            </div>
          </div>

          {/* Move to notebook */}
          <div style={{ position: 'relative' }}>
            <CtxBtn
              icon={BookOpen}
              label="Move to notebook"
              suffix={<ChevronDown size={11} style={{ marginLeft: 'auto', opacity: 0.5, transform: ctxMenu.subMenu === 'notebook' ? 'rotate(180deg)' : 'none' }} />}
              onClick={() => setCtxMenu(m => m ? { ...m, subMenu: m.subMenu === 'notebook' ? null : 'notebook' } : m)}
            />
            {ctxMenu.subMenu === 'notebook' && (
              <div style={{
                marginTop: 2, borderTop: '1px solid var(--border)',
                paddingTop: 4, paddingBottom: 4,
              }}>
                {notebooks.length === 0 ? (
                  <div style={{ padding: '6px 14px', fontSize: 12, color: 'var(--muted-foreground)' }}>
                    No notebooks yet
                  </div>
                ) : (
                  <>
                    {notebooks.map(nb => {
                      const tag     = notebookTag(nb.name)
                      const current = ctxMenu.note.tags?.includes(tag)
                      return (
                        <CtxBtn
                          key={nb.id}
                          icon={() => <span style={{ fontSize: 14 }}>{nb.icon ?? '📓'}</span>}
                          label={nb.name}
                          active={current}
                          onClick={() => {
                            moveToNotebook(ctxMenu.note, current ? null : nb.name)
                            setCtxMenu(null)
                          }}
                        />
                      )
                    })}
                    {ctxMenu.note.tags?.some(t => t.startsWith(NOTEBOOK_TAG_PREFIX)) && (
                      <CtxBtn
                        icon={FolderOpen}
                        label="Remove from notebook"
                        onClick={() => { moveToNotebook(ctxMenu.note, null); setCtxMenu(null) }}
                      />
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Duplicate */}
          <CtxBtn
            icon={Copy}
            label="Duplicate note"
            onClick={() => { duplicateNote(ctxMenu.note); setCtxMenu(null) }}
          />

          <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '4px 8px' }} />

          {/* Delete */}
          <CtxBtn
            icon={Trash2}
            label="Delete note"
            danger
            onClick={() => { deleteNote(ctxMenu.note.id); setCtxMenu(null) }}
          />
        </div>
      )}
    </div>
  )
}

function CtxBtn({ icon: Icon, label, onClick, danger = false, active = false, suffix }: {
  icon: React.ElementType
  label: string
  onClick: () => void
  danger?: boolean
  active?: boolean
  suffix?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        width: '100%', padding: '7px 12px', borderRadius: 7,
        border: 'none', background: 'transparent', cursor: 'pointer',
        color: danger ? 'var(--destructive)' : active ? 'var(--primary)' : 'var(--foreground)',
        fontSize: 13, textAlign: 'left',
        transition: 'background 0.1s',
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.1)' : 'var(--accent)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <Icon size={14} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{label}</span>
      {suffix}
    </button>
  )
}
