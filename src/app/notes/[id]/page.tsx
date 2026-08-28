'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, Maximize2, Minimize2, Plus, FileText,
  ChevronRight, ArrowLeft, LayoutTemplate, Download,
  List, ChevronDown, Sparkles, Settings2,
  AlignLeft, Loader2, RefreshCw, PenLine, Check, CheckSquare,
} from 'lucide-react'
import type { Editor } from '@tiptap/react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Note, ChecklistItem } from '@/types'
import { generateId } from '@/lib/utils'
import { RichTextEditor } from '@/components/editor/RichTextEditor'
import { NoteTemplateModal } from '@/components/editor/NoteTemplates'
import { LinkPanel } from '@/components/links/LinkPanel'
import { BacklinksPanel } from '@/components/notes/BacklinksPanel'
import { AIChatPanel } from '@/components/ai/AIChatPanel'
import { AIInlineAssist } from '@/components/ai/AIInlineAssist'
import { AIWritingPanel } from '@/components/ai/AIWritingPanel'
import { AIRelatedPanel } from '@/components/ai/AIRelatedPanel'
import { AISettingsModal } from '@/components/ai/AISettingsModal'
import { useNoteTabs } from '@/hooks/useNoteTabs'
import { notebookTag } from '@/hooks/useNotebooks'
import { useAISettings } from '@/hooks/useAISettings'
import { triggerEmbedBackground } from '@/lib/ai/autoEmbed'
import { useAITitleSuggest, useAITagSuggest, useAISummarize } from '@/hooks/useAI'
import { MarkdownContent } from '@/components/ui/MarkdownContent'
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
  // AI features
  const { config: aiConfig, isConfigured: aiConfigured } = useAISettings()
  const [chatOpen,        setChatOpen]        = useState(false)
  const [aiSettingsOpen,  setAISettingsOpen]  = useState(false)
  // Inline assist state: set when the user triggers AI on a text selection
  const [aiAssist, setAIAssist] = useState<{ text: string; rect: DOMRect } | null>(null)
  // AI Writing panel
  const [writingOpen,   setWritingOpen]   = useState(false)
  const [writingFormat, setWritingFormat] = useState<'outline' | 'meeting' | 'daily' | 'research' | 'ooo' | 'proposal' | 'status' | 'email' | undefined>(undefined)
  // Smart title suggestion
  const { suggest: suggestTitle, loading: titleLoading } = useAITitleSuggest(aiConfig)
  // Auto-tag suggestions — shown as dismissible chips below the tag input
  const { tags: suggestedTags, loading: tagsLoading, suggest: suggestTags, dismiss: dismissTag, setTags: setSuggestedTags } = useAITagSuggest(aiConfig)
  // Note summarize — shown in the right sidebar
  const { summary: noteSummary, loading: summaryLoading, summarize: summarizeNote, setSummary: setNoteSummary } = useAISummarize(aiConfig)

  const saveTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wikiLinkIds  = useRef<string[]>([])
  const editorRef    = useRef<Editor | null>(null)
  const lastCheckRef = useRef<HTMLInputElement>(null)
  const prevCheckLen = useRef(0)

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

  useEffect(() => {
    const len = note.checklist_items?.length ?? 0
    if (len > prevCheckLen.current) lastCheckRef.current?.focus()
    prevCheckLen.current = len
  }, [note.checklist_items?.length])

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
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '', content: '<p></p>', type: 'markdown', tags: [], parent_id: noteId }),
      })
      if (res.ok) { const sub = await res.json(); router.push(`/notes/${sub.id}`) }
      else toast.error('Failed to create sub-note')
    } catch { toast.error('Failed to create sub-note') }
  }

  const syncWikiLinks = useCallback(async (sourceNoteId: string) => {
    await fetch('/api/wikilinks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceNoteId, targetNoteIds: wikiLinkIds.current }),
    })
    // Incrementing this counter causes BacklinksPanel to re-fetch its list
    // without passing a callback prop — any change to the value triggers the effect.
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
          triggerEmbedBackground('note', currentId)
          syncWikiLinks(currentId)
          if (data.title !== undefined) updateTitle(currentId, data.title || 'Untitled')
          window.dispatchEvent(new Event('dotstell:notes-updated'))
        } else setSaveStatus('unsaved')
      } else {
        const res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })
        if (res.ok) {
          const saved = await res.json()
          setNoteId(saved.id)
          setSaveStatus('saved')
          triggerEmbedBackground('note', saved.id)
          // Replace URL without a navigation event so the browser history and tab bar
          // reflect the real note ID while the user keeps typing without interruption.
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
${sanitizeHtmlForPrint(note.content ?? '')}
</body></html>`)
    win.document.close()
    win.focus()
    // Brief delay lets the browser render before the print dialog opens
    setTimeout(() => { win.print(); win.close() }, 600)
  }

  // Strip dangerous elements from TipTap HTML before writing to a new window.
  // Guards against <script>/<iframe> injection via paste or direct DB edits.
  function sanitizeHtmlForPrint(html: string): string {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.querySelectorAll('script, iframe, object, embed').forEach(el => el.remove())
    doc.querySelectorAll('*').forEach(el => {
      for (const attr of Array.from(el.attributes)) {
        if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
      }
    })
    return doc.body.innerHTML
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

  // Debounce saves by 1.5s — every keystroke resets the timer; the API call only
  // fires once the user pauses. This keeps network traffic low while still saving
  // quickly enough that switching notes rarely loses content.
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

  function addCheckItem() {
    const items = note.checklist_items ?? []
    const updated = { ...note, checklist_items: [...items, { id: generateId(), text: '', checked: false }] }
    setNote(updated); scheduleAutoSave(updated)
  }

  function updateCheckItem(itemId: string, updates: Partial<ChecklistItem>) {
    const updated = { ...note, checklist_items: note.checklist_items?.map(item => item.id === itemId ? { ...item, ...updates } : item) ?? [] }
    setNote(updated); scheduleAutoSave(updated)
  }

  function removeCheckItem(itemId: string) {
    const updated = { ...note, checklist_items: note.checklist_items?.filter(item => item.id !== itemId) ?? [] }
    setNote(updated); scheduleAutoSave(updated)
  }

  async function handleSuggestTitle() {
    const content = note.content ?? ''
    if (!content || content === '<p></p>') return
    const suggested = await suggestTitle(content, note.title || undefined)
    if (suggested) handleTitleChange(suggested)
  }

  async function handleSuggestTags() {
    const content = note.content ?? ''
    if (!content || content === '<p></p>') return
    await suggestTags(content, note.tags ?? [], note.title || undefined)
  }

  function acceptTag(tag: string) {
    if (note.tags?.includes(tag)) { dismissTag(tag); return }
    const updated = { ...note, tags: [...(note.tags ?? []), tag] }
    setNote(updated); scheduleAutoSave(updated)
    dismissTag(tag)
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted-foreground)', flexShrink: 0 }}>
              <Link href="/notes" style={{ color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                <ArrowLeft size={13} /> Notes
              </Link>
              {note.parent_id && (
                <>
                  <ChevronRight size={11} color="var(--border)" />
                  <Link href={`/notes/${note.parent_id}`} style={{ color: 'var(--muted-foreground)', textDecoration: 'none' }}>Parent</Link>
                </>
              )}
              {note.type === 'checklist' && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: '#10b981', backgroundColor: 'rgba(16,185,129,0.12)', padding: '2px 7px', borderRadius: 99 }}>
                  <CheckSquare size={10} /> Checklist
                </span>
              )}
              {note.type === 'plain' && (
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', backgroundColor: 'var(--muted)', padding: '2px 7px', borderRadius: 99 }}>
                  Plain
                </span>
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

          {/* AI Chat — only shown when AI is configured; discovery handled by the global AIStatusBadge */}
          {aiConfigured && (
            <button
              type="button"
              title="AI Chat — ask questions about your notes (RAG)"
              onClick={() => setChatOpen(c => !c)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 7,
                border: `1px solid ${chatOpen ? 'color-mix(in srgb, var(--primary) 40%, transparent)' : 'var(--border)'}`,
                background: chatOpen ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'none',
                color: chatOpen ? 'var(--primary)' : 'var(--muted-foreground)', fontSize: 12, cursor: 'pointer',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (!chatOpen) { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--foreground)' } }}
              onMouseLeave={e => { if (!chatOpen) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted-foreground)' } }}
            >
              <Sparkles size={13} /> AI Chat
            </button>
          )}

          {/* AI Writing Assistant */}
          {aiConfigured && (
            <button
              type="button"
              title="AI Writing — draft from scratch or improve existing content"
              onClick={() => { setWritingFormat(undefined); setWritingOpen(w => !w) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 7,
                border: `1px solid ${writingOpen ? 'color-mix(in srgb, var(--primary) 40%, transparent)' : 'var(--border)'}`,
                background: writingOpen ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'none',
                color: writingOpen ? 'var(--primary)' : 'var(--muted-foreground)', fontSize: 12, cursor: 'pointer',
                transition: 'all 0.12s',
              }}
              onMouseEnter={e => { if (!writingOpen) { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--foreground)' } }}
              onMouseLeave={e => { if (!writingOpen) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted-foreground)' } }}
            >
              <PenLine size={13} /> AI Write
            </button>
          )}

          {/* AI Inline Assist is now triggered by the floating bubble that appears on text selection — no header button needed */}

          {/* AI Settings shortcut */}
          <button
            type="button"
            title="AI Settings (Ctrl+Shift+,)"
            onClick={() => setAISettingsOpen(true)}
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
            <Settings2 size={13} />
          </button>
        </div>

        {/* Row 2: title + optional AI suggest button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            id="note-title"
            name="note-title"
            value={note.title ?? ''}
            onChange={e => handleTitleChange(e.target.value)}
            placeholder="Note title…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 22, fontWeight: 700, color: 'var(--foreground)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              padding: '0 0 10px',
            }}
          />
          {/* Show when AI is on and there's content worth titling */}
          {aiConfigured && editorText.length > 30 && (
            <button
              type="button"
              title="Suggest a title from your note content"
              onClick={handleSuggestTitle}
              disabled={titleLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 9px', borderRadius: 6, flexShrink: 0, marginBottom: 8,
                border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                backgroundColor: 'color-mix(in srgb, var(--primary) 8%, transparent)',
                color: 'var(--primary)', fontSize: 11, cursor: titleLoading ? 'wait' : 'pointer',
                fontWeight: 500, opacity: titleLoading ? 0.6 : 1, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!titleLoading) e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--primary) 15%, transparent)' }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--primary) 8%, transparent)' }}
            >
              <Sparkles size={11} />
              {titleLoading ? 'Suggesting…' : 'Suggest title'}
            </button>
          )}
        </div>
      </div>

      {/* ── Tags bar ── */}
      <div style={{
        display: 'flex', flexDirection: 'column',
        padding: '8px 20px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--background)',
        flexShrink: 0,
        gap: 6,
      }}>
        {/* Applied tags + input row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minHeight: 22 }}>
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
          {/* AI tag suggestion trigger — only shown when AI is configured and note has content */}
          {aiConfigured && editorText.length > 30 && (
            <button
              type="button"
              title="Suggest tags from note content"
              onClick={handleSuggestTags}
              disabled={tagsLoading}
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                padding: '2px 7px', borderRadius: 99,
                border: '1px solid var(--border)',
                backgroundColor: 'transparent',
                color: 'var(--muted-foreground)', fontSize: 11,
                cursor: tagsLoading ? 'wait' : 'pointer',
                opacity: tagsLoading ? 0.6 : 1, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!tagsLoading) { e.currentTarget.style.color = 'var(--primary)'; e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 40%, transparent)' } }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <Sparkles size={10} />
              {tagsLoading ? 'Suggesting…' : 'AI tags'}
            </button>
          )}
        </div>

        {/* Suggested tags row — dashed chips, click to add, X to dismiss */}
        {suggestedTags.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)', fontWeight: 500 }}>Suggested:</span>
            {suggestedTags.map(tag => (
              <button
                key={tag}
                type="button"
                title={`Add tag "${tag}"`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, padding: '2px 8px', borderRadius: 99,
                  border: '1px dashed color-mix(in srgb, var(--primary) 50%, transparent)',
                  backgroundColor: 'transparent',
                  color: 'var(--muted-foreground)', cursor: 'pointer', transition: 'all 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--primary) 10%, transparent)'; e.currentTarget.style.color = 'var(--primary)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}
              >
                <span onClick={() => acceptTag(tag)}>+ {tag}</span>
                <X
                  size={8}
                  style={{ flexShrink: 0, marginLeft: 2 }}
                  onClick={ev => { ev.stopPropagation(); dismissTag(tag) }}
                />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSuggestedTags([])}
              style={{ fontSize: 10, background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', opacity: 0.6, padding: '0 2px' }}
            >
              Dismiss all
            </button>
          </div>
        )}
      </div>


      {/* ── Body: editor + right panel ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Editor — checklist or rich text depending on note type */}
        <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {note.type === 'checklist' ? (
            <div style={{ flex: 1, padding: '24px 40px', maxWidth: 680, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
              {/* Progress bar */}
              {(note.checklist_items?.length ?? 0) > 0 && (() => {
                const done  = note.checklist_items?.filter(i => i.checked).length ?? 0
                const total = note.checklist_items?.length ?? 0
                const pct   = total ? (done / total) * 100 : 0
                return (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: pct === 100 ? '#10b981' : 'var(--muted-foreground)' }}>
                        {pct === 100 ? '🎉 All done!' : `${done} / ${total} done`}
                      </span>
                      {done > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            const upd = { ...note, checklist_items: note.checklist_items?.filter(i => !i.checked) ?? [] }
                            setNote(upd); scheduleAutoSave(upd)
                          }}
                          style={{ fontSize: 11, color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer' }}
                          onMouseEnter={e => { e.currentTarget.style.color = 'var(--destructive)' }}
                          onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-foreground)' }}
                        >
                          Clear done
                        </button>
                      )}
                    </div>
                    <div style={{ height: 4, borderRadius: 99, backgroundColor: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 99, backgroundColor: '#10b981', width: `${pct}%`, transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                )
              })()}

              {/* Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {(note.checklist_items ?? []).map((item, idx) => (
                  <div
                    key={item.id}
                    className="group"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 8px', borderRadius: 8 }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--accent)' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    <button
                      type="button"
                      onClick={() => updateCheckItem(item.id, { checked: !item.checked })}
                      style={{
                        width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                        border: `2px solid ${item.checked ? '#10b981' : 'var(--border)'}`,
                        backgroundColor: item.checked ? '#10b981' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (!item.checked) e.currentTarget.style.borderColor = '#10b981' }}
                      onMouseLeave={e => { if (!item.checked) e.currentTarget.style.borderColor = 'var(--border)' }}
                    >
                      {item.checked && <Check size={11} color="white" strokeWidth={3} />}
                    </button>
                    <input
                      ref={idx === (note.checklist_items?.length ?? 0) - 1 ? lastCheckRef : undefined}
                      value={item.text}
                      onChange={e => updateCheckItem(item.id, { text: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); addCheckItem() }
                        if (e.key === 'Backspace' && !item.text) { e.preventDefault(); removeCheckItem(item.id) }
                      }}
                      placeholder="Item..."
                      style={{
                        flex: 1, background: 'none', border: 'none', outline: 'none',
                        fontSize: 15, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                        color: item.checked ? 'var(--muted-foreground)' : 'var(--foreground)',
                        textDecoration: item.checked ? 'line-through' : 'none',
                        transition: 'color 0.15s',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeCheckItem(item.id)}
                      className="opacity-0 group-hover:opacity-100"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 3, color: 'var(--muted-foreground)', display: 'flex', borderRadius: 4, transition: 'all 0.1s' }}
                      onMouseEnter={e => { e.currentTarget.style.color = 'var(--destructive)'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)' }}
                      onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.backgroundColor = 'transparent' }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add item row */}
              <button
                type="button"
                onClick={addCheckItem}
                style={{
                  marginTop: 6, display: 'flex', alignItems: 'center', gap: 10,
                  padding: '5px 8px', borderRadius: 8, border: 'none',
                  background: 'none', cursor: 'pointer', color: 'var(--muted-foreground)',
                  fontSize: 15, width: '100%', textAlign: 'left',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--foreground)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}
              >
                <div style={{ width: 18, height: 18, borderRadius: 5, border: '2px dashed var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Plus size={10} />
                </div>
                Add item
              </button>
            </div>
          ) : (
            <>
              <RichTextEditor
                content={note.content ?? '<p></p>'}
                onChange={handleContentChange}
                onTextChange={setEditorText}
                placeholder="Start writing… (type / for commands, [[ to link a note)"
                focusMode={focusMode}
                onFocusMode={setFocusMode}
                onWikiLinksChange={ids => { wikiLinkIds.current = ids }}
                onEditorReady={ed => { editorRef.current = ed }}
                onAIAssist={aiConfigured ? () => {
                  const editor = editorRef.current
                  if (!editor) return
                  const { from, to } = editor.state.selection
                  if (from === to) return
                  const text = editor.state.doc.textBetween(from, to, ' ').trim()
                  if (!text) return
                  const sel = window.getSelection()
                  const rect = sel?.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null
                  if (rect) setAIAssist({ text, rect })
                } : undefined}
              />

              {/* AI Draft hint — shown when note is empty, AI configured, and panel is not open */}
              {aiConfigured && !loading && !writingOpen && editorText.trim() === '' && (
                <div style={{
                  margin: '0 20px 20px',
                  padding: '14px 16px', borderRadius: 12,
                  border: '1px dashed color-mix(in srgb, var(--primary) 35%, transparent)',
                  backgroundColor: 'color-mix(in srgb, var(--primary) 5%, transparent)',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Sparkles size={12} color="var(--primary)" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary)' }}>Start with AI</span>
                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>— pick a format or describe what you want to write</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(['outline', 'meeting', 'ooo', 'proposal', 'email'] as const).map(fmt => {
                      const labels: Record<string, string> = { outline: '📋 Outline', meeting: '🤝 Meeting notes', ooo: '✈️ OoO email', proposal: '📊 Proposal', email: '✉️ Email draft' }
                      return (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => { setWritingFormat(fmt); setWritingOpen(true) }}
                          style={{
                            padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
                            border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                            backgroundColor: 'color-mix(in srgb, var(--primary) 8%, transparent)',
                            color: 'var(--primary)', fontWeight: 500, transition: 'all 0.12s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--primary) 16%, transparent)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--primary) 8%, transparent)')}
                        >
                          {labels[fmt]}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      onClick={() => { setWritingFormat(undefined); setWritingOpen(true) }}
                      style={{
                        padding: '4px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
                        border: '1px solid var(--border)', backgroundColor: 'transparent',
                        color: 'var(--muted-foreground)', fontWeight: 500, transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--foreground)' }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--muted-foreground)' }}
                    >
                      ✏️ Custom
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right panel — hidden on mobile to preserve editor space */}
        {!focusMode && noteId && !isMobile && (
          <div style={{
            width: 240, flexShrink: 0, borderLeft: '1px solid var(--border)',
            padding: 16, overflowY: 'auto', backgroundColor: 'var(--card)',
            display: 'flex', flexDirection: 'column', gap: 20,
          }}>

            {/* ── Table of Contents / Checklist Progress ── */}
            {note.type === 'checklist' ? (() => {
              const done  = note.checklist_items?.filter(i => i.checked).length ?? 0
              const total = note.checklist_items?.length ?? 0
              const pct   = total ? Math.round((done / total) * 100) : 0
              return (
                <div>
                  <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CheckSquare size={12} /> Progress
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{pct}%</span>
                      <span style={{ color: 'var(--muted-foreground)' }}>{done}/{total}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, backgroundColor: 'var(--border)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 99, backgroundColor: pct === 100 ? '#10b981' : 'var(--primary)', width: `${pct}%`, transition: 'width 0.3s ease' }} />
                    </div>
                    <p style={{ margin: 0, fontSize: 11, color: pct === 100 ? '#10b981' : 'var(--muted-foreground)' }}>
                      {pct === 100 ? '🎉 All items complete' : `${total - done} item${total - done !== 1 ? 's' : ''} remaining`}
                    </p>
                  </div>
                </div>
              )
            })() : (
              <div>
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
            )}

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

            {/* AI Related Notes — only shown when AI is configured and note is saved */}
            {aiConfigured && (
              <AIRelatedPanel
                config={aiConfig}
                noteId={noteId}
                isConfigured={aiConfigured}
                onOpen={id => router.push(`/notes/${id}`)}
              />
            )}

            {/* AI Summary — one-click TL;DR for the current note */}
            {aiConfigured && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlignLeft size={10} /> Summary
                  </p>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {noteSummary && (
                      <button type="button" title="Regenerate" onClick={() => { setNoteSummary(''); summarizeNote({ entityType: 'note', entityId: noteId, mode: 'bullets' }) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 2, display: 'flex' }}>
                        <RefreshCw size={10} />
                      </button>
                    )}
                    {!noteSummary && (
                      <button
                        type="button"
                        disabled={summaryLoading}
                        onClick={() => summarizeNote({ entityType: 'note', entityId: noteId, mode: 'bullets' })}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          padding: '2px 7px', borderRadius: 99, fontSize: 10, fontWeight: 600,
                          border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                          backgroundColor: 'color-mix(in srgb, var(--primary) 8%, transparent)',
                          color: 'var(--primary)', cursor: summaryLoading ? 'wait' : 'pointer',
                          opacity: summaryLoading ? 0.6 : 1,
                        }}
                      >
                        {summaryLoading
                          ? <><Loader2 size={9} style={{ animation: 'spin 1s linear infinite' }} /> Summarizing…</>
                          : <><Sparkles size={9} /> Summarize</>}
                      </button>
                    )}
                  </div>
                </div>
                {summaryLoading && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[90, 75, 85, 60].map((w, i) => (
                      <div key={i} style={{ height: 10, borderRadius: 5, backgroundColor: 'var(--muted)', width: `${w}%`, opacity: 0.6 }} />
                    ))}
                  </div>
                )}
                {noteSummary && !summaryLoading && (
                  <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.65 }}>
                    <MarkdownContent compact>{noteSummary}</MarkdownContent>
                  </div>
                )}
                {!noteSummary && !summaryLoading && (
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)', opacity: 0.5 }}>
                    Click Summarize for a bullet-point TL;DR
                  </p>
                )}
              </div>
            )}
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
          {note.type === 'checklist' ? (() => {
            const done  = note.checklist_items?.filter(i => i.checked).length ?? 0
            const total = note.checklist_items?.length ?? 0
            return (
              <>
                <StatusPill label={`${total} item${total !== 1 ? 's' : ''}`} />
                <StatusDivider />
                <StatusPill label={`${done} done`} />
                <StatusDivider />
                <StatusPill label={`${total - done} remaining`} />
              </>
            )
          })() : (
            <>
              <StatusPill label={`${wordCount.toLocaleString()} ${wordCount === 1 ? 'word' : 'words'}`} />
              <StatusDivider />
              <StatusPill label={`${charCount.toLocaleString()} chars`} />
              <StatusDivider />
              <StatusPill label={`~${readMins} min read`} />
            </>
          )}
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
          const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          const content = tmpl.content.replace(/\{\{DATE\}\}/g, today)
          setNote(prev => ({ ...prev, title: tmpl.title, content }))
        }}
      />

      {/* AI Settings modal */}
      {aiSettingsOpen && <AISettingsModal onClose={() => setAISettingsOpen(false)} />}

      {/* AI Writing Panel — side drawer for drafting and improving content */}
      {writingOpen && aiConfigured && (
        <AIWritingPanel
          config={aiConfig}
          noteTitle={note.title}
          noteContent={editorText}
          isEmpty={editorText.trim() === ''}
          initialFormat={writingFormat}
          onInsert={html => {
            const editor = editorRef.current
            if (editor) {
              const end = editor.state.doc.content.size
              editor.chain().focus().insertContentAt(end, html).run()
            }
          }}
          onReplace={html => {
            const editor = editorRef.current
            if (editor) editor.commands.setContent(html)
          }}
          onClose={() => { setWritingOpen(false); setWritingFormat(undefined) }}
        />
      )}

      {/* AI Inline Assist — floating panel anchored to the text selection */}
      {aiAssist && aiConfigured && (
        <AIInlineAssist
          config={aiConfig}
          selectedText={aiAssist.text}
          noteContext={editorText}
          anchorRect={aiAssist.rect}
          onApply={newText => {
            const editor = editorRef.current
            if (editor) editor.chain().focus().insertContent(newText).run()
          }}
          onClose={() => setAIAssist(null)}
        />
      )}
    </div>
  )

  // AI Chat panel is rendered outside editorContent so it overlays the full page
  // (including focus mode) without being re-mounted when focusMode toggles.
  const aiChatOverlay = chatOpen && aiConfigured && (
    <AIChatPanel
      config={aiConfig}
      noteId={noteId ?? undefined}
      noteTitle={note.title}
      noteContent={note.content}
      onClose={() => setChatOpen(false)}
    />
  )

  if (focusMode) {
    return (
      <>
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'var(--background)', zIndex: 100, display: 'flex', flexDirection: 'column' }}>
          {editorContent}
        </div>
        {aiChatOverlay}
      </>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', backgroundColor: 'var(--background)' }}>
        {editorContent}
      </div>
      {aiChatOverlay}
    </>
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
