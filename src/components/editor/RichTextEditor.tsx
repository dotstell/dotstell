'use client'
import { useEditor, EditorContent, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import CharacterCount from '@tiptap/extension-character-count'
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { Image } from '@tiptap/extension-image'
import { Underline } from '@tiptap/extension-underline'
import { TextAlign } from '@tiptap/extension-text-align'
import { TextStyle, Color, FontFamily } from '@tiptap/extension-text-style'
import { Superscript } from '@tiptap/extension-superscript'
import { Subscript } from '@tiptap/extension-subscript'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { createLowlight, common } from 'lowlight'
import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Bold, Italic, Strikethrough, Code, Underline as UnderlineIcon,
  List, ListOrdered, CheckSquare, Quote, Minus, Table as TableIcon,
  Link as LinkIcon, Highlighter, Undo, Redo,
  ChevronDown, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Superscript as SuperscriptIcon, Subscript as SubscriptIcon,
  Image as ImageIcon, Type, RotateCcw, FileCode2, Eye, FileText, Check, Palette, X,
  Clipboard,
} from 'lucide-react'
import { HexColorPicker } from 'react-colorful'
// markdown ↔ HTML conversion (source mode)
import TurndownService from 'turndown'
import { marked } from 'marked'
import { WikiLinkExtension } from '@/lib/tiptap/WikiLinkExtension'

const lowlight = createLowlight(common)

// ── Colour palettes ─────────────────────────────────────────
// 5 columns × 5 rows = 25 swatches; Tailwind-400 range works in both dark/light
const TEXT_COLORS = [
  // Row 1: neutrals
  { label: 'Default',  value: '' },
  { label: 'Mist',     value: '#d1d5db' },
  { label: 'Gray',     value: '#9ca3af' },
  { label: 'Slate',    value: '#6b7280' },
  { label: 'Charcoal', value: '#475569' },
  // Row 2: warm vivid
  { label: 'Red',      value: '#f87171' },
  { label: 'Orange',   value: '#fb923c' },
  { label: 'Amber',    value: '#fbbf24' },
  { label: 'Yellow',   value: '#facc15' },
  { label: 'Lime',     value: '#a3e635' },
  // Row 3: cool vivid
  { label: 'Green',    value: '#4ade80' },
  { label: 'Teal',     value: '#2dd4bf' },
  { label: 'Sky',      value: '#38bdf8' },
  { label: 'Blue',     value: '#60a5fa' },
  { label: 'Indigo',   value: '#818cf8' },
  // Row 4: accent
  { label: 'Violet',   value: '#a78bfa' },
  { label: 'Purple',   value: 'var(--primary)' },
  { label: 'Fuchsia',  value: '#e879f9' },
  { label: 'Pink',     value: '#f472b6' },
  { label: 'Rose',     value: '#fb7185' },
  // Row 5: deeper tones
  { label: 'Crimson',  value: '#dc2626' },
  { label: 'Forest',   value: '#16a34a' },
  { label: 'Ocean',    value: '#0284c7' },
  { label: 'Plum',     value: '#7e22ce' },
  { label: 'Gold',     value: '#b45309' },
]

// 5 cols × 2 rows = 10 swatches (9 highlights + None)
const HIGHLIGHT_COLORS = [
  { label: 'Yellow', value: 'rgba(251,191,36,0.45)',  dot: '#fbbf24' },
  { label: 'Amber',  value: 'rgba(251,146,60,0.44)',  dot: '#fb923c' },
  { label: 'Green',  value: 'rgba(74,222,128,0.4)',   dot: '#4ade80' },
  { label: 'Teal',   value: 'rgba(45,212,191,0.4)',   dot: '#2dd4bf' },
  { label: 'Sky',    value: 'rgba(56,189,248,0.42)',  dot: '#38bdf8' },
  { label: 'Blue',   value: 'rgba(96,165,250,0.44)',  dot: '#60a5fa' },
  { label: 'Violet', value: 'rgba(167,139,250,0.44)', dot: '#a78bfa' },
  { label: 'Pink',   value: 'rgba(244,114,182,0.44)', dot: '#f472b6' },
  { label: 'Red',    value: 'rgba(248,113,113,0.44)', dot: '#f87171' },
  { label: 'None',   value: '',                        dot: '' },
]

type FontEntry = { label: string; value: string; preview?: string }
type FontGroup = { group: string; fonts: FontEntry[] }

const FONT_GROUPS: FontGroup[] = [
  {
    group: 'System',
    fonts: [
      { label: 'Default',    value: '',                                                          preview: 'Aa' },
      { label: 'Inter',      value: '"Inter", sans-serif',                                       preview: 'Aa' },
      { label: 'Nunito',     value: '"Nunito", sans-serif',                                      preview: 'Aa' },
      { label: 'Poppins',    value: '"Poppins", sans-serif',                                     preview: 'Aa' },
      { label: 'DM Sans',    value: '"DM Sans", sans-serif',                                     preview: 'Aa' },
    ],
  },
  {
    group: 'Serif',
    fonts: [
      { label: 'Georgia',           value: 'Georgia, serif',                                    preview: 'Aa' },
      { label: 'Merriweather',      value: '"Merriweather", serif',                             preview: 'Aa' },
      { label: 'Playfair Display',  value: '"Playfair Display", serif',                         preview: 'Aa' },
      { label: 'Lora',              value: '"Lora", serif',                                     preview: 'Aa' },
    ],
  },
  {
    group: 'Monospace',
    fonts: [
      { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace',                         preview: 'Aa' },
      { label: 'Fira Code',      value: '"Fira Code", monospace',                              preview: 'Aa' },
      { label: 'Source Code Pro',value: '"Source Code Pro", monospace',                        preview: 'Aa' },
    ],
  },
  {
    group: 'Handwritten',
    fonts: [
      { label: 'Caveat',               value: '"Caveat", cursive',                             preview: 'Aa' },
      { label: 'Indie Flower',         value: '"Indie Flower", cursive',                       preview: 'Aa' },
      { label: 'Kalam',                value: '"Kalam", cursive',                              preview: 'Aa' },
      { label: 'Patrick Hand',         value: '"Patrick Hand", cursive',                       preview: 'Aa' },
      { label: 'Architects Daughter',  value: '"Architects Daughter", cursive',                preview: 'Aa' },
    ],
  },
]

// flat list for label lookup
const FONT_FAMILIES_FLAT = FONT_GROUPS.flatMap(g => g.fonts)

// ── Slash commands ───────────────────────────────────────────
const SLASH_COMMANDS = [
  { label: 'Heading 1',    icon: 'H1', desc: 'Large heading',        group: 'Text',    action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'Heading 2',    icon: 'H2', desc: 'Medium heading',       group: 'Text',    action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Heading 3',    icon: 'H3', desc: 'Small heading',        group: 'Text',    action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: 'Bullet list',  icon: '•',  desc: 'Unordered list',       group: 'Lists',   action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().toggleBulletList().run() },
  { label: 'Numbered list',icon: '1.', desc: 'Ordered list',         group: 'Lists',   action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().toggleOrderedList().run() },
  { label: 'Checklist',    icon: '☑',  desc: 'Task list',            group: 'Lists',   action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().toggleTaskList().run() },
  { label: 'Quote',        icon: '"',  desc: 'Blockquote',           group: 'Blocks',  action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().toggleBlockquote().run() },
  { label: 'Code block',   icon: '<>', desc: 'Syntax-highlighted',   group: 'Blocks',  action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().toggleCodeBlock().run() },
  { label: 'Callout',      icon: '💡', desc: 'Info callout block',   group: 'Blocks',  action: (e: ReturnType<typeof useEditor>) => insertCallout(e, 'info') },
  { label: 'Warning',      icon: '⚠️', desc: 'Warning callout',      group: 'Blocks',  action: (e: ReturnType<typeof useEditor>) => insertCallout(e, 'warning') },
  { label: 'Divider',      icon: '—',  desc: 'Horizontal rule',      group: 'Blocks',  action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().setHorizontalRule().run() },
  { label: 'Table',        icon: '⊞',  desc: '3×3 table',            group: 'Insert',  action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { label: 'Image',        icon: '🖼',  desc: 'Embed image from URL', group: 'Insert',  action: (e: ReturnType<typeof useEditor>) => promptImage(e) },
]

function insertCallout(editor: ReturnType<typeof useEditor>, type: 'info' | 'warning' | 'tip' | 'danger') {
  if (!editor) return
  const icon = type === 'info' ? '💡' : type === 'warning' ? '⚠️' : type === 'tip' ? '✅' : '🚫'
  editor.chain().focus().insertContent(
    `<div class="callout callout-${type}"><p>${icon} </p></div>`
  ).run()
}

function promptImage(editor: ReturnType<typeof useEditor>) {
  const url = window.prompt('Image URL')
  if (url && editor) editor.chain().focus().setImage({ src: url }).run()
}

interface NoteSearchResult {
  id: string
  title: string
}

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  /** Called on every keystroke with the editor's plain text — use for live char/word counts */
  onTextChange?: (text: string) => void
  placeholder?: string
  onFocusMode?: (active: boolean) => void
  focusMode?: boolean
  /** Called after every save with the list of [[wikilink]] target note IDs found in the content */
  onWikiLinksChange?: (targetNoteIds: string[]) => void
  /** Called once the Tiptap editor instance is ready — use to drive ToC navigation from the parent */
  onEditorReady?: (editor: Editor) => void
  /** Called when the user activates AI Assist from the toolbar — parent handles the selection + panel */
  onAIAssist?: () => void
}

// ── Markdown converters (singleton) ─────────────────────────
const td = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
})
td.addRule('strikethrough', {
  filter: ['del', 's'],
  replacement: (c) => `~~${c}~~`,
})
td.addRule('highlight', {
  filter: (node) => node.nodeName === 'MARK',
  replacement: (c) => `==${c}==`,
})

function htmlToMarkdown(html: string): string {
  return td.turndown(html)
}

async function markdownToHtml(md: string): Promise<string> {
  return await marked(md, { breaks: true, gfm: true }) as string
}

// Extract wikilink noteIds directly from the Tiptap document JSON (reliable, no HTML parsing)
function extractWikiLinkIdsFromDoc(editor: ReturnType<typeof useEditor>): string[] {
  if (!editor) return []
  const ids: string[] = []
  editor.state.doc.descendants(node => {
    if (node.type.name === 'wikiLink' && node.attrs.noteId) {
      ids.push(node.attrs.noteId)
    }
  })
  return [...new Set(ids)]
}

export function RichTextEditor({
  content, onChange, onTextChange, placeholder = 'Start writing… (type / for commands)',
  onFocusMode, focusMode, onWikiLinksChange, onEditorReady, onAIAssist,
}: RichTextEditorProps) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Floating AI Assist bubble — appears above selected text when onAIAssist is wired up
  const [assistBubble, setAssistBubble] = useState<{ x: number; y: number } | null>(null)

  const [slashOpen,       setSlashOpen]       = useState(false)
  const [slashFilter,     setSlashFilter]     = useState('')
  const [slashIdx,        setSlashIdx]        = useState(0)
  const [linkDialogOpen,  setLinkDialogOpen]  = useState(false)
  const [linkUrl,         setLinkUrl]         = useState('')
  const [colorPickerOpen,  setColorPickerOpen]  = useState(false)
  const [hlPickerOpen,     setHlPickerOpen]     = useState(false)
  const [fontMenuOpen,     setFontMenuOpen]     = useState(false)
  const [headingMenuOpen,  setHeadingMenuOpen]  = useState(false)
  const [imageDialogOpen, setImageDialogOpen] = useState(false)
  const [imageUrl,        setImageUrl]        = useState('')
  // Source mode (raw markdown)
  const [sourceMode,      setSourceMode]      = useState(false)
  const [markdownSource,  setMarkdownSource]  = useState('')
  // Paste mode — 'rich' keeps semantic HTML, 'plain' strips everything
  const [pasteMode, setPasteMode] = useState<'rich' | 'plain'>(() =>
    (typeof window !== 'undefined' ? (localStorage.getItem('dotstell_paste_mode') as 'rich' | 'plain') : null) ?? 'rich'
  )
  const pasteModeRef = useRef<'rich' | 'plain'>('rich')
  useEffect(() => { pasteModeRef.current = pasteMode }, [pasteMode])
  // Wikilink [[...]] picker
  const [wikiOpen,        setWikiOpen]        = useState(false)
  const [wikiQuery,       setWikiQuery]       = useState('')
  const [wikiResults,     setWikiResults]     = useState<NoteSearchResult[]>([])
  const [wikiIdx,         setWikiIdx]         = useState(0)
  const wikiSearchTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wikiListRef        = useRef<HTMLDivElement>(null)
  const slashMenuRef       = useRef<HTMLDivElement>(null)
  const onWikiLinksChangeRef = useRef(onWikiLinksChange)
  useEffect(() => { onWikiLinksChangeRef.current = onWikiLinksChange }, [onWikiLinksChange])
  const onTextChangeRef = useRef(onTextChange)
  useEffect(() => { onTextChangeRef.current = onTextChange }, [onTextChange])
  // Ref keeps onEditorReady stable so the effect below never re-runs due to prop identity changes
  const onEditorReadyRef = useRef(onEditorReady)
  useEffect(() => { onEditorReadyRef.current = onEditorReady }, [onEditorReady])
  const onAIAssistRef = useRef(onAIAssist)
  useEffect(() => { onAIAssistRef.current = onAIAssist }, [onAIAssist])
  // Cancel any pending wiki search timer when the component unmounts to avoid
  // calling setWikiResults on an unmounted component.
  useEffect(() => () => { if (wikiSearchTimer.current) clearTimeout(wikiSearchTimer.current) }, [])
  const colorRef   = useRef<HTMLDivElement>(null)
  const hlRef      = useRef<HTMLDivElement>(null)
  const fontRef    = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      StarterKit.configure({ codeBlock: false, link: false, underline: false }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
      Highlight.configure({ multicolor: true }),
      Typography,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'tiptap-link' },
        // validate blocks javascript: hrefs from being rendered as links — defence
        // against XSS via malicious content pasted into the editor.
        validate: href => /^(https?:\/\/|mailto:|\/|#)/i.test(href),
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({ allowBase64: true }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Superscript,
      Subscript,
      FontFamily,
      CodeBlockLowlight.configure({ lowlight }),
      WikiLinkExtension,
    ],
    content,
    editorProps: {
      attributes: { class: 'tiptap-editor' },
      handleKeyDown: (_view, event) => {
        if (event.ctrlKey && event.code === 'Space') {
          event.preventDefault()
          onAIAssistRef.current?.()
          return true
        }
        return false
      },
      handlePaste: (_view, event) => {
        if (pasteModeRef.current === 'plain') {
          const text = event.clipboardData?.getData('text/plain') ?? ''
          if (text) {
            _view.dispatch(_view.state.tr.insertText(text))
            return true
          }
        }
        return false
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false // internal node drag — let Tiptap handle it
        const url = event.dataTransfer?.getData('text/uri-list')?.trim()
          || event.dataTransfer?.getData('text/plain')?.trim()
        if (!url || !url.startsWith('http')) return false
        event.preventDefault()
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
        if (!pos) return false
        const { schema, tr } = view.state
        const linkMark = schema.marks.link?.create({ href: url, target: '_blank', rel: 'noopener noreferrer' })
        if (!linkMark) return false
        view.dispatch(tr.insert(pos.pos, schema.text(url, [linkMark])))
        return true
      },
      // Smart paste: strip unsafe elements and all non-semantic attributes while
      // preserving structure (headings, lists, links, tables). Plain paste mode
      // bypasses this entirely and inserts raw text.
      transformPastedHTML: (html) => {
        if (pasteModeRef.current === 'plain') return ''
        try {
          const doc = new DOMParser().parseFromString(html, 'text/html')
          // Remove presentation/chrome elements
          doc.querySelectorAll(
            'script,style,nav,header,footer,aside,form,button,input,select,textarea,iframe,noscript,svg,canvas,figure > figcaption'
          ).forEach(el => el.remove())
          // Strip all attributes except the semantically meaningful ones
          const KEEP: Record<string, string[]> = {
            a:   ['href', 'title'],
            img: ['src', 'alt'],
            td:  ['colspan', 'rowspan'],
            th:  ['colspan', 'rowspan'],
          }
          doc.querySelectorAll('*').forEach(el => {
            const tag = el.tagName.toLowerCase()
            const allowed = KEEP[tag] ?? []
            Array.from(el.attributes).forEach(attr => {
              if (!allowed.includes(attr.name)) el.removeAttribute(attr.name)
            })
          })
          // Strip any surviving javascript: hrefs (defence-in-depth)
          doc.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href') ?? ''
            if (!/^(https?:\/\/|mailto:|\/|#)/i.test(href)) a.removeAttribute('href')
          })
          return doc.body.innerHTML
        } catch {
          return ''
        }
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      onChange(html)
      onTextChangeRef.current?.(editor.getText())

      // Notify parent of current wikilink targets (read from doc, not HTML)
      onWikiLinksChangeRef.current?.(extractWikiLinkIdsFromDoc(editor))

      const { selection } = editor.state
      const { $from } = selection
      const lineText = $from.parent.textContent.slice(0, selection.from - $from.start())

      // Wikilink detection — [[ triggers note search
      const wikiMatch = lineText.match(/\[\[([^\][]*)$/)
      if (wikiMatch) {
        const q = wikiMatch[1]
        setWikiQuery(q)
        setWikiOpen(true)
        setWikiIdx(0)
        if (wikiSearchTimer.current) clearTimeout(wikiSearchTimer.current)
        wikiSearchTimer.current = setTimeout(() => {
          fetch(`/api/notes?q=${encodeURIComponent(q)}&root_only=true`)
            .then(r => r.ok ? r.json() : [])
            .then(data => setWikiResults(Array.isArray(data) ? data.slice(0, 8) : []))
            .catch(() => setWikiResults([]))
        }, 120)
        setSlashOpen(false)
        return
      }
      setWikiOpen(false)

      // Slash command detection
      if (lineText.endsWith('/') || (lineText.includes('/') && !lineText.includes(' '))) {
        setSlashFilter(lineText.split('/').pop() ?? '')
        setSlashOpen(true)
        setSlashIdx(0)
      } else {
        setSlashOpen(false)
      }
    },
    onSelectionUpdate: ({ editor }) => {
      if (!onAIAssist) { setAssistBubble(null); return }
      const { from, to } = editor.state.selection
      if (from === to) { setAssistBubble(null); return }
      const text = editor.state.doc.textBetween(from, to, ' ').trim()
      if (!text) { setAssistBubble(null); return }
      // Position bubble above the selection using DOM range
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) { setAssistBubble(null); return }
      const rect = sel.getRangeAt(0).getBoundingClientRect()
      if (!rect.width) { setAssistBubble(null); return }
      setAssistBubble({ x: rect.left + rect.width / 2, y: rect.top - 8 })
    },
  })

  // Auto-scroll wiki dropdown to active item
  useEffect(() => {
    if (!wikiOpen || !wikiListRef.current) return
    const active = wikiListRef.current.querySelector<HTMLElement>(`[data-wiki-idx="${wikiIdx}"]`)
    active?.scrollIntoView({ block: 'nearest' })
  }, [wikiIdx, wikiOpen])

  useEffect(() => {
    if (!slashOpen || !slashMenuRef.current) return
    const active = slashMenuRef.current.querySelector<HTMLElement>(`[data-slash-idx="${slashIdx}"]`)
    active?.scrollIntoView({ block: 'nearest' })
  }, [slashIdx, slashOpen])

  // Close floating menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (colorPickerOpen  && colorRef.current   && !colorRef.current.contains(e.target as Node))   setColorPickerOpen(false)
      if (hlPickerOpen     && hlRef.current      && !hlRef.current.contains(e.target as Node))      setHlPickerOpen(false)
      if (fontMenuOpen     && fontRef.current    && !fontRef.current.contains(e.target as Node))    setFontMenuOpen(false)
      if (headingMenuOpen  && headingRef.current && !headingRef.current.contains(e.target as Node)) setHeadingMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [colorPickerOpen, hlPickerOpen, fontMenuOpen, headingMenuOpen])

  // Sync external content
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  // Notify parent once the editor is ready — used for ToC scroll-to-heading and initial word count
  useEffect(() => {
    if (!editor) return
    onEditorReadyRef.current?.(editor)
    // Fire onTextChange with initial content so word/char counts are populated without a keystroke
    onTextChangeRef.current?.(editor.getText())
  }, [editor])

  const filteredCommands = SLASH_COMMANDS.filter(c =>
    c.label.toLowerCase().includes(slashFilter.toLowerCase())
  )

  // Group slash commands for display
  const groupedCommands: Record<string, typeof SLASH_COMMANDS> = {}
  for (const cmd of filteredCommands) {
    if (!groupedCommands[cmd.group]) groupedCommands[cmd.group] = []
    groupedCommands[cmd.group].push(cmd)
  }
  const flatFiltered = filteredCommands

  function applySlashCommand(cmd: typeof SLASH_COMMANDS[0]) {
    if (!editor) return
    const { from } = editor.state.selection
    const deleteCount = slashFilter.length + 1
    editor.chain().focus().deleteRange({ from: from - deleteCount, to: from }).run()
    cmd.action(editor)
    setSlashOpen(false)
  }

  function applyWikiLink(note: NoteSearchResult) {
    if (!editor) return
    const { from } = editor.state.selection
    const deleteCount = wikiQuery.length + 2 // +2 for "[["
    editor
      .chain()
      .focus()
      .deleteRange({ from: from - deleteCount, to: from })
      .run()
    editor
      .chain()
      .focus()
      .insertContent([
        { type: 'wikiLink', attrs: { noteId: note.id, noteTitle: note.title || 'Untitled' } },
        { type: 'text', text: ' ' },
      ])
      .run()
    // Fire immediately — onUpdate fires async and the autosave debounce may beat it
    setTimeout(() => {
      onWikiLinksChangeRef.current?.(extractWikiLinkIdsFromDoc(editor))
    }, 0)
    setWikiOpen(false)
    setWikiQuery('')
    setWikiResults([])
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (wikiOpen) {
      if (e.key === 'ArrowDown')  { e.preventDefault(); setWikiIdx(i => Math.min(i + 1, wikiResults.length - 1)) }
      if (e.key === 'ArrowUp')    { e.preventDefault(); setWikiIdx(i => Math.max(i - 1, 0)) }
      if (e.key === 'Enter')      { e.preventDefault(); if (wikiResults[wikiIdx]) applyWikiLink(wikiResults[wikiIdx]) }
      if (e.key === 'Escape')     { setWikiOpen(false) }
      return
    }
    if (!slashOpen) return
    if (e.key === 'ArrowDown')  { e.preventDefault(); setSlashIdx(i => Math.min(i + 1, flatFiltered.length - 1)) }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setSlashIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter')      { e.preventDefault(); if (flatFiltered[slashIdx]) applySlashCommand(flatFiltered[slashIdx]) }
    if (e.key === 'Escape')     { setSlashOpen(false) }
  }

  function setLink() {
    if (!editor) return
    if (linkUrl) {
      const url = linkUrl.trim()
      if (!/^(https?:\/\/|mailto:|\/|#)/i.test(url)) return
      editor.chain().focus().setLink({ href: url }).run()
    } else {
      editor.chain().focus().unsetLink().run()
    }
    setLinkDialogOpen(false)
    setLinkUrl('')
  }

  function insertImage() {
    if (!editor || !imageUrl) return
    editor.chain().focus().setImage({ src: imageUrl }).run()
    setImageDialogOpen(false)
    setImageUrl('')
  }

  // Toggle between WYSIWYG and raw markdown source
  const toggleSourceMode = useCallback(async () => {
    if (!editor) return
    if (!sourceMode) {
      // entering source mode: convert current HTML → markdown
      setMarkdownSource(htmlToMarkdown(editor.getHTML()))
      setSourceMode(true)
    } else {
      // leaving source mode: convert markdown → HTML, push back into editor
      const html = await markdownToHtml(markdownSource)
      editor.commands.setContent(html)
      onChange(html)
      setSourceMode(false)
    }
  }, [editor, sourceMode, markdownSource, onChange])

  // In source mode, update markdown on textarea change and propagate HTML
  const handleSourceChange = useCallback(async (md: string) => {
    setMarkdownSource(md)
    const html = await markdownToHtml(md)
    onChange(html)
  }, [onChange])

  const activeColor = editor?.getAttributes('textStyle')?.color ?? ''

  if (!editor) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>

      {/* ── Toolbar wrapper — toggle always clickable, rest dims in source mode ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--card)', position: 'sticky', top: 0, zIndex: 20,
        flexWrap: 'wrap', rowGap: 0,
        touchAction: 'manipulation',
      }}>
      {/* Dimmed tool area */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        flexWrap: isMobile ? 'nowrap' : 'wrap',
        overflowX: isMobile ? 'auto' : 'visible',
        scrollbarWidth: 'none',
        padding: '5px 6px 5px 10px',
        rowGap: isMobile ? 0 : 4, flex: 1, minWidth: 0,
        opacity: sourceMode ? 0.35 : 1,
        pointerEvents: sourceMode ? 'none' : 'auto',
        transition: 'opacity 0.2s',
      }}>

        {/* Undo / Redo */}
        <ToolbarGroup>
          <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo ⌘Z"><Undo size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo ⌘⇧Z"><Redo size={14} /></ToolBtn>
        </ToolbarGroup>

        <Divider />

        {/* Heading + font */}
        <HeadingDropdown editor={editor} ref={headingRef} open={headingMenuOpen} isMobile={isMobile}
          setOpen={v => { if (v) { setFontMenuOpen(false); setColorPickerOpen(false); setHlPickerOpen(false) } setHeadingMenuOpen(v) }} />
        <FontDropdown editor={editor} open={fontMenuOpen} ref={fontRef} isMobile={isMobile}
          setOpen={v => { if (v) { setHeadingMenuOpen(false); setColorPickerOpen(false); setHlPickerOpen(false) } setFontMenuOpen(v) }} />

        <Divider />

        {/* Text formatting */}
        <ToolbarGroup>
          <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()}        active={editor.isActive('bold')}       title="Bold ⌘B">       <Bold size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()}      active={editor.isActive('italic')}     title="Italic ⌘I">     <Italic size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()}   active={editor.isActive('underline')}  title="Underline ⌘U">  <UnderlineIcon size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()}      active={editor.isActive('strike')}     title="Strikethrough"> <Strikethrough size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()}        active={editor.isActive('code')}       title="Inline code">   <Code size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} title="Superscript">  <SuperscriptIcon size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleSubscript().run()}   active={editor.isActive('subscript')}  title="Subscript">     <SubscriptIcon size={14} /></ToolBtn>
        </ToolbarGroup>

        <Divider />

        {/* Text colour picker */}
        <div ref={colorRef} style={{ position: 'relative' }}>
          <button
            type="button"
            title="Text color"
            onClick={() => { setColorPickerOpen(o => !o); setHlPickerOpen(false); setFontMenuOpen(false); setHeadingMenuOpen(false) }}
            style={{
              width: 28, height: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 1, borderRadius: 6, border: 'none', cursor: 'pointer', backgroundColor: 'transparent',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Type size={13} color={activeColor || 'var(--secondary-foreground)'} />
            <div style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: activeColor || 'var(--secondary-foreground)' }} />
          </button>
          {colorPickerOpen && (
            <>
              {isMobile && <div style={{ position: 'fixed', inset: 0, zIndex: 499, backgroundColor: 'rgba(0,0,0,0.35)' }} onClick={() => setColorPickerOpen(false)} />}
              <ColorPicker
                colors={TEXT_COLORS}
                activeValue={activeColor}
                isMobile={isMobile}
                onSelect={v => {
                  if (v) editor.chain().focus().setColor(v).run()
                  else editor.chain().focus().unsetColor().run()
                  setColorPickerOpen(false)
                }}
              />
            </>
          )}
        </div>

        {/* Highlight colour picker */}
        <div ref={hlRef} style={{ position: 'relative' }}>
          <button
            type="button"
            title="Highlight color"
            onClick={() => { setHlPickerOpen(o => !o); setColorPickerOpen(false); setFontMenuOpen(false); setHeadingMenuOpen(false) }}
            style={{
              width: 28, height: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 1, borderRadius: 6, border: 'none', cursor: 'pointer',
              backgroundColor: editor.isActive('highlight') ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'transparent',
            }}
            onMouseEnter={e => { if (!editor.isActive('highlight')) e.currentTarget.style.backgroundColor = 'var(--accent)' }}
            onMouseLeave={e => { if (!editor.isActive('highlight')) e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <Highlighter size={13} color={editor.isActive('highlight') ? 'var(--primary)' : 'var(--secondary-foreground)'} />
            <div style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: editor.getAttributes('highlight').color || (editor.isActive('highlight') ? '#fbbf24' : 'var(--secondary-foreground)') }} />
          </button>
          {hlPickerOpen && (
            <>
              {isMobile && <div style={{ position: 'fixed', inset: 0, zIndex: 499, backgroundColor: 'rgba(0,0,0,0.35)' }} onClick={() => setHlPickerOpen(false)} />}
              <HighlightPicker
                colors={HIGHLIGHT_COLORS}
                editor={editor}
                isMobile={isMobile}
                onSelect={v => {
                  if (v) editor.chain().focus().setHighlight({ color: v }).run()
                  else editor.chain().focus().unsetHighlight().run()
                  setHlPickerOpen(false)
                }}
              />
            </>
          )}
        </div>

        <Divider />

        {/* Text alignment */}
        <ToolbarGroup>
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()}    active={editor.isActive({ textAlign: 'left' })}    title="Align left">    <AlignLeft size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()}  active={editor.isActive({ textAlign: 'center' })}  title="Align center">  <AlignCenter size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()}   active={editor.isActive({ textAlign: 'right' })}   title="Align right">   <AlignRight size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">       <AlignJustify size={14} /></ToolBtn>
        </ToolbarGroup>

        <Divider />

        {/* Lists */}
        <ToolbarGroup>
          <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()}  active={editor.isActive('bulletList')}  title="Bullet list">    <List size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">  <ListOrdered size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()}    active={editor.isActive('taskList')}    title="Checklist">       <CheckSquare size={14} /></ToolBtn>
        </ToolbarGroup>

        <Divider />

        {/* Blocks */}
        <ToolbarGroup>
          <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()}                                              active={editor.isActive('blockquote')} title="Quote">      <Quote size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()}                                               active={editor.isActive('codeBlock')}  title="Code block"> <Code size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()}                                             title="Divider">                                           <Minus size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}         title="Table">                                             <TableIcon size={14} /></ToolBtn>
        </ToolbarGroup>

        <Divider />

        {/* Link + Image */}
        <ToolbarGroup>
          <ToolBtn
            onClick={() => { setLinkUrl(editor.getAttributes('link').href ?? ''); setLinkDialogOpen(true) }}
            active={editor.isActive('link')} title="Link ⌘K"
          ><LinkIcon size={14} /></ToolBtn>
          <ToolBtn onClick={() => setImageDialogOpen(true)} title="Image"><ImageIcon size={14} /></ToolBtn>
        </ToolbarGroup>

      </div>{/* end dimmed area */}

        {/* Source mode toggle + paste mode — always clickable, outside dimmed area */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '5px 8px 5px 4px', flexShrink: 0,
          ...(isMobile ? { order: 1, width: '100%', borderTop: '1px solid var(--border)', paddingLeft: 10 } : {}),
        }}>
          {/* Paste mode toggle */}
          <button
            type="button"
            title={pasteMode === 'rich' ? 'Paste: Rich text (keeps headings, bold, lists) — click for plain' : 'Paste: Plain text (strips all formatting) — click for rich'}
            onClick={() => {
              const next = pasteMode === 'rich' ? 'plain' : 'rich'
              setPasteMode(next)
              localStorage.setItem('dotstell_paste_mode', next)
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 6, border: '1px solid',
              borderColor: pasteMode === 'plain' ? 'var(--primary)' : 'var(--border)',
              backgroundColor: pasteMode === 'plain' ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'transparent',
              color: pasteMode === 'plain' ? 'var(--primary)' : 'var(--muted-foreground)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            <Clipboard size={12} />
            {pasteMode === 'rich' ? 'Rich paste' : 'Plain paste'}
          </button>
          <button
            type="button"
            title={sourceMode ? 'Switch to rich text' : 'Switch to Markdown source'}
            onClick={toggleSourceMode}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 6, border: '1px solid',
              borderColor: sourceMode ? 'var(--primary)' : 'var(--border)',
              backgroundColor: sourceMode ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'transparent',
              color: sourceMode ? 'var(--primary)' : 'var(--muted-foreground)',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {sourceMode ? <Eye size={12} /> : <FileCode2 size={12} />}
            {sourceMode ? 'Rich text' : 'Markdown'}
          </button>
        </div>
      </div>{/* end toolbar wrapper */}

      {/* ── Editor area ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', minHeight: 0 }} onKeyDown={handleKeyDown}>

        {/* Source mode — raw markdown textarea */}
        {sourceMode ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Markdown cheatsheet bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '6px 16px', borderBottom: '1px solid var(--secondary)',
              backgroundColor: 'var(--muted)',
            }}>
              {[
                ['# H1', '# '],['## H2', '## '],['**bold**', '**'],
                ['_italic_', '_'],['~~strike~~', '~~'],['`code`', '`'],
                ['- list', '- '],['1. list', '1. '],['> quote', '> '],
                ['```code block', '```\n'],['==highlight==', '=='],
              ].map(([label]) => (
                <span key={label} style={{
                  fontSize: 11, color: 'var(--muted-foreground)', fontFamily: '"JetBrains Mono", monospace',
                  backgroundColor: 'var(--secondary)', padding: '2px 6px', borderRadius: 4,
                  cursor: 'default', userSelect: 'none',
                }}>
                  {label}
                </span>
              ))}
              <span style={{ fontSize: 11, color: 'var(--border)', marginLeft: 'auto' }}>
                Markdown source — click "Rich text" to preview
              </span>
            </div>
            <textarea
              value={markdownSource}
              onChange={e => handleSourceChange(e.target.value)}
              spellCheck={false}
              placeholder={'# Your heading\n\nStart writing markdown here...\n\n- **bold** text\n- _italic_ text\n- `inline code`\n\n> A beautiful quote\n\n```js\nconsole.log("hello")\n```'}
              style={{
                flex: 1, padding: '24px 28px',
                background: 'var(--background)', color: '#d4d4e8',
                border: 'none', outline: 'none', resize: 'none',
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                fontSize: 14, lineHeight: 1.8,
                caretColor: 'var(--primary)',
              }}
            />
          </div>
        ) : (
          <EditorContent editor={editor} style={{ height: '100%' }} />
        )}

        {/* ── AI Assist floating bubble (appears above selected text) ── */}
        {assistBubble && onAIAssist && (
          <div
            onMouseDown={e => { e.preventDefault(); setAssistBubble(null); onAIAssist() }}
            style={{
              position:        'fixed',
              left:            assistBubble.x,
              top:             assistBubble.y,
              transform:       'translate(-50%, -100%)',
              zIndex:          9000,
              display:         'flex', alignItems: 'center', gap: 5,
              padding:         '5px 10px',
              borderRadius:    20,
              backgroundColor: 'var(--primary)',
              color:           'white',
              fontSize:        11, fontWeight: 700,
              cursor:          'pointer',
              boxShadow:       '0 4px 16px rgba(0,0,0,0.4)',
              userSelect:      'none',
              whiteSpace:      'nowrap',
              pointerEvents:   'auto',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 4V2" /><path d="M15 16v-2" /><path d="M8 9h2" /><path d="M20 9h2" />
              <path d="M17.8 11.8 19 13" /><path d="M15 9h0" /><path d="M17.8 6.2 19 5" /><path d="m3 21 9-9" /><path d="M12.2 6.2 11 5" />
            </svg>
            AI Assist
          </div>
        )}

        {/* ── Wikilink picker [[ ── */}
        {wikiOpen && (
          <div
            ref={wikiListRef}
            style={{
              position: 'absolute', left: 20, top: 60, zIndex: 100,
              backgroundColor: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 6, width: 280, maxWidth: 'calc(100vw - 40px)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              maxHeight: 300, overflowY: 'auto',
            }}
          >
            <p style={{ fontSize: 10, color: 'var(--muted-foreground)', padding: '4px 8px 6px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Link to note
            </p>
            {wikiResults.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', padding: '8px 10px', margin: 0 }}>
                {wikiQuery.length < 1 ? 'Start typing a note name…' : 'No notes found'}
              </p>
            ) : (
              wikiResults.map((note, i) => (
                <button
                  key={note.id}
                  type="button"
                  data-wiki-idx={i}
                  onMouseDown={e => { e.preventDefault(); applyWikiLink(note) }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    backgroundColor: i === wikiIdx ? 'color-mix(in srgb, var(--primary) 15%, transparent)' : 'transparent',
                    textAlign: 'left',
                  }}
                  onMouseEnter={() => setWikiIdx(i)}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                    backgroundColor: i === wikiIdx ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'var(--secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <FileText size={13} color="var(--primary)" />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {note.title || 'Untitled'}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* ── Slash command menu ── */}
        {slashOpen && flatFiltered.length > 0 && (
          <div
            ref={slashMenuRef}
            style={{
              position: 'absolute', left: 20, top: 60, zIndex: 100,
              backgroundColor: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 12, padding: 6, width: 260, maxWidth: 'calc(100vw - 40px)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              maxHeight: 360, overflowY: 'auto',
            }}>
            <p style={{ fontSize: 10, color: 'var(--border)', padding: '4px 8px 6px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Blocks</p>
            {flatFiltered.map((cmd, i) => (
              <button
                key={cmd.label}
                type="button"
                data-slash-idx={i}
                onMouseDown={e => { e.preventDefault(); applySlashCommand(cmd) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  backgroundColor: i === slashIdx ? 'color-mix(in srgb, var(--primary) 15%, transparent)' : 'transparent',
                  textAlign: 'left',
                }}
                onMouseEnter={() => setSlashIdx(i)}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 7,
                  backgroundColor: i === slashIdx ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'var(--secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 13, fontWeight: 700, color: 'var(--primary)',
                }}>
                  {cmd.icon}
                </div>
                <div>
                  <p style={{ fontSize: 13, color: 'var(--foreground)', margin: 0 }}>{cmd.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>{cmd.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Link dialog ── */}
        {linkDialogOpen && (
          <FloatingDialog
            onClose={() => setLinkDialogOpen(false)}
            title="Insert link"
            icon={<LinkIcon size={14} />}
          >
            <input
              autoFocus
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setLink(); if (e.key === 'Escape') setLinkDialogOpen(false) }}
              placeholder="https://..."
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={setLink} style={primaryBtnStyle}>Apply</button>
              <button type="button" onClick={() => { editor.chain().focus().unsetLink().run(); setLinkDialogOpen(false) }} style={dangerBtnStyle}>Remove</button>
              <button type="button" onClick={() => setLinkDialogOpen(false)} style={secondaryBtnStyle}>Cancel</button>
            </div>
          </FloatingDialog>
        )}

        {/* ── Image dialog ── */}
        {imageDialogOpen && (
          <FloatingDialog
            onClose={() => setImageDialogOpen(false)}
            title="Insert image"
            icon={<ImageIcon size={14} />}
          >
            <input
              autoFocus
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') insertImage(); if (e.key === 'Escape') setImageDialogOpen(false) }}
              placeholder="https://... (image URL)"
              style={inputStyle}
            />
            {imageUrl.startsWith('http') && (
              <div style={{
                marginBottom: 14, borderRadius: 8, overflow: 'hidden',
                border: '1px solid var(--border)', backgroundColor: 'var(--muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                minHeight: 80, maxHeight: 180,
              }}>
                <img
                  src={imageUrl}
                  alt="preview"
                  style={{ maxWidth: '100%', maxHeight: 180, objectFit: 'contain', display: 'block' }}
                  onError={e => { (e.currentTarget as HTMLImageElement).parentElement!.style.display = 'none' }}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={insertImage} style={primaryBtnStyle}>Insert image</button>
              <button type="button" onClick={() => setImageDialogOpen(false)} style={secondaryBtnStyle}>Cancel</button>
            </div>
          </FloatingDialog>
        )}
      </div>

    </div>
  )
}

// ── Shared dialog styles ─────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)', backgroundColor: 'var(--background)',
  color: 'var(--foreground)', fontSize: 13, outline: 'none',
  marginBottom: 14, boxSizing: 'border-box',
  transition: 'border-color 0.15s',
}
const primaryBtnStyle: React.CSSProperties = {
  flex: 1, padding: '8px', borderRadius: 8, backgroundColor: 'var(--primary)',
  border: 'none', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}
const secondaryBtnStyle: React.CSSProperties = {
  flex: 1, padding: '8px', borderRadius: 8, backgroundColor: 'transparent',
  border: '1px solid var(--border)', color: 'var(--foreground)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
}
const dangerBtnStyle: React.CSSProperties = {
  flex: 1, padding: '8px', borderRadius: 8, backgroundColor: 'rgba(239,68,68,0.12)',
  border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 13, fontWeight: 500, cursor: 'pointer',
}

// ── Sub-components ───────────────────────────────────────────
function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 1 }}>{children}</div>
}

function Divider() {
  return <div style={{ width: 1, height: 20, backgroundColor: 'var(--border)', margin: '0 4px', flexShrink: 0 }} />
}

function ToolBtn({ onClick, active, disabled, title, children }: {
  onClick: () => void; active?: boolean; disabled?: boolean; title?: string; children: React.ReactNode
}) {
  return (
    <button
      type="button" title={title} onClick={onClick} disabled={disabled}
      style={{
        width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: active ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'transparent',
        color: active ? 'var(--primary)' : disabled ? 'var(--border)' : 'var(--secondary-foreground)',
        transition: 'all 0.1s', flexShrink: 0,
        touchAction: 'manipulation',
      }}
      onMouseEnter={e => { if (!active && !disabled) e.currentTarget.style.backgroundColor = 'var(--accent)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      {children}
    </button>
  )
}

function FloatingDialog({ title, icon, children, onClose }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; onClose: () => void
}) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 299, backgroundColor: 'rgba(0,0,0,0.35)' }}
      />
      {/* Dialog */}
      <div style={{
        position: 'fixed', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)', zIndex: 300,
        backgroundColor: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '18px 20px 16px', width: 360,
        maxWidth: 'calc(100vw - 32px)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.55)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {icon && <span style={{ color: 'var(--primary)', display: 'flex' }}>{icon}</span>}
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>{title}</span>
          </div>
          <button
            type="button" onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', display: 'flex', padding: 3, borderRadius: 5 }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--foreground)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted-foreground)' }}
          >
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </>
  )
}

function HeadingDropdown({ editor, open, setOpen, isMobile, ref }: {
  editor: ReturnType<typeof useEditor>; open: boolean; setOpen: (v: boolean) => void; isMobile: boolean; ref: React.RefObject<HTMLDivElement | null>
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  useEffect(() => { if (open && btnRef.current) setRect(btnRef.current.getBoundingClientRect()) }, [open])

  if (!editor) return null
  const current = editor.isActive('heading', { level: 1 }) ? 'Heading 1'
    : editor.isActive('heading', { level: 2 }) ? 'Heading 2'
    : editor.isActive('heading', { level: 3 }) ? 'Heading 3'
    : 'Normal'
  const panelStyle: React.CSSProperties = isMobile && rect
    ? { position: 'fixed', top: rect.bottom + 4, left: rect.left, zIndex: 200 }
    : { position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4 }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button ref={btnRef} type="button" onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
          backgroundColor: 'transparent', color: 'var(--secondary-foreground)', fontSize: 12,
          cursor: 'pointer', minWidth: 82, whiteSpace: 'nowrap', touchAction: 'manipulation',
        }}
      >
        {current} <ChevronDown size={11} />
      </button>
      {open && (
        <div style={{
          ...panelStyle,
          backgroundColor: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 4, minWidth: 140,
          boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
        }}>
          {[
            { label: 'Normal',    fs: 13, fw: 400, action: () => editor.chain().focus().setParagraph().run() },
            { label: 'Heading 1', fs: 20, fw: 700, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
            { label: 'Heading 2', fs: 16, fw: 700, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
            { label: 'Heading 3', fs: 14, fw: 600, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
          ].map(item => (
            <button key={item.label} type="button" onClick={() => { item.action(); setOpen(false) }}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 7, border: 'none', backgroundColor: 'transparent', color: 'var(--foreground)', cursor: 'pointer', textAlign: 'left', fontSize: item.fs, fontWeight: item.fw }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--primary) 10%, transparent)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >{item.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function FontDropdown({ editor, open, setOpen, ref, isMobile }: {
  editor: ReturnType<typeof useEditor>; open: boolean; setOpen: (v: boolean) => void; ref: React.RefObject<HTMLDivElement | null>; isMobile: boolean
}) {
  const btnRef = useRef<HTMLButtonElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  useEffect(() => { if (open && btnRef.current) setRect(btnRef.current.getBoundingClientRect()) }, [open])

  if (!editor) return null
  const currentFont  = editor.getAttributes('textStyle').fontFamily ?? ''
  const currentEntry = FONT_FAMILIES_FLAT.find(f => f.value === currentFont)
  const currentLabel = currentEntry?.label ?? 'Font'
  const GROUP_ICONS: Record<string, string> = { System: '🔡', Serif: '📖', Monospace: '💻', Handwritten: '✍️' }
  const panelStyle: React.CSSProperties = isMobile && rect
    ? { position: 'fixed', top: rect.bottom + 4, left: rect.left, zIndex: 200 }
    : { position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4 }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        title="Font family"
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
          backgroundColor: 'transparent', color: 'var(--secondary-foreground)', fontSize: 12,
          cursor: 'pointer', minWidth: 76, whiteSpace: 'nowrap',
          fontFamily: currentFont || 'inherit',
          touchAction: 'manipulation',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 72 }}>{currentLabel}</span>
        <ChevronDown size={11} style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div style={{
          ...panelStyle,
          backgroundColor: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 12, padding: 6, width: 220,
          boxShadow: '0 12px 36px rgba(0,0,0,0.7)',
          maxHeight: 420, overflowY: 'auto',
        }}>
          {FONT_GROUPS.map(group => (
            <div key={group.group}>
              {/* Group label */}
              <p style={{
                fontSize: 10, color: 'var(--border)', margin: '6px 0 3px 8px',
                textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600,
              }}>
                {GROUP_ICONS[group.group]} {group.group}
              </p>
              {group.fonts.map(f => {
                const isActive = currentFont === f.value
                return (
                  <button
                    key={f.label}
                    type="button"
                    onClick={() => {
                      if (f.value) editor.chain().focus().setFontFamily(f.value).run()
                      else editor.chain().focus().unsetFontFamily().run()
                      setOpen(false)
                    }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      backgroundColor: isActive ? 'color-mix(in srgb, var(--primary) 15%, transparent)' : 'transparent',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--accent)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent' }}
                  >
                    <span style={{
                      fontSize: 13, color: isActive ? 'var(--primary)' : 'var(--foreground)',
                      fontFamily: f.value || 'inherit',
                      fontWeight: isActive ? 600 : 400,
                    }}>
                      {f.label}
                    </span>
                    {/* Live preview of the font */}
                    <span style={{
                      fontSize: 12, color: 'var(--muted-foreground)',
                      fontFamily: f.value || 'inherit',
                    }}>
                      Aa
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CustomColorModal({ initial, onSave, onCancel }: {
  initial: string
  onSave: (v: string) => void
  onCancel: () => void
}) {
  const [color, setColor] = useState(/^#[0-9a-f]{6}$/i.test(initial) ? initial : '#6b7280')
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, width: 272, boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Custom color</p>
          <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 2, borderRadius: 5, display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
        <HexColorPicker color={color} onChange={setColor} style={{ width: '100%' }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <div style={{ width: 34, height: 34, borderRadius: 7, backgroundColor: color, border: '1px solid var(--border)', flexShrink: 0 }} />
          <input
            type="text"
            value={color}
            onChange={e => { if (/^#[0-9a-f]{0,6}$/i.test(e.target.value)) setColor(e.target.value) }}
            maxLength={7}
            style={{ flex: 1, fontSize: 12, fontFamily: 'monospace', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px', backgroundColor: 'var(--muted)', color: 'var(--foreground)', outline: 'none' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onCancel} style={{ padding: '6px 16px', borderRadius: 7, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--foreground)', fontSize: 12, cursor: 'pointer' }}>
            Cancel
          </button>
          <button type="button" onClick={() => { if (/^#[0-9a-f]{6}$/i.test(color)) onSave(color) }} style={{ padding: '6px 16px', borderRadius: 7, border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontSize: 12, cursor: 'pointer', fontWeight: 600, opacity: /^#[0-9a-f]{6}$/i.test(color) ? 1 : 0.4 }}>
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

const NO_COLOR_BG = 'linear-gradient(to top right, transparent calc(50% - 1.5px), #ef4444 calc(50% - 1.5px), #ef4444 calc(50% + 1.5px), transparent calc(50% + 1.5px))'

// Shared swatch button styles — uses outline (not border) for active ring so layout never shifts
function swatchStyle(isActive: boolean, bg: string, isNoColor = false): React.CSSProperties {
  return {
    width: 28, height: 28, borderRadius: 6,
    border: '1px solid rgba(0,0,0,0.08)',
    outline: isActive ? '2px solid var(--primary)' : 'none',
    outlineOffset: 1,
    backgroundColor: isNoColor ? 'var(--card)' : bg,
    backgroundImage: isNoColor ? NO_COLOR_BG : 'none',
    cursor: 'pointer', position: 'relative',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'transform 0.1s',
    flexShrink: 0,
  }
}

const RECENT_COLORS_KEY = 'dotstell-recent-colors'
const MAX_RECENT = 5

function loadRecentColors(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_COLORS_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((c): c is string => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c))
  } catch { return [] }
}
function saveRecentColor(color: string, prev: string[]): string[] {
  const next = [color, ...prev.filter(c => c !== color)].slice(0, MAX_RECENT)
  try { localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(next)) } catch {}
  return next
}

function ColorPicker({ colors, activeValue, onSelect, isMobile }: {
  colors: { label: string; value: string }[]
  activeValue: string
  onSelect: (v: string) => void
  isMobile?: boolean
}) {
  const [showCustom, setShowCustom] = useState(false)
  const [recentColors, setRecentColors] = useState<string[]>(() => loadRecentColors())

  const isCustomActive = activeValue !== '' && !colors.some(c => c.value === activeValue)

  const posStyle: React.CSSProperties = isMobile
    ? { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 500 }
    : { position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4 }

  return (
    <>
      <div style={{
        ...posStyle,
        backgroundColor: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '10px 10px 8px', width: 180,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Text color</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
          {colors.map(c => {
            const isActive = activeValue === c.value
            const isDefault = c.value === ''
            return (
              <button
                key={c.label}
                type="button"
                title={c.label}
                onClick={() => onSelect(c.value)}
                style={swatchStyle(isActive, c.value, isDefault)}
                onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.18)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
              >
                {isActive && !isDefault && (
                  <Check size={12} color="white" style={{ position: 'absolute', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.6))' }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Bottom bar: up to 5 recent custom colors + always-visible palette button */}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
            {recentColors.map(rc => {
              const isActive = activeValue === rc
              return (
                <button
                  key={rc}
                  type="button"
                  title={rc}
                  onClick={() => onSelect(rc)}
                  style={{
                    width: 20, height: 20, borderRadius: 4, cursor: 'pointer', flexShrink: 0,
                    backgroundColor: rc,
                    border: '1px solid rgba(0,0,0,0.1)',
                    outline: isActive ? '2px solid var(--primary)' : 'none',
                    outlineOffset: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'transform 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.2)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {isActive && <Check size={9} color="white" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.7))' }} />}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            title="Open color picker"
            onClick={() => setShowCustom(true)}
            style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s', flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--muted)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Palette size={13} color="var(--muted-foreground)" />
          </button>
        </div>
      </div>
      {showCustom && (
        <CustomColorModal
          initial={isCustomActive ? activeValue : (recentColors[0] || '#6b7280')}
          onSave={v => {
            onSelect(v)
            setRecentColors(prev => saveRecentColor(v, prev))
            setShowCustom(false)
          }}
          onCancel={() => setShowCustom(false)}
        />
      )}
    </>
  )
}

function HighlightPicker({ colors, editor, onSelect, isMobile }: {
  colors: { label: string; value: string; dot: string }[]
  editor: ReturnType<typeof useEditor>
  onSelect: (v: string) => void
  isMobile?: boolean
}) {
  const posStyle: React.CSSProperties = isMobile
    ? { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 500 }
    : { position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4 }

  return (
    <div style={{
      ...posStyle,
      backgroundColor: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '10px 10px 8px', width: 180,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    }}>
      <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>Highlight</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
        {colors.map(c => {
          const isActive = c.value
            ? editor.isActive('highlight', { color: c.value })
            : !editor.isActive('highlight')
          const isNone = c.value === ''
          return (
            <button
              key={c.label}
              type="button"
              title={c.label}
              onClick={() => onSelect(c.value)}
              style={{ ...swatchStyle(isActive, c.value, isNone), fontSize: 10, fontWeight: 700, color: 'var(--foreground)' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.18)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {/* Aa on highlight swatches; nothing on None — the diagonal line speaks for itself */}
              {!isNone && <span style={{ pointerEvents: 'none' }}>Aa</span>}
              {/* checkmark only on actual highlight colors, never on None */}
              {isActive && !isNone && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 5, backgroundColor: 'rgba(0,0,0,0.18)' }}>
                  <Check size={12} color="rgba(0,0,0,0.75)" />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
