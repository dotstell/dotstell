'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Plus, Search, ChevronDown, ChevronRight, FileText, Tag,
  Pencil, Trash2, BookOpen, FolderPlus, X, StickyNote, Pin, PinOff,
} from 'lucide-react'
import { Note } from '@/types'
import { useNotebooks, notebookTag, NOTEBOOK_TAG_PREFIX } from '@/hooks/useNotebooks'
import { useNoteTabs } from '@/hooks/useNoteTabs'

interface Props {
  width?: number
  activeNoteId?: string
}

// Shared row height and spacing constants — matches sidebar
const ROW_H    = 36
const ICON_SZ  = 15
const FONT_SM  = 12
const FONT_MD  = 13

export function NotesSidePane({ width = 220, activeNoteId }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const [notes,   setNotes]   = useState<Note[]>([])
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)
  const { notebooks, createNotebook, deleteNotebook, renameNotebook, reorderNotebook } = useNotebooks()
  const { openTab } = useNoteTabs()

  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({
    all: true, notebooks: true, tags: false,
  })
  const [newNotebookMode, setNewNotebookMode] = useState(false)
  const [newNotebookName, setNewNotebookName] = useState('')
  const [contextMenu, setContextMenu]         = useState<{ x: number; y: number; id: string; type: 'notebook' | 'note' } | null>(null)
  const [renameTarget, setRenameTarget]       = useState<{ id: string; value: string; type: 'notebook' | 'note' } | null>(null)
  const [hoveredNb, setHoveredNb]             = useState<string | null>(null)
  const [dragNbId,  setDragNbId]              = useState<string | null>(null)
  const [dragOverId, setDragOverId]           = useState<string | null>(null)
  const [pinnedIds, setPinnedIds]             = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try { return new Set(JSON.parse(localStorage.getItem('dotstell-pinned-notes') ?? '[]')) } catch { return new Set() }
  })
  const newNbRef = useRef<HTMLInputElement>(null)

  const fetchNotes = useCallback(async () => {
    const res = await fetch('/api/notes?root_only=true')
    if (res.ok) setNotes(await res.json().catch(() => []))
    setLoading(false)
  }, [])

  useEffect(() => { fetchNotes() }, [fetchNotes])
  useEffect(() => { fetchNotes() }, [pathname, fetchNotes])
  useEffect(() => {
    window.addEventListener('dotstell:notes-updated', fetchNotes)
    return () => window.removeEventListener('dotstell:notes-updated', fetchNotes)
  }, [fetchNotes])

  useEffect(() => {
    if (newNotebookMode) setTimeout(() => newNbRef.current?.focus(), 40)
  }, [newNotebookMode])

  useEffect(() => {
    if (!contextMenu) return
    function h(e: MouseEvent) {
      const menu = document.querySelector('[data-ctx-note-menu]')
      if (menu && menu.contains(e.target as Node)) return
      setContextMenu(null)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [contextMenu])

  // ── Derived ──────────────────────────────────────────────────
  const filteredNotes = search.trim()
    ? notes.filter(n => (n.title || 'Untitled').toLowerCase().includes(search.toLowerCase()))
    : notes

  const notebookNotesMap: Record<string, Note[]> = {}
  for (const nb of notebooks) {
    const tag = notebookTag(nb.name)
    notebookNotesMap[nb.id] = filteredNotes.filter(n => n.tags?.includes(tag))
  }
  const notebookIds       = new Set(notebooks.flatMap(nb => notebookNotesMap[nb.id]?.map(n => n.id) ?? []))
  const unnotebookedNotes = filteredNotes
    .filter(n => !notebookIds.has(n.id))
    .sort((a, b) => (pinnedIds.has(b.id) ? 1 : 0) - (pinnedIds.has(a.id) ? 1 : 0))

  const tagMap = new Map<string, Note[]>()
  for (const note of filteredNotes) {
    for (const tag of (note.tags ?? [])) {
      if (tag.startsWith(NOTEBOOK_TAG_PREFIX)) continue
      if (!tagMap.has(tag)) tagMap.set(tag, [])
      tagMap.get(tag)!.push(note)
    }
  }
  const sortedTags = [...tagMap.entries()].sort((a, b) => b[1].length - a[1].length)

  // ── Handlers ─────────────────────────────────────────────────
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

  function handleNewNotebook() {
    const name = newNotebookName.trim()
    if (name) createNotebook(name)
    setNewNotebookName(''); setNewNotebookMode(false)
  }

  function onContextMenu(e: React.MouseEvent, id: string, type: 'notebook' | 'note') {
    e.preventDefault(); e.stopPropagation()
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

  function handleNbDragStart(id: string) { setDragNbId(id) }
  function handleNbDragOver(e: React.DragEvent, id: string) { e.preventDefault(); setDragOverId(id) }
  function handleNbDrop(targetId: string) {
    if (!dragNbId || dragNbId === targetId) { setDragNbId(null); setDragOverId(null); return }
    reorderNotebook(dragNbId, targetId)
    setDragNbId(null); setDragOverId(null)
  }

  // ── Sub-components ───────────────────────────────────────────

  function NoteItem({ note, indent = 0 }: { note: Note; indent?: number }) {
    const isActive = note.id === activeNoteId
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
          // Left accent bar for active — like VS Code explorer
          borderLeft: isActive ? '2px solid var(--primary)' : '2px solid transparent',
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
        <span style={{
          fontSize: FONT_MD, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {note.title || 'Untitled'}
        </span>
        {pinnedIds.has(note.id) && (
          <Pin size={10} style={{ flexShrink: 0, opacity: 0.5, color: 'var(--primary)' }} />
        )}
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
          <span style={{
            fontSize: FONT_SM, fontWeight: 600,
            color: 'var(--sidebar-section-fg)',
            textTransform: 'uppercase', letterSpacing: '0.09em',
            flex: 1,
          }}>
            {label}
          </span>
          {count !== undefined && count > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              color: 'var(--sidebar-muted)',
              backgroundColor: 'var(--muted)',
              padding: '1px 6px', borderRadius: 99,
            }}>
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
              color: 'var(--sidebar-muted)',
              transition: 'background 0.12s, color 0.12s',
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

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{
      width, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      backgroundColor: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--sidebar-border)',
      height: '100%', overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        height: 48, paddingLeft: 14, paddingRight: 10,
        borderBottom: '1px solid var(--sidebar-border)',
        flexShrink: 0,
      }}>
        <StickyNote size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', flex: 1 }}>
          Notes
        </span>
        <button
          type="button"
          title="New note"
          onClick={() => createNote()}
          style={{
            width: 28, height: 28, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'var(--primary)', color: 'white',
            border: 'none', borderRadius: 8, cursor: 'pointer',
            transition: 'opacity 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <Plus size={15} />
        </button>
      </div>

      {/* ── Search ── */}
      <div style={{ padding: '8px 10px', flexShrink: 0 }}>
        <div style={{ position: 'relative' }}>
          <Search size={13} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--sidebar-muted)', pointerEvents: 'none',
          }} />
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
              style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--sidebar-muted)', display: 'flex', alignItems: 'center',
                padding: 2, borderRadius: 4,
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── Tree ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 16px' }}>

        {/* All Notes */}
        <SectionHeader
          label="All notes" sKey="all"
          count={filteredNotes.length}
          icon={FileText}
          onAdd={() => createNote()}
        />
        {sectionOpen.all && (
          <div style={{ marginTop: 2 }}>
            {loading ? (
              <div style={{ padding: '6px 12px', fontSize: FONT_SM, color: 'var(--sidebar-muted)' }}>Loading…</div>
            ) : unnotebookedNotes.length === 0 && notebooks.length === 0 ? (
              <div style={{ padding: '6px 12px', fontSize: FONT_SM, color: 'var(--sidebar-muted)' }}>
                {search ? 'No matches' : 'No notes yet'}
              </div>
            ) : (
              unnotebookedNotes.map(n => <NoteItem key={n.id} note={n} />)
            )}
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: 'var(--sidebar-border)', margin: '8px 4px' }} />

        {/* Notebooks */}
        <SectionHeader
          label="Notebooks" sKey="notebooks"
          count={notebooks.length}
          icon={BookOpen}
          onAdd={() => setNewNotebookMode(true)}
        />
        {sectionOpen.notebooks && (
          <div style={{ marginTop: 2 }}>
            {newNotebookMode && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                height: ROW_H, paddingLeft: 10, paddingRight: 8,
              }}>
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
                  style={{
                    flex: 1, background: 'var(--sidebar-search-bg)',
                    border: '1px solid var(--primary)',
                    borderRadius: 6, padding: '4px 8px', fontSize: FONT_MD,
                    color: 'var(--foreground)', outline: 'none',
                  }}
                />
              </div>
            )}

            {notebooks.length === 0 && !newNotebookMode && (
              <button
                type="button"
                onClick={() => setNewNotebookMode(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', height: ROW_H, paddingLeft: 10,
                  border: '1px dashed var(--sidebar-border)', borderRadius: 8,
                  background: 'none', color: 'var(--sidebar-muted)', fontSize: FONT_SM,
                  cursor: 'pointer', marginTop: 2, boxSizing: 'border-box',
                }}
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
                    onDragEnd={() => { setDragNbId(null); setDragOverId(null) }}
                    onMouseEnter={() => setHoveredNb(nb.id)}
                    onMouseLeave={() => setHoveredNb(null)}
                    style={{
                      display: 'flex', alignItems: 'center',
                      opacity: dragNbId === nb.id ? 0.4 : 1,
                      borderTop: dragOverId === nb.id && dragNbId !== nb.id ? '2px solid var(--primary)' : '2px solid transparent',
                      transition: 'opacity 0.15s',
                      cursor: 'grab',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSection(`nb-${nb.id}`)}
                      onContextMenu={e => onContextMenu(e, nb.id, 'notebook')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        flex: 1, height: ROW_H, paddingLeft: 10, paddingRight: 4,
                        background: 'none', border: 'none', cursor: 'pointer',
                        borderRadius: 8, textAlign: 'left',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--sidebar-hover-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      {isOpen
                        ? <ChevronDown size={12} style={{ color: 'var(--sidebar-muted)', flexShrink: 0 }} />
                        : <ChevronRight size={12} style={{ color: 'var(--sidebar-muted)', flexShrink: 0 }} />}
                      <span style={{ fontSize: 15, flexShrink: 0 }}>{nb.icon ?? '📓'}</span>
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
                          style={{
                            flex: 1, background: 'var(--sidebar-search-bg)',
                            border: '1px solid var(--primary)',
                            borderRadius: 5, padding: '2px 6px', fontSize: FONT_MD,
                            color: 'var(--foreground)', outline: 'none',
                          }}
                        />
                      ) : (
                        <span style={{
                          fontSize: FONT_MD, color: 'var(--foreground)', fontWeight: 500,
                          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {nb.name}
                        </span>
                      )}
                      <span style={{
                        fontSize: 10, fontWeight: 700,
                        color: 'var(--sidebar-muted)', backgroundColor: 'var(--muted)',
                        padding: '1px 6px', borderRadius: 99, flexShrink: 0,
                      }}>
                        {nbNotes.length}
                      </span>
                    </button>

                    {/* New note in notebook — show on row hover */}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); createNote(nb.name) }}
                      title="New note in notebook"
                      style={{
                        width: 28, height: 28, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'none', border: 'none', borderRadius: 6, cursor: 'pointer',
                        color: 'var(--primary)',
                        opacity: hoveredNb === nb.id ? 1 : 0,
                        transition: 'opacity 0.15s, background 0.12s',
                      }}
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
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            width: '100%', height: ROW_H,
                            paddingLeft: 28, paddingRight: 8,
                            border: 'none', borderRadius: 7,
                            background: 'none', color: 'var(--sidebar-muted)',
                            fontSize: FONT_SM, cursor: 'pointer', boxSizing: 'border-box',
                          }}
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

        {/* Tags — only if any exist */}
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
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          width: '100%', height: ROW_H,
                          paddingLeft: 10, paddingRight: 8,
                          background: 'none', border: 'none', cursor: 'pointer',
                          borderRadius: 8, textAlign: 'left', boxSizing: 'border-box',
                          color: 'var(--sidebar-muted)',
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--sidebar-hover-bg)'; e.currentTarget.style.color = 'var(--sidebar-hover-fg)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--sidebar-muted)' }}
                      >
                        {isOpen
                          ? <ChevronDown size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
                          : <ChevronRight size={12} style={{ flexShrink: 0, opacity: 0.6 }} />}
                        <Tag size={13} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <span style={{
                          fontSize: FONT_MD, flex: 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          color: 'var(--foreground)',
                        }}>
                          {tag}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          color: 'var(--sidebar-muted)', backgroundColor: 'var(--muted)',
                          padding: '1px 6px', borderRadius: 99,
                        }}>
                          {tagNotes.length}
                        </span>
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

      {/* ── Context menu ── */}
      {contextMenu && (
        <div
          data-ctx-note-menu
          style={{
            position: 'fixed', zIndex: 9999,
            top: contextMenu.y, left: contextMenu.x,
            backgroundColor: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 10, padding: 4, minWidth: 150,
            boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
          }}
        >
          {contextMenu.type === 'notebook' && (
            <>
              <CtxItem icon={Pencil} label="Rename" onClick={() => {
                const nb = notebooks.find(n => n.id === contextMenu.id)
                if (nb) setRenameTarget({ id: nb.id, value: nb.name, type: 'notebook' })
                setContextMenu(null)
              }} />
              <CtxItem icon={Trash2} label="Delete notebook" danger onClick={() => {
                deleteNotebook(contextMenu.id); setContextMenu(null)
              }} />
            </>
          )}
          {contextMenu.type === 'note' && (
            <>
              <CtxItem
                icon={pinnedIds.has(contextMenu.id) ? PinOff : Pin}
                label={pinnedIds.has(contextMenu.id) ? 'Unpin note' : 'Pin note'}
                onClick={() => { togglePin(contextMenu.id); setContextMenu(null) }}
              />
              <CtxItem icon={Trash2} label="Delete note" danger onClick={async () => {
                await fetch(`/api/notes/${contextMenu.id}`, { method: 'DELETE' })
                setNotes(prev => prev.filter(n => n.id !== contextMenu.id))
                setContextMenu(null)
              }} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

function CtxItem({ icon: Icon, label, onClick, danger = false }: {
  icon: React.ElementType; label: string; onClick: () => void; danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 9,
        width: '100%', padding: '8px 12px', borderRadius: 7,
        border: 'none', background: 'transparent', cursor: 'pointer',
        color: danger ? 'var(--destructive)' : 'var(--foreground)',
        fontSize: 13, textAlign: 'left',
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.1)' : 'var(--accent)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}
