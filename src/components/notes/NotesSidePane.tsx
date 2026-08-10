'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Plus, Search, ChevronDown, ChevronRight, FileText, Tag,
  Pencil, Trash2, BookOpen, StickyNote,
  FolderPlus, X,
} from 'lucide-react'
import { Note } from '@/types'
import { useNotebooks, notebookTag, NOTEBOOK_TAG_PREFIX } from '@/hooks/useNotebooks'

interface Props {
  width?: number
  activeNoteId?: string
}

export function NotesSidePane({ width = 220, activeNoteId }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  // Data
  const [notes,   setNotes]   = useState<Note[]>([])
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)
  const { notebooks, createNotebook, deleteNotebook, renameNotebook } = useNotebooks()

  // UI state
  const [sectionOpen, setSectionOpen] = useState<Record<string, boolean>>({
    all: true, notebooks: true, tags: false,
  })
  const [newNotebookMode, setNewNotebookMode]   = useState(false)
  const [newNotebookName, setNewNotebookName]   = useState('')
  const [contextMenu, setContextMenu]           = useState<{ x: number; y: number; id: string; type: 'notebook' | 'note' } | null>(null)
  const [renameTarget, setRenameTarget]         = useState<{ id: string; value: string; type: 'notebook' | 'note' } | null>(null)
  const [hoveredNb, setHoveredNb]               = useState<string | null>(null)
  const newNbRef = useRef<HTMLInputElement>(null)

  const fetchNotes = useCallback(async () => {
    const res = await fetch('/api/notes?root_only=true')
    if (res.ok) {
      const data = await res.json()
      setNotes(Array.isArray(data) ? data : [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  // Re-fetch when route changes (note saved)
  useEffect(() => { fetchNotes() }, [pathname, fetchNotes])

  // Focus new notebook input
  useEffect(() => {
    if (newNotebookMode) setTimeout(() => newNbRef.current?.focus(), 40)
  }, [newNotebookMode])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    function h() { setContextMenu(null) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [contextMenu])

  // ----- Derived data -----
  const filteredNotes = search.trim()
    ? notes.filter(n => (n.title || 'Untitled').toLowerCase().includes(search.toLowerCase()))
    : notes

  // Build notebook → notes map from tag prefix
  const notebookNotesMap: Record<string, Note[]> = {}
  for (const nb of notebooks) {
    const tag = notebookTag(nb.name)
    notebookNotesMap[nb.id] = filteredNotes.filter(n => n.tags?.includes(tag))
  }
  const notebookIds = new Set(notebooks.flatMap(nb => notebookNotesMap[nb.id]?.map(n => n.id) ?? []))
  const unnotebookedNotes = filteredNotes.filter(n => !notebookIds.has(n.id))

  // Build tag → notes map (excluding nb: tags)
  const tagMap = new Map<string, Note[]>()
  for (const note of filteredNotes) {
    for (const tag of (note.tags ?? [])) {
      if (tag.startsWith(NOTEBOOK_TAG_PREFIX)) continue
      if (!tagMap.has(tag)) tagMap.set(tag, [])
      tagMap.get(tag)!.push(note)
    }
  }
  const sortedTags = [...tagMap.entries()].sort((a, b) => b[1].length - a[1].length)

  // ----- Handlers -----
  function openNote(id: string) {
    router.push(`/notes/${id}`)
  }

  function createNote(notebookName?: string) {
    if (notebookName) {
      sessionStorage.setItem('dotstell:new-note-notebook', notebookName)
    }
    router.push('/notes/new')
  }

  function toggleSection(key: string) {
    setSectionOpen(p => ({ ...p, [key]: !p[key] }))
  }

  function handleNewNotebook() {
    const name = newNotebookName.trim()
    if (name) createNotebook(name)
    setNewNotebookName('')
    setNewNotebookMode(false)
  }

  function onContextMenu(e: React.MouseEvent, id: string, type: 'notebook' | 'note') {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, id, type })
  }

  // ----- Render helpers -----
  function NoteItem({ note }: { note: Note }) {
    const isActive = note.id === activeNoteId
    return (
      <button
        key={note.id}
        type="button"
        onClick={() => openNote(note.id)}
        onContextMenu={e => onContextMenu(e, note.id, 'note')}
        title={note.title || 'Untitled'}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', padding: '6px 10px', borderRadius: 7,
          border: 'none', cursor: 'pointer', textAlign: 'left',
          background: isActive
            ? 'color-mix(in srgb, var(--primary) 14%, transparent)'
            : 'transparent',
          borderLeft: isActive ? '2px solid var(--primary)' : '2px solid transparent',
          transition: 'background 0.12s',
        }}
        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--accent)' }}
        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <FileText
          size={13}
          style={{ color: isActive ? 'var(--primary)' : 'var(--muted-foreground)', flexShrink: 0 }}
        />
        <span style={{
          fontSize: 13,
          color: isActive ? 'var(--primary)' : 'var(--foreground)',
          fontWeight: isActive ? 600 : 400,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
        }}>
          {note.title || 'Untitled'}
        </span>
      </button>
    )
  }

  function SectionHeader({ label, sKey, count, icon: Icon, onAdd }: {
    label: string; sKey: string; count?: number; icon?: React.ElementType; onAdd?: () => void
  }) {
    const open = sectionOpen[sKey] ?? true
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 4px 3px', userSelect: 'none' }}>
        <button type="button" onClick={() => toggleSection(sKey)} style={{
          display: 'flex', alignItems: 'center', gap: 6, flex: 1,
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '3px 6px', borderRadius: 6, textAlign: 'left',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          {open
            ? <ChevronDown size={13} color="var(--muted-foreground)" />
            : <ChevronRight size={13} color="var(--muted-foreground)" />}
          {Icon && <Icon size={13} color="var(--muted-foreground)" />}
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {label}
          </span>
          {count !== undefined && (
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)', backgroundColor: 'var(--secondary)', padding: '1px 6px', borderRadius: 99, fontWeight: 700 }}>
              {count}
            </span>
          )}
        </button>
        {onAdd && (
          <button type="button" onClick={onAdd} title="Add" style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted-foreground)', padding: '3px 5px', borderRadius: 5,
            display: 'flex', alignItems: 'center',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--primary)'; (e.currentTarget as HTMLElement).style.background = 'var(--accent)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)'; (e.currentTarget as HTMLElement).style.background = 'none' }}
          >
            <Plus size={13} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{
      width,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      borderRight: '1px solid var(--border)',
      backgroundColor: 'var(--card)',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 12px 10px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <StickyNote size={16} color="var(--primary)" />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', flex: 1 }}>Notes</span>
        <button
          type="button"
          title="New note"
          onClick={() => createNote()}
          style={{
            background: 'var(--primary)', border: 'none', borderRadius: 7,
            width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
            transition: 'opacity 0.12s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <Plus size={14} color="white" />
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 10px', position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search notes…"
          style={{
            width: '100%', background: 'var(--secondary)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '7px 10px 7px 30px', fontSize: 13,
            color: 'var(--foreground)', outline: 'none', boxSizing: 'border-box',
          }}
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} style={{
            position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)',
            display: 'flex', alignItems: 'center',
          }}>
            <X size={12} />
          </button>
        )}
      </div>

      {/* Scrollable tree */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 12px' }}>

        {/* ── All Notes ── */}
        <SectionHeader
          label="All notes"
          sKey="all"
          count={filteredNotes.length}
          icon={FileText}
          onAdd={() => createNote()}
        />
        {sectionOpen.all && (
          <div style={{ marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 1 }}>
            {loading ? (
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', padding: '4px 8px' }}>Loading…</span>
            ) : unnotebookedNotes.length === 0 && notebooks.length === 0 ? (
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', padding: '4px 8px' }}>
                {search ? 'No matches' : 'No notes yet'}
              </span>
            ) : (
              unnotebookedNotes.map(note => <NoteItem key={note.id} note={note} />)
            )}
          </div>
        )}

        <div style={{ height: 8 }} />

        {/* ── Notebooks ── */}
        <SectionHeader
          label="Notebooks"
          sKey="notebooks"
          count={notebooks.length}
          icon={BookOpen}
          onAdd={() => setNewNotebookMode(true)}
        />
        {sectionOpen.notebooks && (
          <div style={{ marginLeft: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>

            {/* New notebook input */}
            {newNotebookMode && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 4px' }}>
                <FolderPlus size={12} color="var(--primary)" />
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
                    flex: 1, background: 'var(--secondary)', border: '1px solid var(--primary)44',
                    borderRadius: 5, padding: '3px 6px', fontSize: 12,
                    color: 'var(--foreground)', outline: 'none',
                  }}
                />
              </div>
            )}

            {notebooks.length === 0 && !newNotebookMode && (
              <button type="button" onClick={() => setNewNotebookMode(true)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 8px', borderRadius: 6, border: '1px dashed var(--border)',
                background: 'none', color: 'var(--muted-foreground)', fontSize: 12,
                cursor: 'pointer', width: '100%', marginTop: 2,
              }}>
                <FolderPlus size={12} /> Create a notebook
              </button>
            )}

            {notebooks.map(nb => {
              const nbNotes = notebookNotesMap[nb.id] ?? []
              const isOpen  = sectionOpen[`nb-${nb.id}`] ?? true

              return (
                <div key={nb.id}>
                  <div
                    style={{ display: 'flex', alignItems: 'center' }}
                    onMouseEnter={() => setHoveredNb(nb.id)}
                    onMouseLeave={() => setHoveredNb(null)}
                  >
                    <button type="button" onClick={() => toggleSection(`nb-${nb.id}`)} style={{
                      display: 'flex', alignItems: 'center', gap: 5, flex: 1,
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '4px 6px', borderRadius: 6, textAlign: 'left',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      onContextMenu={e => onContextMenu(e, nb.id, 'notebook')}
                    >
                      {isOpen
                        ? <ChevronDown size={13} color="var(--muted-foreground)" />
                        : <ChevronRight size={13} color="var(--muted-foreground)" />}
                      <span style={{ fontSize: 15 }}>{nb.icon ?? '📓'}</span>
                      {renameTarget?.id === nb.id && renameTarget.type === 'notebook' ? (
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
                            flex: 1, background: 'var(--secondary)', border: '1px solid var(--primary)44',
                            borderRadius: 4, padding: '1px 5px', fontSize: 12,
                            color: 'var(--foreground)', outline: 'none',
                          }}
                        />
                      ) : (
                        <span style={{
                          fontSize: 13, color: 'var(--foreground)', flex: 1,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {nb.name}
                        </span>
                      )}
                      <span style={{
                        fontSize: 10, color: 'var(--muted-foreground)',
                        backgroundColor: 'var(--secondary)', padding: '0 5px',
                        borderRadius: 99, fontWeight: 600,
                      }}>
                        {nbNotes.length}
                      </span>
                    </button>
                    <button type="button" onClick={e => { e.stopPropagation(); createNote(nb.name) }} title="New note in this notebook" style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--primary)', padding: '2px 4px', borderRadius: 4,
                      display: 'flex', alignItems: 'center',
                      opacity: hoveredNb === nb.id ? 1 : 0,
                      transition: 'opacity 0.15s',
                    }}>
                      <Plus size={11} />
                    </button>
                  </div>

                  {isOpen && (
                    <div style={{ marginLeft: 16, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {nbNotes.length === 0 ? (
                        <button type="button" onClick={() => createNote(nb.name)} style={{
                          padding: '4px 8px', borderRadius: 5, border: '1px dashed var(--border)',
                          background: 'none', color: 'var(--muted-foreground)', fontSize: 11,
                          cursor: 'pointer', textAlign: 'left', marginTop: 2,
                        }}>
                          + Add note
                        </button>
                      ) : (
                        nbNotes.map(note => <NoteItem key={note.id} note={note} />)
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div style={{ height: 8 }} />

        {/* ── Tags ── */}
        {sortedTags.length > 0 && (
          <>
            <SectionHeader label="Tags" sKey="tags" count={sortedTags.length} icon={Tag} />
            {sectionOpen.tags && (
              <div style={{ marginLeft: 8, display: 'flex', flexDirection: 'column', gap: 1 }}>
                {sortedTags.map(([tag, tagNotes]) => {
                  const isOpen = sectionOpen[`tag-${tag}`] ?? false
                  return (
                    <div key={tag}>
                      <button type="button" onClick={() => toggleSection(`tag-${tag}`)} style={{
                        display: 'flex', alignItems: 'center', gap: 5, width: '100%',
                        background: 'none', border: 'none', cursor: 'pointer',
                        padding: '4px 6px', borderRadius: 6, textAlign: 'left',
                      }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        {isOpen
                          ? <ChevronDown size={11} color="var(--primary)" />
                          : <ChevronRight size={11} color="var(--muted-foreground)" />}
                        <Tag size={10} color="var(--primary)" />
                        <span style={{ fontSize: 12, color: 'var(--primary)', flex: 1, textAlign: 'left' }}>{tag}</span>
                        <span style={{
                          fontSize: 10, color: 'var(--muted-foreground)',
                          backgroundColor: 'var(--secondary)', padding: '0 5px',
                          borderRadius: 99, fontWeight: 600,
                        }}>
                          {tagNotes.length}
                        </span>
                      </button>
                      {isOpen && (
                        <div style={{ marginLeft: 16, display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {tagNotes.map(note => <NoteItem key={note.id} note={note} />)}
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
          style={{
            position: 'fixed', zIndex: 9999,
            top: contextMenu.y, left: contextMenu.x,
            backgroundColor: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 10, padding: 4, minWidth: 140,
            boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
          }}
          onMouseDown={e => e.stopPropagation()}
        >
          {contextMenu.type === 'notebook' && (
            <>
              <ContextMenuItem
                icon={Pencil} label="Rename"
                onClick={() => {
                  const nb = notebooks.find(n => n.id === contextMenu.id)
                  if (nb) setRenameTarget({ id: nb.id, value: nb.name, type: 'notebook' })
                  setContextMenu(null)
                }}
              />
              <ContextMenuItem
                icon={Trash2} label="Delete notebook" danger
                onClick={() => { deleteNotebook(contextMenu.id); setContextMenu(null) }}
              />
            </>
          )}
          {contextMenu.type === 'note' && (
            <ContextMenuItem
              icon={Trash2} label="Delete note" danger
              onClick={async () => {
                await fetch(`/api/notes/${contextMenu.id}`, { method: 'DELETE' })
                setNotes(prev => prev.filter(n => n.id !== contextMenu.id))
                setContextMenu(null)
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

function ContextMenuItem({ icon: Icon, label, onClick, danger = false }: {
  icon: React.ElementType; label: string; onClick: () => void; danger?: boolean
}) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8,
      width: '100%', padding: '7px 10px', borderRadius: 7,
      border: 'none', background: 'transparent', cursor: 'pointer',
      color: danger ? '#ef4444' : 'var(--foreground)', fontSize: 13, textAlign: 'left',
    }}
      onMouseEnter={e => (e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.1)' : 'var(--accent)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <Icon size={13} />
      {label}
    </button>
  )
}
