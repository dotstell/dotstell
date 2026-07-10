'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Tag, X, Maximize2, Minimize2, Layout } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Note } from '@/types'
import { AppLayout } from '@/components/layout/AppLayout'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { NoteTemplates, NOTE_TEMPLATES } from '@/components/editor/NoteTemplates'
import { LinkPanel } from '@/components/links/LinkPanel'
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
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load existing note
  useEffect(() => {
    if (isNew) return
    fetch(`/api/notes/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setNote({ ...data, content: data.content || '<p></p>' })
          setShowTemplates(false)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id, isNew])

  // Auto-save — debounced 1.5s after last change
  const save = useCallback(async (data: Partial<Note>, currentId: string | null) => {
    setSaveStatus('saving')
    try {
      if (currentId) {
        const res = await fetch(`/api/notes/${currentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (res.ok) setSaveStatus('saved')
        else setSaveStatus('unsaved')
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
          // Update URL without navigation
          window.history.replaceState({}, '', `/notes/${saved.id}`)
        } else setSaveStatus('unsaved')
      }
    } catch {
      setSaveStatus('unsaved')
    }
  }, [])

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
        <div style={{ padding: 32, color: '#6b6b88', fontSize: 13 }}>Loading...</div>
      </AppLayout>
    )
  }

  const editorContent = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>

      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 20px', borderBottom: '1px solid #2a2a3e',
        backgroundColor: '#0a0a0f', flexShrink: 0,
      }}>
        {!focusMode && (
          <Link href="/notes" style={{ color: '#6b6b88', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: 13, flexShrink: 0 }}>
            <ArrowLeft size={14} /> Notes
          </Link>
        )}

        {/* Title */}
        <input
          value={note.title ?? ''}
          onChange={e => handleTitleChange(e.target.value)}
          placeholder="Untitled note..."
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            fontSize: 16, fontWeight: 600, color: '#e8e8f0',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        />

        {/* Tags */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {note.tags?.map(tag => (
            <span key={tag} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, color: '#7c6aff', backgroundColor: '#7c6aff22',
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
              fontSize: 12, color: '#6b6b88', width: 60,
            }}
          />
        </div>

        {/* Focus mode toggle */}
        <button type="button" onClick={() => setFocusMode(f => !f)} style={{
          background: 'none', border: 'none', color: '#6b6b88', cursor: 'pointer', padding: 4, borderRadius: 6, flexShrink: 0,
        }}
          title={focusMode ? 'Exit focus mode' : 'Focus mode (F11)'}
        >
          {focusMode ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </div>

      {/* Body: editor + sidebar */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* Template panel (new notes only) */}
        {showTemplates && isNew && (
          <div style={{
            width: 180, flexShrink: 0, borderRight: '1px solid #2a2a3e',
            padding: 14, overflowY: 'auto', backgroundColor: '#0e0e16',
          }}>
            <NoteTemplates onSelect={tmpl => {
              setNote(prev => ({ ...prev, title: tmpl.title, content: tmpl.content }))
              setShowTemplates(false)
            }} />
          </div>
        )}

        {/* Editor */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <RichTextEditor
            content={note.content ?? '<p></p>'}
            onChange={handleContentChange}
            placeholder="Start writing... (type / for commands)"
            autoSaveStatus={saveStatus}
            focusMode={focusMode}
            onFocusMode={setFocusMode}
          />
        </div>

        {/* Right panel: links (only when saved) */}
        {!focusMode && noteId && (
          <div style={{
            width: 240, flexShrink: 0, borderLeft: '1px solid #2a2a3e',
            padding: 16, overflowY: 'auto', backgroundColor: '#0e0e16',
          }}>
            <LinkPanel sourceId={noteId} sourceType="note" />

            {/* Show templates button */}
            {isNew && !showTemplates && (
              <button type="button" onClick={() => setShowTemplates(true)} style={{
                display: 'flex', alignItems: 'center', gap: 6, marginTop: 16,
                background: 'none', border: '1px solid #2a2a3e', borderRadius: 8,
                padding: '7px 10px', color: '#6b6b88', fontSize: 12, cursor: 'pointer', width: '100%',
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
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#0a0a0f', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
        {editorContent}
      </div>
    )
  }

  return (
    <AppLayout>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {editorContent}
      </div>
    </AppLayout>
  )
}
