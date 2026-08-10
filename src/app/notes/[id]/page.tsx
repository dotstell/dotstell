'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, Maximize2, Minimize2, Plus, FileText,
  ChevronRight, ArrowLeft, LayoutTemplate, Download,
} from 'lucide-react'
import Link from 'next/link'
import { Note } from '@/types'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { NoteTemplateModal } from '@/components/editor/NoteTemplates'
import { LinkPanel } from '@/components/links/LinkPanel'
import { BacklinksPanel } from '@/components/notes/BacklinksPanel'
import { useNoteTabs } from '@/hooks/useNoteTabs'
import { notebookTag } from '@/hooks/useNotebooks'
import '@/components/editor/editor.css'

type SaveStatus = 'saved' | 'saving' | 'unsaved' | null

const SAVE_DOT: Record<NonNullable<SaveStatus>, string> = {
  saved:   '#22c55e',
  saving:  '#f59e0b',
  unsaved: '#ef4444',
}

export default function NoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router  = useRouter()
  const isNew   = id === 'new'

  const [note, setNote]               = useState<Partial<Note>>({ title: '', content: '<p></p>', type: 'markdown', tags: [] })
  const [loading, setLoading]         = useState(!isNew)
  const [saveStatus, setSaveStatus]   = useState<SaveStatus>(null)
  const [tagInput, setTagInput]       = useState('')
  const [focusMode, setFocusMode]     = useState(false)
  const [showTemplates, setShowTemplates] = useState(isNew)
  const [noteId, setNoteId]           = useState<string | null>(isNew ? null : id)
  const [subNotes, setSubNotes]       = useState<Note[]>([])
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wikiLinkIds = useRef<string[]>([])

  // Word count derived from content
  const wordCount = (() => {
    const text = (note.content ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return text ? text.split(' ').length : 0
  })()
  const readMins = Math.max(1, Math.round(wordCount / 200))

  const { openTab, updateTitle } = useNoteTabs(noteId ?? undefined)

  // Pre-populate notebook tag when coming from side pane
  useEffect(() => {
    if (!isNew) return
    const nbName = sessionStorage.getItem('dotstell:new-note-notebook')
    if (nbName) {
      sessionStorage.removeItem('dotstell:new-note-notebook')
      const tag = notebookTag(nbName)
      setNote(prev => ({ ...prev, tags: [...(prev.tags ?? []), tag] }))
    }
  }, [isNew])

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
        openTab(data.id, data.title || 'Untitled')
      }
      setSubNotes(Array.isArray(subs) ? subs : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id, isNew]) // eslint-disable-line react-hooks/exhaustive-deps

  async function createSubNote() {
    if (!noteId) return
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '', content: '<p></p>', type: 'markdown', tags: [], parent_id: noteId }),
    })
    if (res.ok) { const sub = await res.json(); router.push(`/notes/${sub.id}`) }
  }

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
          if (data.title !== undefined) updateTitle(currentId, data.title || 'Untitled')
          window.dispatchEvent(new Event('dotstell:notes-updated'))
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
          openTab(saved.id, saved.title || 'Untitled')
        } else setSaveStatus('unsaved')
      }
    } catch { setSaveStatus('unsaved') }
  }, [syncWikiLinks, openTab, updateTitle])

  // Ctrl+N → new note
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Ctrl+N works in desktop app; Alt+N is the browser-safe alternative
      const isNewNote = ((e.ctrlKey || e.metaKey) && e.key === 'n') || (e.altKey && e.key === 'n')
      if (isNewNote) {
        e.preventDefault()
        fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: '', content: '<p></p>', type: 'markdown', tags: [] }),
        }).then(r => r.ok ? r.json() : null).then(n => {
          if (n) { openTab(n.id, 'Untitled'); router.push(`/notes/${n.id}`) }
        })
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [openTab, router])

  function exportMarkdown() {
    const text = (note.content ?? '')
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .trim()
    const title = note.title || 'untitled'
    const blob  = new Blob([`# ${title}\n\n${text}`], { type: 'text/markdown' })
    const url   = URL.createObjectURL(blob)
    const a     = document.createElement('a')
    a.href = url; a.download = `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`
    a.click(); URL.revokeObjectURL(url)
  }

  function scheduleAutoSave(updates: Partial<Note>) {
    setSaveStatus('unsaved')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(updates, noteId), 1500)
  }

  function handleContentChange(html: string) {
    const updated = { ...note, content: html }
    setNote(updated); scheduleAutoSave(updated)
  }

  function handleTitleChange(title: string) {
    const updated = { ...note, title }
    setNote(updated); scheduleAutoSave(updated)
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase()
    if (!tag || note.tags?.includes(tag)) return
    const updated = { ...note, tags: [...(note.tags ?? []), tag] }
    setNote(updated); scheduleAutoSave(updated); setTagInput('')
  }

  function removeTag(tag: string) {
    const updated = { ...note, tags: note.tags?.filter(t => t !== tag) ?? [] }
    setNote(updated); scheduleAutoSave(updated)
  }

  if (loading) {
    return <div style={{ padding: 40, color: 'var(--muted-foreground)', fontSize: 14 }}>Loading…</div>
  }

  const editorContent = (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        padding: '12px 20px 0',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--background)',
        flexShrink: 0,
        gap: 8,
      }}>
        {/* Row 1: breadcrumb + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!focusMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--muted-foreground)', flexShrink: 0 }}>
              <Link href="/notes" style={{ color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                <ArrowLeft size={13} /> Notes
              </Link>
              {note.parent_id && (
                <>
                  <ChevronRight size={11} color="var(--border)" />
                  <Link href={`/notes/${note.parent_id}`} style={{ color: 'var(--muted-foreground)', textDecoration: 'none' }}>Parent</Link>
                </>
              )}
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* Save indicator */}
          {saveStatus && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--muted-foreground)', flexShrink: 0 }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                backgroundColor: SAVE_DOT[saveStatus],
                display: 'inline-block',
                boxShadow: `0 0 5px ${SAVE_DOT[saveStatus]}88`,
              }} />
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : 'Unsaved changes'}
            </div>
          )}

          {/* Export */}
          {noteId && (
            <button
              type="button"
              title="Export as Markdown"
              onClick={exportMarkdown}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 7,
                border: '1px solid var(--border)', background: 'none',
                color: 'var(--muted-foreground)', fontSize: 12, cursor: 'pointer',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--foreground)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted-foreground)' }}
            >
              <Download size={13} /> Export
            </button>
          )}

          {/* Templates */}
          <button
            type="button"
            title="Templates"
            onClick={() => setShowTemplates(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 10px', borderRadius: 7,
              border: '1px solid var(--border)', background: 'none',
              color: 'var(--muted-foreground)', fontSize: 12, cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--foreground)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted-foreground)' }}
          >
            <LayoutTemplate size={13} /> Templates
          </button>

          {/* Focus mode */}
          <button
            type="button"
            title={focusMode ? 'Exit focus mode' : 'Focus mode'}
            onClick={() => setFocusMode(f => !f)}
            style={{
              display: 'flex', alignItems: 'center',
              padding: 6, borderRadius: 7,
              border: '1px solid var(--border)', background: 'none',
              color: 'var(--muted-foreground)', cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--foreground)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted-foreground)' }}
          >
            {focusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>

        {/* Row 2: title */}
        <input
          value={note.title ?? ''}
          onChange={e => handleTitleChange(e.target.value)}
          placeholder="Note title…"
          style={{
            width: '100%', background: 'none', border: 'none', outline: 'none',
            fontSize: 22, fontWeight: 700, color: 'var(--foreground)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            padding: '0 0 10px',
          }}
        />
      </div>

      {/* ── Tags bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        padding: '8px 20px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--background)',
        flexShrink: 0,
        minHeight: 38,
      }}>
        {note.tags?.map(tag => (
          <button
            key={tag}
            type="button"
            onClick={() => removeTag(tag)}
            title="Remove tag"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 12, color: 'var(--primary)',
              backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)',
              padding: '2px 8px', borderRadius: 99, cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--primary) 20%, transparent)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
          >
            {tag} <X size={9} />
          </button>
        ))}
        <input
          value={tagInput}
          onChange={e => setTagInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTag()}
          placeholder={note.tags?.length ? '+ add tag' : '+ add tag…'}
          style={{
            background: 'none', border: 'none', outline: 'none',
            fontSize: 12, color: 'var(--muted-foreground)',
            width: note.tags?.length ? 80 : 100,
          }}
        />
      </div>

      {/* ── Word count bar ── */}
      {noteId && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '3px 20px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--background)',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)', opacity: 0.6 }}>·</span>
          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
            {readMins} min read
          </span>
        </div>
      )}

      {/* ── Body: editor + right panel ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Editor */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <RichTextEditor
            content={note.content ?? '<p></p>'}
            onChange={handleContentChange}
            placeholder="Start writing… (type / for commands, [[ to link a note)"
            autoSaveStatus={saveStatus}
            focusMode={focusMode}
            onFocusMode={setFocusMode}
            onWikiLinksChange={ids => { wikiLinkIds.current = ids }}
          />
        </div>

        {/* Right panel */}
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
                  color: 'var(--muted-foreground)', fontSize: 12, cursor: 'pointer', textAlign: 'center',
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
                    background: 'none', color: 'var(--muted-foreground)', fontSize: 11, cursor: 'pointer', textAlign: 'left',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)44')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    + Add sub-note
                  </button>
                </div>
              )}
            </div>

            <BacklinksPanel noteId={noteId} />
          </div>
        )}
      </div>

      {/* Template modal */}
      <NoteTemplateModal
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onSelect={tmpl => {
          setNote(prev => ({ ...prev, title: tmpl.title, content: tmpl.content }))
        }}
      />
    </div>
  )

  if (focusMode) {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--background)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
        {editorContent}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', backgroundColor: 'var(--background)' }}>
      {editorContent}
    </div>
  )
}
