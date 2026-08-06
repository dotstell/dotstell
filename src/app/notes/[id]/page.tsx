'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, X, Maximize2, Minimize2, Layout, Plus, FileText, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Note } from '@/types'
import { AppLayout } from '@/components/layout/AppLayout'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { NoteTemplates, NOTE_TEMPLATES } from '@/components/editor/NoteTemplates'
import { LinkPanel } from '@/components/links/LinkPanel'
import { BacklinksPanel } from '@/components/notes/BacklinksPanel'
import '@/components/editor/editor.css'

type SaveStatus = 'saved' | 'saving' | 'unsaved' | null

export default function NoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const isNew = id === 'new'

  const [note, setNote]           = useState<Partial<Note>>({ title: '', content: '<p></p>', type: 'markdown', tags: [] })
  const [loading, setLoading]     = useState(!isNew)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null)
  const [tagInput, setTagInput]   = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const [showTemplates, setShowTemplates] = useState(isNew)
  const [noteId, setNoteId]       = useState<string | null>(isNew ? null : id)
  const [subNotes, setSubNotes]   = useState<Note[]>([])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wikiLinkIds = useRef<string[]>([])

  // Load existing note + sub-notes
  useEffect(() => {
    if (isNew) return
    Promise.all([
      fetch(`/api/notes/${id}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/notes?parent_id=${id}`).then(r => r.ok ? r.json() : []),
    ]).then(([data, subs]) => {
      if (data) {
        setNote({ ...data, content: data.content || '<p></p>' })
        setShowTemplates(false)
      }
      setSubNotes(Array.isArray(subs) ? subs : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id, isNew])

  async function createSubNote() {
    if (!noteId) return
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '', content: '<p></p>', type: 'markdown', tags: [], parent_id: noteId }),
    })
    if (res.ok) {
      const sub = await res.json()
      router.push(`/notes/${sub.id}`)
    }
  }

  // Auto-save — debounced 1.5s after last change
  const syncWikiLinks = useCallback(async (sourceNoteId: string) => {
    await fetch('/api/wikilinks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceNoteId, targetNoteIds: wikiLinkIds.current }),
    })
  }, [])

  const save = useCallback(async (data: Partial<Note>, currentId: string | null) => {
    setSaveStatus('saving')
    try {
      if (currentId) {
        const res = await fetch(`/api/notes/${currentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (res.ok) {
          setSaveStatus('saved')
          syncWikiLinks(currentId)
        } else setSaveStatus('unsaved')
      } else {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, type: 'markdown' }),
        })
        if (res.ok) {
          const saved = await res.json()
          setNoteId(saved.id)
          setSaveStatus('saved')
          window.history.replaceState({}, '', `/notes/${saved.id}`)
          syncWikiLinks(saved.id)
        } else setSaveStatus('unsaved')
      }
    } catch {
      setSaveStatus('unsaved')
    }
  }, [syncWikiLinks])

  function scheduleAutoSave(updates: Partial<Note>) {
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      save(updates, noteId)
    }, 1500)
  }

  function handleContentChange(html: string) {
    const updated = { ...note, content: html }
    setNote(updated)
    scheduleAutoSave(updated)
  }

  function handleTitleChange(title: string) {
    const updated = { ...note, title }
    setNote(updated)
    scheduleAutoSave(updated)
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase()
    if (!tag || note.tags?.includes(tag)) return
    const updated = { ...note, tags: [...(note.tags ?? []), tag] }
    setNote(updated)
    scheduleAutoSave(updated)
    setTagInput('')
  }

  function removeTag(tag: string) {
    const updated = { ...note, tags: note.tags?.filter(t => t !== tag) ?? [] }
    setNote(updated)
    scheduleAutoSave(updated)
  }

  if (loading) {
    return (
      <AppLayout>
        <div style={{ padding: 32, color: 'var(--muted-foreground)', fontSize: 13 }}>Loading...</div>
      </AppLayout>
    )
  }

  const editorContent = (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 20px', borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--background)', flexShrink: 0,
      }}>
        {!focusMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <Link href="/notes" style={{ color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 13 }}>
              <ArrowLeft size={14} /> Notes
            </Link>
            {note.parent_id && (
              <>
                <ChevronRight size={12} color="var(--border)" />
                <Link href={`/notes/${note.parent_id}`} style={{ color: 'var(--muted-foreground)', textDecoration: 'none', fontSize: 13 }}>
                  Parent
                </Link>
              </>
            )}
          </div>
        )}

        {/* Title */}
        <input
          value={note.title ?? ''}
          onChange={e => handleTitleChange(e.target.value)}
          placeholder="Untitled note..."
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            fontSize: 16, fontWeight: 600, color: 'var(--foreground)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        />

        {/* Tags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {note.tags?.map(tag => (
            <span key={tag} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, color: 'var(--primary)', backgroundColor: 'var(--primary)22',
              padding: '2px 8px', borderRadius: 99, cursor: 'pointer',
            }} onClick={() => removeTag(tag)}>
              {tag} <X size={9} />
            </span>
          ))}
          <input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTag()}
            placeholder="+ tag"
            style={{
              background: 'none', border: 'none', outline: 'none',
              fontSize: 12, color: 'var(--muted-foreground)', width: 60,
            }}
          />
        </div>

        {/* Focus mode toggle */}
        <button type="button" onClick={() => setFocusMode(f => !f)} style={{
          background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 4, borderRadius: 6, flexShrink: 0,
        }}
          title={focusMode ? 'Exit focus mode' : 'Focus mode (F11)'}
        >
          {focusMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>

      {/* Body: editor + sidebar */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Template panel (new notes only) */}
        {showTemplates && isNew && (
          <div style={{
            width: 180, flexShrink: 0, borderRight: '1px solid var(--border)',
            padding: 14, overflowY: 'auto', backgroundColor: 'var(--card)',
          }}>
            <NoteTemplates onSelect={tmpl => {
              setNote(prev => ({ ...prev, title: tmpl.title, content: tmpl.content }))
              setShowTemplates(false)
            }} />
          </div>
        )}

        {/* Editor */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <RichTextEditor
            content={note.content ?? '<p></p>'}
            onChange={handleContentChange}
            placeholder="Start writing... (type / for commands, [[ to link a note)"
            autoSaveStatus={saveStatus}
            focusMode={focusMode}
            onFocusMode={setFocusMode}
            onWikiLinksChange={ids => { wikiLinkIds.current = ids }}
          />
        </div>

        {/* Right panel: links + sub-notes + backlinks (only when saved) */}
        {!focusMode && noteId && (
          <div style={{
            width: 240, flexShrink: 0, borderLeft: '1px solid var(--border)',
            padding: 16, overflowY: 'auto', backgroundColor: 'var(--card)',
            display: 'flex', flexDirection: 'column', gap: 20,
          }}>
            <LinkPanel sourceId={noteId} sourceType="note" />

            {/* Sub-notes */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Sub-notes</span>
                <button type="button" onClick={createSubNote} title="New sub-note" style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 2, borderRadius: 5,
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
                >
                  <Plus size={14} />
                </button>
              </div>
              {subNotes.length === 0 ? (
                <button type="button" onClick={createSubNote} style={{
                  width: '100%', padding: '8px 10px', borderRadius: 8,
                  border: '1px dashed var(--border)', background: 'none',
                  color: 'var(--border)', fontSize: 12, cursor: 'pointer', textAlign: 'center',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)44')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  + Add sub-note
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {subNotes.map(sub => (
                    <button key={sub.id} type="button" onClick={() => router.push(`/notes/${sub.id}`)} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 8px', borderRadius: 7, border: 'none',
                      background: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <FileText size={12} color="var(--primary)" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--secondary-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {sub.title || 'Untitled'}
                      </span>
                      <ChevronRight size={11} color="var(--border)" style={{ flexShrink: 0 }} />
                    </button>
                  ))}
                  <button type="button" onClick={createSubNote} style={{
                    marginTop: 2, padding: '5px 8px', borderRadius: 7, border: '1px dashed var(--border)',
                    background: 'none', color: 'var(--border)', fontSize: 11, cursor: 'pointer', textAlign: 'left',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)44')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    + Add sub-note
                  </button>
                </div>
              )}
            </div>

            {/* Backlinks */}
            <BacklinksPanel noteId={noteId} />

            {/* Show templates button */}
            {isNew && !showTemplates && (
              <button type="button" onClick={() => setShowTemplates(true)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'none', border: '1px solid var(--border)', borderRadius: 8,
                padding: '7px 10px', color: 'var(--muted-foreground)', fontSize: 12, cursor: 'pointer', width: '100%',
              }}>
                <Layout size={13} /> Change template
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )

  if (focusMode) {
    return (
      <div style={{
        position: 'fixed', inset: 0, backgroundColor: 'var(--background)',
        zIndex: 100, display: 'flex', flexDirection: 'column',
      }}>
        {editorContent}
      </div>
    )
  }

  return (
    <AppLayout>
      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'var(--background)',
        marginTop: 0,
      }}>
        {editorContent}
      </div>
    </AppLayout>
  )
}
