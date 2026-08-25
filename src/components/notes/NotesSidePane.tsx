'use client'
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  DndContext, DragEndEvent, closestCenter,
  PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, Search, ChevronDown, ChevronRight, FileText, Tag,
  Pencil, Trash2, BookOpen, FolderPlus, X, StickyNote,
  Pin, PinOff, Copy, ArrowDownUp, GripVertical,
} from 'lucide-react'
import { Note } from '@/types'
import { useNotebooks, notebookTag, NOTEBOOK_TAG_PREFIX } from '@/hooks/useNotebooks'
import { useNoteTabs } from '@/hooks/useNoteTabs'
import { toast } from 'sonner'

interface Props {
  width?: number
  activeNoteId?: string
}

const ROW_H   = 36
const FONT_SM = 12
const FONT_MD = 13
const ICON_SZ = 15

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

// ── Color swatches — used in both note and notebook context menus ──
function ColorSwatches({ current, onSelect }: {
  current?: string | null
  onSelect: (color: string | null) => void
}) {
  return (
    <div style={{ padding: '6px 12px 4px', borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
        Color
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Clear / none */}
        <button
          type="button"
          title="No color"
          onClick={() => onSelect(null)}
          style={{
            width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
            border: current ? '2px solid var(--border)' : '2px solid var(--foreground)',
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
            onClick={() => onSelect(c.value)}
            style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              backgroundColor: c.value, cursor: 'pointer',
              border: current === c.value ? '2.5px solid var(--foreground)' : '2px solid transparent',
              outline: current === c.value ? `2px solid ${c.value}` : 'none',
              outlineOffset: 1,
              transition: 'transform 0.1s, border 0.1s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
          />
        ))}
      </div>
    </div>
  )
}

// ── Sortable note row — must live at module level so useSortable has stable identity ──
function SortableNoteItem({
  note, isActive, isPinned, onClick, onContextMenu,
}: {
  note: Note
  isActive: boolean
  isPinned: boolean
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}) {
  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: note.id })

  return (
    <div
      ref={setNodeRef}
      style={{
        display: 'flex', alignItems: 'center',
        transform: CSS.Transform.toString(transform),
        transition: transition ?? undefined,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      {/* Drag handle — only this area starts drag; click elsewhere navigates */}
      <div
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        style={{
          flexShrink: 0, cursor: isDragging ? 'grabbing' : 'grab',
          display: 'flex', alignItems: 'center',
          height: ROW_H, padding: '0 2px 0 4px',
          color: 'var(--sidebar-muted)', opacity: 0.35,
          touchAction: 'none',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.8' }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.35' }}
      >
        <GripVertical size={12} />
      </div>

      {/* Click area — normal navigation, no drag interference */}
      <button
        type="button"
        onClick={onClick}
        onContextMenu={onContextMenu}
        title={note.title || 'Untitled'}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          flex: 1, height: ROW_H,
          paddingLeft: 4, paddingRight: 8,
          border: 'none', cursor: 'pointer', textAlign: 'left',
          borderRadius: 6,
          borderLeft: note.color ? `2px solid ${note.color}` : isActive ? '2px solid var(--primary)' : '2px solid transparent',
          backgroundColor: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
          color: isActive ? 'var(--sidebar-active-fg)' : 'var(--sidebar-muted)',
          transition: 'background 0.1s, color 0.1s',
          fontWeight: isActive ? 600 : 400,
          boxSizing: 'border-box',
        }}
        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'var(--sidebar-hover-bg)'; e.currentTarget.style.color = 'var(--sidebar-hover-fg)' } }}
        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--sidebar-muted)' } }}
      >
        <FileText size={13} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.55, color: isActive ? 'var(--primary)' : 'inherit' }} />
        <span style={{ fontSize: FONT_MD, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {note.title || 'Untitled'}
        </span>
        {isPinned && <Pin size={10} style={{ flexShrink: 0, opacity: 0.5, color: 'var(--primary)' }} />}
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function NotesSidePane({ width = 220, activeNoteId }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const [notes,   setNotes]   = useState<Note[]>([])
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)
  const { notebooks, createNotebook, deleteNotebook, renameNotebook, reorderNotebook, setNotebookColor } = useNotebooks()
  const { openTab } = useNoteTabs()

  const [sectionOpen,    setSectionOpen]    = useState<Record<string, boolean>>({ all: true, notebooks: true, tags: false })
  const [newNotebookMode, setNewNotebookMode] = useState(false)
  const [newNotebookName, setNewNotebookName] = useState('')
  const [contextMenu,    setContextMenu]    = useState<{ x: number; y: number; id: string; type: 'notebook' | 'note' } | null>(null)
  const [renameTarget,   setRenameTarget]   = useState<{ id: string; value: string; type: 'notebook' | 'note' } | null>(null)
  const [hoveredNb,      setHoveredNb]      = useState<string | null>(null)
  const [sidebarSort,    setSidebarSort]    = useState<'updated' | 'manual'>('updated')
  const [dndMounted,     setDndMounted]     = useState(false)   // SSR gate for DndContext
  const [dragNbId,       setDragNbId]       = useState<string | null>(null)
  const [dragOverId,     setDragOverId]     = useState<string | null>(null)
  const [pinnedIds,      setPinnedIds]      = useState<Set<string>>(new Set())
  const newNbRef         = useRef<HTMLInputElement>(null)
  const ctxMenuRef       = useRef<HTMLDivElement>(null)
  // Guard against double-invocation: onKeyDown (Enter) and onBlur can both fire handleNewNotebook
  // during the async gap between the await and the state update committing to the DOM.
  const isCreatingNb     = useRef(false)
  // Adjusted display position — starts at click coords, shifted after render to stay in viewport
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 })

  // Mount DnD only client-side to avoid SSR hydration mismatch
  useEffect(() => setDndMounted(true), [])

  // Load pinned-ids from localStorage after mount (avoids server/client mismatch)
  useEffect(() => {
    try { setPinnedIds(new Set(JSON.parse(localStorage.getItem('dotstell-pinned-notes') ?? '[]'))) } catch {}
  }, [])

  // Pointer sensor with 8px activation distance — click never triggers drag
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 8 } })
  )

  const fetchNotes = useCallback(async () => {
    const params = new URLSearchParams({ root_only: 'true' })
    if (sidebarSort === 'manual') params.set('sort', 'manual')
    const res = await fetch(`/api/notes?${params}`)
    if (res.ok) setNotes(await res.json().catch(() => []))
    setLoading(false)
  }, [sidebarSort])

  useEffect(() => { fetchNotes() }, [fetchNotes])
  useEffect(() => { fetchNotes() }, [pathname, fetchNotes])
  useEffect(() => {
    window.addEventListener('dotstell:notes-updated', fetchNotes)
    return () => window.removeEventListener('dotstell:notes-updated', fetchNotes)
  }, [fetchNotes])

  useEffect(() => {
    if (newNotebookMode) setTimeout(() => newNbRef.current?.focus(), 40)
  }, [newNotebookMode])

  // After the menu renders, measure it and nudge position to stay within the viewport.
  // useLayoutEffect fires before paint so there is no visible flicker.
  useLayoutEffect(() => {
    if (!contextMenu || !ctxMenuRef.current) return
    const { width, height } = ctxMenuRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const MARGIN = 8
    setCtxPos({
      x: Math.min(contextMenu.x, vw - width - MARGIN),
      y: Math.min(contextMenu.y, vh - height - MARGIN),
    })
  }, [contextMenu]) // re-runs when a new menu opens (different id/type/coords)

  useEffect(() => {
    if (!contextMenu) return
    function onMouseDown(e: MouseEvent) {
      const menu = document.querySelector('[data-ctx-note-menu]')
      if (menu && menu.contains(e.target as Node)) return
      setContextMenu(null)
    }
    // Close the menu as soon as the user starts scrolling or wheeling.
    // 'wheel' fires before any scroll event (catches blocked-scroll cases on trackpads).
    // 'scroll' with capture catches programmatic and keyboard scroll.
    function onClose() { setContextMenu(null) }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('wheel',     onClose, { capture: true, passive: true })
    document.addEventListener('scroll',    onClose, { capture: true })
    document.addEventListener('touchmove', onClose, { capture: true, passive: true })
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('wheel',     onClose, { capture: true } as EventListenerOptions)
      document.removeEventListener('scroll',    onClose, { capture: true } as EventListenerOptions)
      document.removeEventListener('touchmove', onClose, { capture: true } as EventListenerOptions)
    }
  }, [contextMenu])

  // ── Derived ──────────────────────────────────────────────────────────────────
  const filteredNotes = search.trim()
    ? notes.filter(n => (n.title || 'Untitled').toLowerCase().includes(search.toLowerCase()))
    : notes

  const notebookNotesMap: Record<string, Note[]> = {}
  for (const nb of notebooks) {
    const tag = notebookTag(nb.name)
    notebookNotesMap[nb.id] = filteredNotes
      .filter(n => n.tags?.includes(tag))
      .sort((a, b) => (pinnedIds.has(b.id) || b.pinned ? 1 : 0) - (pinnedIds.has(a.id) || a.pinned ? 1 : 0))
  }
  const notebookIds = new Set(notebooks.flatMap(nb => notebookNotesMap[nb.id]?.map(n => n.id) ?? []))

  const unnotebookedNotes = (() => {
    const base = filteredNotes.filter(n => !notebookIds.has(n.id))
    if (sidebarSort === 'manual') return base // DB returns pinned DESC, sort_order ASC
    return base.sort((a, b) => {
      const ap = pinnedIds.has(a.id) || !!a.pinned
      const bp = pinnedIds.has(b.id) || !!b.pinned
      if (bp !== ap) return bp ? 1 : -1
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
  })()

  const tagMap = new Map<string, Note[]>()
  for (const note of filteredNotes) {
    for (const tag of (note.tags ?? [])) {
      if (tag.startsWith(NOTEBOOK_TAG_PREFIX)) continue
      if (!tagMap.has(tag)) tagMap.set(tag, [])
      tagMap.get(tag)!.push(note)
    }
  }
  const sortedTags = [...tagMap.entries()].sort((a, b) => b[1].length - a[1].length)

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function openNote(id: string) { router.push(`/notes/${id}`) }

  async function createNote(notebookName?: string) {
    const tags = notebookName ? [notebookTag(notebookName)] : []
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '', content: '<p></p>', type: 'markdown', tags }),
    })
    if (res.ok) {
      const note = await res.json()
      openTab(note.id, 'Untitled')
      fetchNotes()
      router.push(`/notes/${note.id}`)
    }
  }

  function toggleSection(key: string) {
    setSectionOpen(p => ({ ...p, [key]: !p[key] }))
  }

  async function handleNewNotebook() {
    // Ref guard prevents double-submission: Enter fires onKeyDown, which may also trigger
    // onBlur before the state update commits, causing a second invocation mid-await.
    if (isCreatingNb.current) return
    const name = newNotebookName.trim()
    if (!name) { setNewNotebookName(''); setNewNotebookMode(false); return }
    // Client-side duplicate check avoids a round-trip for the common case
    if (notebooks.some(nb => nb.name.toLowerCase() === name.toLowerCase())) {
      toast.error(`A notebook named "${name}" already exists.`)
      return
    }
    isCreatingNb.current = true
    setNewNotebookName(''); setNewNotebookMode(false)
    const result = await createNotebook(name, notebooks.length)
    isCreatingNb.current = false
    if ('error' in result) toast.error(result.error)
  }

  function onContextMenu(e: React.MouseEvent, id: string, type: 'notebook' | 'note') {
    e.preventDefault(); e.stopPropagation()
    // Set ctxPos to raw click coords first; useLayoutEffect will clamp after render
    setCtxPos({ x: e.clientX, y: e.clientY })
    setContextMenu({ x: e.clientX, y: e.clientY, id, type })
  }

  function togglePin(id: string) {
    setPinnedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      try { localStorage.setItem('dotstell-pinned-notes', JSON.stringify([...next])) } catch {}
      return next
    })
  }

  // ── Notebook drag-to-reorder (HTML5 — only notebooks, not notes) ──────────
  function handleNbDragStart(id: string) { setDragNbId(id) }
  function handleNbDragOver(e: React.DragEvent, id: string) { e.preventDefault(); setDragOverId(id) }
  function handleNbDrop(targetId: string) {
    if (!dragNbId || dragNbId === targetId) { setDragNbId(null); setDragOverId(null); return }
    reorderNotebook(dragNbId, targetId)
    setDragNbId(null); setDragOverId(null)
  }

  // ── Note reorder via @dnd-kit ─────────────────────────────────────────────
  async function handleSidebarDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = notes.findIndex(n => n.id === active.id)
    const newIdx = notes.findIndex(n => n.id === over.id)
    if (oldIdx === -1 || newIdx === -1) return
    const reordered = arrayMove([...notes], oldIdx, newIdx)
    setNotes(reordered)
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

  // ── Note context-menu actions ─────────────────────────────────────────────
  function setNoteColor(noteId: string, color: string | null) {
    // Optimistic update — apply instantly, rollback on API failure
    const prev = notes.find(n => n.id === noteId)
    setNotes(ns => ns.map(n => n.id === noteId ? { ...n, color: color ?? undefined } : n))
    setContextMenu(null)
    fetch(`/api/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: color ?? null }),
    }).then(res => {
      if (!res.ok) setNotes(ns => ns.map(n => n.id === noteId ? { ...n, color: prev?.color } : n))
      else window.dispatchEvent(new CustomEvent('dotstell:notes-updated'))
    }).catch(() => {
      setNotes(ns => ns.map(n => n.id === noteId ? { ...n, color: prev?.color } : n))
    })
  }

  async function moveNoteToNotebook(note: Note, nbName: string | null) {
    const cleanTags = (note.tags ?? []).filter(t => !t.startsWith(NOTEBOOK_TAG_PREFIX))
    const newTags   = nbName ? [...cleanTags, notebookTag(nbName)] : cleanTags
    const res = await fetch(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: newTags }),
    })
    if (res.ok) {
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, tags: newTags } : n))
      toast.success(nbName ? `Moved to "${nbName}"` : 'Removed from notebook')
      setContextMenu(null)
      window.dispatchEvent(new CustomEvent('dotstell:notes-updated'))
    }
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
      setContextMenu(null)
      window.dispatchEvent(new CustomEvent('dotstell:notes-updated'))
    }
  }

  // ── Plain note row (notebook/tag sections — no drag needed) ───────────────
  function NoteItem({ note, indent = 0 }: { note: Note; indent?: number }) {
    const isActive = note.id === activeNoteId
    const isPinned = note.pinned || pinnedIds.has(note.id)
    return (
      <button
        type="button"
        onClick={() => openNote(note.id)}
        onContextMenu={e => onContextMenu(e, note.id, 'note')}
        title={note.title || 'Untitled'}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          width: '100%', height: ROW_H,
          paddingLeft: indent > 0 ? indent : 6, paddingRight: 8,
          border: 'none', cursor: 'pointer', textAlign: 'left',
          borderRadius: 6,
          borderLeft: note.color ? `2px solid ${note.color}` : isActive ? '2px solid var(--primary)' : '2px solid transparent',
          backgroundColor: isActive ? 'var(--sidebar-active-bg)' : 'transparent',
          color: isActive ? 'var(--sidebar-active-fg)' : 'var(--sidebar-muted)',
          transition: 'background 0.1s, color 0.1s',
          fontWeight: isActive ? 600 : 400,
          boxSizing: 'border-box',
        }}
        onMouseEnter={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'var(--sidebar-hover-bg)'; e.currentTarget.style.color = 'var(--sidebar-hover-fg)' } }}
        onMouseLeave={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--sidebar-muted)' } }}
      >
        <FileText size={13} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.55, color: isActive ? 'var(--primary)' : 'inherit' }} />
        <span style={{ fontSize: FONT_MD, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {note.title || 'Untitled'}
        </span>
        {isPinned && <Pin size={10} style={{ flexShrink: 0, opacity: 0.5, color: 'var(--primary)' }} />}
      </button>
    )
  }

  function SectionHeader({ label, sKey, count, icon: Icon, onAdd }: {
    label: string; sKey: string; count?: number; icon?: React.ElementType; onAdd?: () => void
  }) {
    const open = sectionOpen[sKey] ?? true
    return (
      <div style={{ display: 'flex', alignItems: 'center', height: 28, paddingRight: 4, marginTop: 4 }}>
        <button
          type="button"
          onClick={() => toggleSection(sKey)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, flex: 1,
            height: '100%', background: 'none', border: 'none', cursor: 'pointer',
            paddingLeft: 10, paddingRight: 4, borderRadius: 6, textAlign: 'left',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--sidebar-hover-bg)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          {open
            ? <ChevronDown size={11} style={{ color: 'var(--sidebar-section-fg)', flexShrink: 0 }} />
            : <ChevronRight size={11} style={{ color: 'var(--sidebar-section-fg)', flexShrink: 0 }} />}
          {Icon && <Icon size={12} style={{ color: 'var(--sidebar-section-fg)', flexShrink: 0 }} />}
          <span style={{ fontSize: FONT_SM, fontWeight: 600, color: 'var(--sidebar-section-fg)', textTransform: 'uppercase', letterSpacing: '0.09em', flex: 1 }}>
            {label}
          </span>
          {count !== undefined && count > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--sidebar-muted)', backgroundColor: 'var(--muted)', padding: '1px 6px', borderRadius: 99 }}>
              {count}
            </span>
          )}
        </button>
        {onAdd && (
          <button
            type="button"
            onClick={onAdd}
            title={`New ${label.toLowerCase()}`}
            style={{
              width: 24, height: 24, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer',
              color: 'var(--sidebar-muted)', transition: 'background 0.12s, color 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover-bg)'; (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-hover-fg)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-muted)' }}
          >
            <Plus size={13} />
          </button>
        )}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      backgroundColor: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--sidebar-border)',
      height: '100%', overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 48, paddingLeft: 14, paddingRight: 10,
        borderBottom: '1px solid var(--sidebar-border)', flexShrink: 0,
      }}>
        <StickyNote size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', flex: 1 }}>Notes</span>
        <button
          type="button"
          title="New note"
          onClick={() => createNote()}
          style={{
            width: 28, height: 28, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'var(--primary)', color: 'white',
            border: 'none', borderRadius: 8, cursor: 'pointer', transition: 'opacity 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <Plus size={15} />
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 10px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--sidebar-muted)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '7px 30px 7px 30px',
              background: 'var(--sidebar-search-bg)',
              border: '1px solid var(--sidebar-border)',
              borderRadius: 8, fontSize: FONT_MD,
              color: 'var(--foreground)', outline: 'none',
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--sidebar-muted)', display: 'flex', alignItems: 'center', padding: 2, borderRadius: 4 }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 16px' }}>

        {/* All Notes section */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <SectionHeader label="All notes" sKey="all" count={filteredNotes.length} icon={FileText} onAdd={() => createNote()} />
          </div>
          <button
            type="button"
            title={sidebarSort === 'manual' ? 'Manual order — click for last edited' : 'Last edited — click for manual order'}
            onClick={() => setSidebarSort(s => s === 'updated' ? 'manual' : 'updated')}
            style={{
              width: 24, height: 24, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer',
              color: sidebarSort === 'manual' ? 'var(--primary)' : 'var(--sidebar-muted)',
              transition: 'background 0.12s, color 0.12s', marginRight: 2,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--sidebar-hover-bg)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}
          >
            <ArrowDownUp size={11} />
          </button>
        </div>

        {sidebarSort === 'manual' && !search && (
          <div style={{ padding: '0 10px 4px', fontSize: 10, color: 'var(--sidebar-muted)' }}>
            Drag grip to reorder
          </div>
        )}

        {sectionOpen.all && (
          <div style={{ marginTop: 2 }}>
            {loading ? (
              <div style={{ padding: '6px 12px', fontSize: FONT_SM, color: 'var(--sidebar-muted)' }}>Loading…</div>
            ) : unnotebookedNotes.length === 0 && notebooks.length === 0 ? (
              <div style={{ padding: '6px 12px', fontSize: FONT_SM, color: 'var(--sidebar-muted)' }}>
                {search ? 'No matches' : 'No notes yet'}
              </div>
            ) : sidebarSort === 'manual' && !search && dndMounted ? (
              // @dnd-kit reorderable list — activates only after 8px mouse movement
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSidebarDragEnd}>
                <SortableContext items={unnotebookedNotes.map(n => n.id)} strategy={verticalListSortingStrategy}>
                  {unnotebookedNotes.map(n => (
                    <SortableNoteItem
                      key={n.id}
                      note={n}
                      isActive={n.id === activeNoteId}
                      isPinned={n.pinned || pinnedIds.has(n.id)}
                      onClick={() => openNote(n.id)}
                      onContextMenu={e => onContextMenu(e, n.id, 'note')}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              unnotebookedNotes.map(n => <NoteItem key={n.id} note={n} />)
            )}
          </div>
        )}

        <div style={{ height: 1, backgroundColor: 'var(--sidebar-border)', margin: '8px 4px' }} />

        {/* Notebooks section */}
        <SectionHeader label="Notebooks" sKey="notebooks" count={notebooks.length} icon={BookOpen} onAdd={() => setNewNotebookMode(true)} />
        {sectionOpen.notebooks && (
          <div style={{ marginTop: 2 }}>
            {newNotebookMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: ROW_H, paddingLeft: 10, paddingRight: 8 }}>
                <FolderPlus size={ICON_SZ} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <input
                  ref={newNbRef}
                  value={newNotebookName}
                  onChange={e => setNewNotebookName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleNewNotebook()
                    if (e.key === 'Escape') { setNewNotebookMode(false); setNewNotebookName('') }
                  }}
                  onBlur={handleNewNotebook}
                  placeholder="Notebook name…"
                  style={{ flex: 1, background: 'var(--sidebar-search-bg)', border: '1px solid var(--primary)', borderRadius: 6, padding: '4px 8px', fontSize: FONT_MD, color: 'var(--foreground)', outline: 'none' }}
                />
              </div>
            )}
            {notebooks.length === 0 && !newNotebookMode && (
              <button
                type="button"
                onClick={() => setNewNotebookMode(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: ROW_H, paddingLeft: 10, border: '1px dashed var(--sidebar-border)', borderRadius: 8, background: 'none', color: 'var(--sidebar-muted)', fontSize: FONT_SM, cursor: 'pointer', marginTop: 2, boxSizing: 'border-box' }}
              >
                <FolderPlus size={ICON_SZ} /> Create your first notebook
              </button>
            )}
            {notebooks.map(nb => {
              const nbNotes = notebookNotesMap[nb.id] ?? []
              const isOpen  = sectionOpen[`nb-${nb.id}`] ?? true
              return (
                <div key={nb.id}>
                  <div
                    draggable
                    onDragStart={() => handleNbDragStart(nb.id)}
                    onDragOver={e => handleNbDragOver(e, nb.id)}
                    onDrop={() => handleNbDrop(nb.id)}
                    onDragLeave={() => setDragOverId(null)}
                    onDragEnd={() => { setDragNbId(null); setDragOverId(null) }}
                    onMouseEnter={() => setHoveredNb(nb.id)}
                    onMouseLeave={() => setHoveredNb(null)}
                    style={{
                      display: 'flex', alignItems: 'center',
                      opacity: dragNbId === nb.id ? 0.4 : 1,
                      borderTop: dragOverId === nb.id && dragNbId !== nb.id ? '2px solid var(--primary)' : '2px solid transparent',
                      borderRadius: 8,
                      transition: 'opacity 0.15s',
                      cursor: 'grab',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection(`nb-${nb.id}`)}
                      onContextMenu={e => onContextMenu(e, nb.id, 'notebook')}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, height: ROW_H, paddingLeft: 10, paddingRight: 4, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, textAlign: 'left', transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--sidebar-hover-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      {isOpen
                        ? <ChevronDown size={12} style={{ color: 'var(--sidebar-muted)', flexShrink: 0 }} />
                        : <ChevronRight size={12} style={{ color: 'var(--sidebar-muted)', flexShrink: 0 }} />}
                      <span style={{ fontSize: 15, flexShrink: 0, filter: nb.color ? `drop-shadow(0 0 3px ${nb.color}88)` : 'none' }}>{nb.icon ?? '📓'}</span>
                      {nb.color && <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: nb.color, flexShrink: 0 }} />}
                      {renameTarget?.id === nb.id ? (
                        <input
                          autoFocus
                          value={renameTarget.value}
                          onChange={e => setRenameTarget(r => r ? { ...r, value: e.target.value } : r)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { renameNotebook(nb.id, renameTarget.value); setRenameTarget(null) }
                            if (e.key === 'Escape') setRenameTarget(null)
                          }}
                          onBlur={() => { renameNotebook(nb.id, renameTarget.value); setRenameTarget(null) }}
                          onClick={e => e.stopPropagation()}
                          style={{ flex: 1, background: 'var(--sidebar-search-bg)', border: '1px solid var(--primary)', borderRadius: 5, padding: '2px 6px', fontSize: FONT_MD, color: 'var(--foreground)', outline: 'none' }}
                        />
                      ) : (
                        <span style={{ fontSize: FONT_MD, color: 'var(--foreground)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {nb.name}
                        </span>
                      )}
                      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--sidebar-muted)', backgroundColor: 'var(--muted)', padding: '1px 6px', borderRadius: 99, flexShrink: 0 }}>
                        {nbNotes.length}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); createNote(nb.name) }}
                      title="New note in notebook"
                      style={{ width: 28, height: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'var(--primary)', opacity: hoveredNb === nb.id ? 1 : 0, transition: 'opacity 0.15s, background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--sidebar-hover-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  {isOpen && (
                    <div style={{ marginLeft: 2 }}>
                      {nbNotes.length === 0 ? (
                        <button
                          type="button"
                          onClick={() => createNote(nb.name)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: ROW_H, paddingLeft: 28, paddingRight: 8, border: 'none', borderRadius: 7, background: 'none', color: 'var(--sidebar-muted)', fontSize: FONT_SM, cursor: 'pointer', boxSizing: 'border-box' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--sidebar-hover-bg)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <Plus size={12} style={{ opacity: 0.6 }} /> Add a note
                        </button>
                      ) : (
                        nbNotes.map(n => <NoteItem key={n.id} note={n} indent={18} />)
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Tags section */}
        {sortedTags.length > 0 && (
          <>
            <div style={{ height: 1, backgroundColor: 'var(--sidebar-border)', margin: '8px 4px' }} />
            <SectionHeader label="Tags" sKey="tags" count={sortedTags.length} icon={Tag} />
            {sectionOpen.tags && (
              <div style={{ marginTop: 2 }}>
                {sortedTags.map(([tag, tagNotes]) => {
                  const isOpen = sectionOpen[`tag-${tag}`] ?? false
                  return (
                    <div key={tag}>
                      <button
                        type="button"
                        onClick={() => toggleSection(`tag-${tag}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', height: ROW_H, paddingLeft: 10, paddingRight: 8, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8, textAlign: 'left', boxSizing: 'border-box', color: 'var(--sidebar-muted)', transition: 'background 0.12s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-hover-bg)'; e.currentTarget.style.color = 'var(--sidebar-hover-fg)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--sidebar-muted)' }}
                      >
                        {isOpen ? <ChevronDown size={12} style={{ flexShrink: 0, opacity: 0.6 }} /> : <ChevronRight size={12} style={{ flexShrink: 0, opacity: 0.6 }} />}
                        <Tag size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <span style={{ fontSize: FONT_MD, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--foreground)' }}>{tag}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--sidebar-muted)', backgroundColor: 'var(--muted)', padding: '1px 6px', borderRadius: 99 }}>{tagNotes.length}</span>
                      </button>
                      {isOpen && (
                        <div style={{ marginLeft: 2 }}>
                          {tagNotes.map(n => <NoteItem key={n.id} note={n} indent={18} />)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={ctxMenuRef}
          data-ctx-note-menu
          style={{
            position: 'fixed', zIndex: 9999,
            top: ctxPos.y, left: ctxPos.x,
            backgroundColor: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 10, padding: 4, minWidth: 150,
            boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
          }}
        >
          {contextMenu.type === 'notebook' && (() => {
            const ctxNb = notebooks.find(n => n.id === contextMenu.id)
            return (
              <>
                <CtxItem icon={Pencil} label="Rename" onClick={() => {
                  if (ctxNb) setRenameTarget({ id: ctxNb.id, value: ctxNb.name, type: 'notebook' })
                  setContextMenu(null)
                }} />
                <ColorSwatches
                  current={ctxNb?.color}
                  onSelect={color => { setNotebookColor(contextMenu.id, color); setContextMenu(null) }}
                />
                <div style={{ height: 4 }} />
                <CtxItem icon={Trash2} label="Delete notebook" danger onClick={() => { deleteNotebook(contextMenu.id); setContextMenu(null) }} />
              </>
            )
          })()}
          {contextMenu.type === 'note' && (() => {
            const ctxNote = notes.find(n => n.id === contextMenu.id)
            const isPinned = ctxNote?.pinned || pinnedIds.has(contextMenu.id)
            return (
              <>
                <CtxItem
                  icon={isPinned ? PinOff : Pin}
                  label={isPinned ? 'Unpin note' : 'Pin note'}
                  onClick={() => { togglePin(contextMenu.id); setContextMenu(null) }}
                />
                <ColorSwatches
                  current={ctxNote?.color}
                  onSelect={color => setNoteColor(contextMenu.id, color)}
                />
                {notebooks.length > 0 && (() => {
                  // Derive which notebook this note belongs to from its nb: tag (e.g. "nb:my-notebook")
                  const currentNb = notebooks.find(nb => ctxNote?.tags?.includes(notebookTag(nb.name)))
                  const otherNbs  = notebooks.filter(nb => nb !== currentNb)
                  return (
                    <div style={{ borderTop: '1px solid var(--border)', margin: '2px 0', paddingTop: 2 }}>
                      {currentNb ? (
                        <>
                          <div style={{ padding: '4px 12px 2px', fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            In notebook
                          </div>
                          <CtxItem
                            icon={() => <span style={{ fontSize: 13 }}>{currentNb.icon ?? '📓'}</span>}
                            label={currentNb.name}
                            active
                            suffix={<span style={{ fontSize: 10, color: 'var(--muted-foreground)', marginLeft: 'auto' }}>→ All Notes</span>}
                            onClick={() => ctxNote && moveNoteToNotebook(ctxNote, null)}
                          />
                          {otherNbs.length > 0 && (
                            <>
                              <div style={{ padding: '6px 12px 2px', fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Move to
                              </div>
                              {otherNbs.map(nb => (
                                <CtxItem
                                  key={nb.id}
                                  icon={() => <span style={{ fontSize: 13 }}>{nb.icon ?? '📓'}</span>}
                                  label={nb.name}
                                  onClick={() => ctxNote && moveNoteToNotebook(ctxNote, nb.name)}
                                />
                              ))}
                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <div style={{ padding: '4px 12px 2px', fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Move to notebook
                          </div>
                          {notebooks.map(nb => (
                            <CtxItem
                              key={nb.id}
                              icon={() => <span style={{ fontSize: 13 }}>{nb.icon ?? '📓'}</span>}
                              label={nb.name}
                              onClick={() => ctxNote && moveNoteToNotebook(ctxNote, nb.name)}
                            />
                          ))}
                        </>
                      )}
                      <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '2px 8px' }} />
                    </div>
                  )
                })()}
                <CtxItem icon={Copy} label="Duplicate" onClick={() => ctxNote && duplicateNote(ctxNote)} />
                <CtxItem icon={Trash2} label="Delete note" danger onClick={async () => {
                  const res = await fetch(`/api/notes/${contextMenu.id}`, { method: 'DELETE' })
                  if (res.ok) {
                    setNotes(prev => prev.filter(n => n.id !== contextMenu.id))
                    setContextMenu(null)
                    window.dispatchEvent(new CustomEvent('dotstell:notes-updated'))
                  }
                }} />
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}

function CtxItem({ icon: Icon, label, onClick, danger = false, active = false, suffix }: {
  icon: React.ElementType; label: string; onClick: () => void; danger?: boolean; active?: boolean; suffix?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        width: '100%', padding: '8px 12px', borderRadius: 7,
        border: 'none', background: 'transparent', cursor: 'pointer',
        color: danger ? 'var(--destructive)' : active ? 'var(--primary)' : 'var(--foreground)',
        fontSize: 13, textAlign: 'left',
        fontWeight: active ? 600 : 400,
        transition: 'background 0.1s',
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
