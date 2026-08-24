'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, Maximize2, Minimize2, Plus, FileText,
  ChevronRight, ArrowLeft, LayoutTemplate, Download,
  List, ChevronDown,
} from 'lucide-react'
import type { Editor } from '@tiptap/react'
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
  const [wikiSyncCount, setWikiSyncCount] = useState(0)
  const [isMobile, setIsMobile]       = useState(false)
  // Live plain-text from the editor — updated on every keystroke via onTextChange
  const [editorText, setEditorText]   = useState('')
  // ToC visibility — persisted so the user's preference survives navigation
  const [tocOpen, setTocOpen]         = useState(() =>
    typeof window !== 'undefined' ? localStorage.getItem('dotstell_toc_open') !== 'false' : true
  )
  const saveTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wikiLinkIds  = useRef<string[]>([])
  // Holds the live Tiptap editor instance so we can scroll to headings from the ToC
  const editorRef    = useRef<Editor | null>(null)

  // Parse headings from HTML content so the ToC stays in sync with the editor
  const headings = useMemo(() => {
    if (!note.content) return []
    try {
      const dom = new DOMParser().parseFromString(note.content, 'text/html')
      const result: { text: string; level: number; index: number }[] = []
      let idx = 0
      dom.querySelectorAll('h1,h2,h3,h4').forEach(el => {
        const text = el.textContent?.trim()
        if (text) result.push({ text, level: parseInt(el.tagName[1]), index: idx++ })
      })
      return result
    } catch { return [] }
  }, [note.content])

  // Word / char counts from the editor's own plain text (accurate, includes spaces)
  const wordCount = editorText ? editorText.split(/\s+/).filter(Boolean).length : 0
  const charCount = editorText.length
  const readMins  = Math.max(1, Math.round(wordCount / 200))

  const { openTab, updateTitle } = useNoteTabs(noteId ?? undefined)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

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
    setWikiSyncCount(n => n + 1)
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

  // Opens a clean HTML page in a new tab and triggers the browser's print-to-PDF dialog.
  // No dependencies needed — works in every desktop browser.
  function exportPdf() {
    const title = note.title || 'Untitled'
    const safe  = (s: string) => s.replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const win   = window.open('', '_blank')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><title>${safe(title)}</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:800px;margin:40px auto;padding:0 24px;color:#111;line-height:1.6}
  h1{font-size:26px;font-weight:800;margin-bottom:4px}
  h2{font-size:20px;font-weight:700}h3{font-size:16px;font-weight:600}
  code{background:#f3f3f3;padding:2px 6px;border-radius:4px;font-size:.88em}
  pre{background:#f3f3f3;padding:14px;border-radius:8px;overflow-x:auto}pre code{background:none;padding:0}
  blockquote{border-left:3px solid #ddd;margin:0;padding:6px 14px;color:#555}
  a{color:#5b4de0}ul,ol{padding-left:22px}
  table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px 10px;text-align:left}th{background:#f5f5f5;font-weight:600}
  img{max-width:100%;height:auto}
  @media print{body{margin:0}}
</style>
</head><body>
<h1>${safe(title)}</h1>
${note.content ?? ''}
</body></html>`)
    win.document.close()
    win.focus()
    // Brief delay lets the browser render before the print dialog opens
    setTimeout(() => { win.print(); win.close() }, 600)
  }

  // Navigate to a heading by querying the actual rendered DOM inside the editor.
  // Tiptap's scrollIntoView() targets the ProseMirror viewport, not the outer
  // scrollable div — querying the DOM and calling scrollIntoView() directly is reliable.
  function scrollToHeading(text: string) {
    const ed = editorRef.current
    if (!ed) return
    const editorDom = ed.view.dom as HTMLElement
    const headings = editorDom.querySelectorAll('h1,h2,h3,h4')
    for (const el of headings) {
      if (el.textContent?.trim() === text) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        return
      }
    }
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

          {/* Save indicator — dot only in header */}
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

          {/* Export — Markdown and PDF side by side */}
          {noteId && (
            <div style={{ display: 'flex', gap: 3 }}>
              {([
                { label: '.md', title: 'Export as Markdown', onClick: exportMarkdown },
                { label: 'PDF', title: 'Export as PDF (print dialog)', onClick: exportPdf },
              ] as const).map(btn => (
                <button
                  key={btn.label}
                  type="button"
                  title={btn.title}
                  onClick={btn.onClick}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '5px 9px', borderRadius: 7,
                    border: '1px solid var(--border)', background: 'none',
                    color: 'var(--muted-foreground)', fontSize: 12, cursor: 'pointer',
                    transition: 'all 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--foreground)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted-foreground)' }}
                >
                  <Download size={12} /> {btn.label}
                </button>
              ))}
            </div>
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
          id="note-title"
          name="note-title"
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
          id="note-tag-input"
          name="note-tag-input"
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


      {/* ── Body: editor + right panel ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Editor */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <RichTextEditor
            content={note.content ?? '<p></p>'}
            onChange={handleContentChange}
            onTextChange={setEditorText}
            placeholder="Start writing… (type / for commands, [[ to link a note)"
            focusMode={focusMode}
            onFocusMode={setFocusMode}
            onWikiLinksChange={ids => { wikiLinkIds.current = ids }}
            onEditorReady={ed => { editorRef.current = ed }}
          />
        </div>

        {/* Right panel — hidden on mobile to preserve editor space */}
        {!focusMode && noteId && !isMobile && (
          <div style={{
            width: 240, flexShrink: 0, borderLeft: '1px solid var(--border)',
            padding: 16, overflowY: 'auto', backgroundColor: 'var(--card)',
            display: 'flex', flexDirection: 'column', gap: 20,
          }}>

            {/* ── Table of Contents ── */}
            <div>
              {/* Header with toggle — clicking shows/hides the outline */}
              <button
                type="button"
                onClick={() => {
                  const next = !tocOpen
                  setTocOpen(next)
                  localStorage.setItem('dotstell_toc_open', String(next))
                }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                  padding: '0 0 8px', marginBottom: tocOpen ? 4 : 0,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <List size={12} /> Outline
                </span>
                <ChevronDown size={12} style={{ color: 'var(--muted-foreground)', transform: tocOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
              </button>

              {tocOpen && (
                headings.length === 0 ? (
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0, opacity: 0.5 }}>
                    Add headings to see outline
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {headings.map(h => (
                      <button
                        key={h.index}
                        type="button"
                        onClick={() => scrollToHeading(h.text)}
                        title={h.text}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          background: 'none', border: 'none', cursor: 'pointer',
                          // Indent by heading level: h1=0px, h2=10px, h3=18px, h4=24px
                          paddingLeft: Math.max(0, (h.level - 1) * 8),
                          paddingTop: 3, paddingBottom: 3, paddingRight: 4,
                          borderRadius: 5,
                          fontSize: h.level === 1 ? 13 : 12,
                          fontWeight: h.level <= 2 ? 600 : 400,
                          color: 'var(--foreground)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          transition: 'background 0.1s, color 0.1s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--primary)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--foreground)' }}
                      >
                        {h.text}
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>

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

            <BacklinksPanel noteId={noteId} noteTitle={note.title} syncCount={wikiSyncCount} />
          </div>
        )}
      </div>

      {/* ── Status bar ── */}
      {noteId && !focusMode && !loading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 0,
          padding: '0 20px',
          height: 28,
          borderTop: '1px solid var(--border)',
          backgroundColor: 'color-mix(in srgb, var(--card) 80%, var(--background))',
          flexShrink: 0,
        }}>
          <StatusPill label={`${wordCount.toLocaleString()} ${wordCount === 1 ? 'word' : 'words'}`} />
          <StatusDivider />
          <StatusPill label={`${charCount.toLocaleString()} chars`} />
          <StatusDivider />
          <StatusPill label={`~${readMins} min read`} />
          {saveStatus && (
            <>
              <div style={{ flex: 1 }} />
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '0 8px',
                color: saveStatus === 'saved' ? '#22c55e' : saveStatus === 'saving' ? '#f59e0b' : '#ef4444',
              }}>
                {saveStatus === 'saving' ? '… Saving' : saveStatus === 'saved' ? '✓ Saved' : '✗ Unsaved'}
              </span>
            </>
          )}
        </div>
      )}

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

function StatusPill({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 500,
      color: 'var(--foreground)',
      opacity: 0.55,
      padding: '0 8px',
      letterSpacing: '0.01em',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function StatusDivider() {
  return (
    <span style={{
      width: 1, height: 12,
      backgroundColor: 'var(--border)',
      display: 'inline-block',
      flexShrink: 0,
    }} />
  )
}
