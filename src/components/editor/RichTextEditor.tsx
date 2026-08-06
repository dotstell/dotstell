'use client'
import { useEditor, EditorContent } from '@tiptap/react'
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
import { useEffect, useCallback, useState, useRef } from 'react'
import {
  Bold, Italic, Strikethrough, Code, Underline as UnderlineIcon,
  Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Quote, Minus, Table as TableIcon,
  Link as LinkIcon, Highlighter, Undo, Redo, Maximize2, Minimize2,
  ChevronDown, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Superscript as SuperscriptIcon, Subscript as SubscriptIcon,
  Image as ImageIcon, Type, Palette, RotateCcw,
} from 'lucide-react'

const lowlight = createLowlight(common)

// ── Colour palettes ─────────────────────────────────────────
const TEXT_COLORS = [
  { label: 'Default',    value: '' },
  { label: 'Purple',     value: '#a594ff' },
  { label: 'Blue',       value: '#60a5fa' },
  { label: 'Cyan',       value: '#22d3ee' },
  { label: 'Green',      value: '#34d399' },
  { label: 'Yellow',     value: '#fbbf24' },
  { label: 'Orange',     value: '#fb923c' },
  { label: 'Red',        value: '#f87171' },
  { label: 'Pink',       value: '#f472b6' },
  { label: 'Gray',       value: '#9ca3af' },
]

const HIGHLIGHT_COLORS = [
  { label: 'Yellow',  value: 'rgba(251,191,36,0.3)',   dot: '#fbbf24' },
  { label: 'Purple',  value: 'rgba(124,106,255,0.3)',  dot: '#7c6aff' },
  { label: 'Blue',    value: 'rgba(96,165,250,0.3)',   dot: '#60a5fa' },
  { label: 'Green',   value: 'rgba(52,211,153,0.3)',   dot: '#34d399' },
  { label: 'Pink',    value: 'rgba(244,114,182,0.3)',  dot: '#f472b6' },
  { label: 'Orange',  value: 'rgba(251,146,60,0.3)',   dot: '#fb923c' },
  { label: 'Red',     value: 'rgba(248,113,113,0.3)',  dot: '#f87171' },
  { label: 'None',    value: '',                        dot: '' },
]

const FONT_FAMILIES = [
  { label: 'Default',    value: '' },
  { label: 'Sans-serif', value: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { label: 'Serif',      value: 'Georgia, "Times New Roman", serif' },
  { label: 'Mono',       value: '"JetBrains Mono", "Fira Code", monospace' },
]

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

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  autoSaveStatus?: 'saved' | 'saving' | 'unsaved' | null
  wordCount?: number
  readingTime?: number
  onFocusMode?: (active: boolean) => void
  focusMode?: boolean
}

export function RichTextEditor({
  content, onChange, placeholder = 'Start writing… (type / for commands)',
  autoSaveStatus, onFocusMode, focusMode,
}: RichTextEditorProps) {
  const [slashOpen,       setSlashOpen]       = useState(false)
  const [slashFilter,     setSlashFilter]     = useState('')
  const [slashIdx,        setSlashIdx]        = useState(0)
  const [linkDialogOpen,  setLinkDialogOpen]  = useState(false)
  const [linkUrl,         setLinkUrl]         = useState('')
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [hlPickerOpen,    setHlPickerOpen]    = useState(false)
  const [fontMenuOpen,    setFontMenuOpen]    = useState(false)
  const [imageDialogOpen, setImageDialogOpen] = useState(false)
  const [imageUrl,        setImageUrl]        = useState('')
  const colorRef  = useRef<HTMLDivElement>(null)
  const hlRef     = useRef<HTMLDivElement>(null)
  const fontRef   = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
      Highlight.configure({ multicolor: true }),
      Typography,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'tiptap-link' } }),
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
    ],
    content,
    editorProps: {
      attributes: { class: 'tiptap-editor' },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())

      // Slash command detection
      const { selection } = editor.state
      const { $from } = selection
      const lineText = $from.parent.textContent.slice(0, selection.from - $from.start())

      if (lineText.endsWith('/') || (lineText.includes('/') && !lineText.includes(' '))) {
        setSlashFilter(lineText.split('/').pop() ?? '')
        setSlashOpen(true)
        setSlashIdx(0)
      } else {
        setSlashOpen(false)
      }
    },
  })

  // Close floating menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (colorPickerOpen && colorRef.current && !colorRef.current.contains(e.target as Node)) setColorPickerOpen(false)
      if (hlPickerOpen    && hlRef.current    && !hlRef.current.contains(e.target as Node))    setHlPickerOpen(false)
      if (fontMenuOpen    && fontRef.current  && !fontRef.current.contains(e.target as Node))  setFontMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [colorPickerOpen, hlPickerOpen, fontMenuOpen])

  // Sync external content
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!slashOpen) return
    if (e.key === 'ArrowDown')  { e.preventDefault(); setSlashIdx(i => Math.min(i + 1, flatFiltered.length - 1)) }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setSlashIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter')      { e.preventDefault(); if (flatFiltered[slashIdx]) applySlashCommand(flatFiltered[slashIdx]) }
    if (e.key === 'Escape')     { setSlashOpen(false) }
  }

  function setLink() {
    if (!editor) return
    if (linkUrl) editor.chain().focus().setLink({ href: linkUrl }).run()
    else editor.chain().focus().unsetLink().run()
    setLinkDialogOpen(false)
    setLinkUrl('')
  }

  function insertImage() {
    if (!editor || !imageUrl) return
    editor.chain().focus().setImage({ src: imageUrl }).run()
    setImageDialogOpen(false)
    setImageUrl('')
  }

  const stats = editor ? {
    words:    editor.storage.characterCount?.words() ?? 0,
    chars:    editor.storage.characterCount?.characters() ?? 0,
    readTime: Math.max(1, Math.round((editor.storage.characterCount?.words() ?? 0) / 200)),
  } : null

  const activeColor = editor?.getAttributes('textStyle')?.color ?? ''

  if (!editor) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
        padding: '5px 10px', borderBottom: '1px solid #2a2a3e',
        backgroundColor: '#0e0e18', position: 'sticky', top: 0, zIndex: 20,
        rowGap: 4,
      }}>

        {/* Undo / Redo */}
        <ToolbarGroup>
          <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo ⌘Z"><Undo size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo ⌘⇧Z"><Redo size={14} /></ToolBtn>
        </ToolbarGroup>

        <Divider />

        {/* Heading + font */}
        <HeadingDropdown editor={editor} />
        <FontDropdown editor={editor} open={fontMenuOpen} setOpen={setFontMenuOpen} ref={fontRef} />

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
            onClick={() => { setColorPickerOpen(o => !o); setHlPickerOpen(false) }}
            style={{
              width: 28, height: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 1, borderRadius: 6, border: 'none', cursor: 'pointer', backgroundColor: 'transparent',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Type size={13} color={activeColor || '#a0a0b8'} />
            <div style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: activeColor || '#a0a0b8' }} />
          </button>
          {colorPickerOpen && (
            <ColorPicker
              colors={TEXT_COLORS}
              activeValue={activeColor}
              onSelect={v => {
                if (v) editor.chain().focus().setColor(v).run()
                else editor.chain().focus().unsetColor().run()
                setColorPickerOpen(false)
              }}
              onReset={() => { editor.chain().focus().unsetColor().run(); setColorPickerOpen(false) }}
            />
          )}
        </div>

        {/* Highlight colour picker */}
        <div ref={hlRef} style={{ position: 'relative' }}>
          <button
            type="button"
            title="Highlight color"
            onClick={() => { setHlPickerOpen(o => !o); setColorPickerOpen(false) }}
            style={{
              width: 28, height: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 1, borderRadius: 6, border: 'none', cursor: 'pointer',
              backgroundColor: editor.isActive('highlight') ? 'rgba(124,106,255,0.2)' : 'transparent',
            }}
            onMouseEnter={e => { if (!editor.isActive('highlight')) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
            onMouseLeave={e => { if (!editor.isActive('highlight')) e.currentTarget.style.backgroundColor = 'transparent' }}
          >
            <Highlighter size={13} color={editor.isActive('highlight') ? '#7c6aff' : '#a0a0b8'} />
            <div style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: editor.getAttributes('highlight').color || (editor.isActive('highlight') ? '#fbbf24' : '#a0a0b8') }} />
          </button>
          {hlPickerOpen && (
            <HighlightPicker
              colors={HIGHLIGHT_COLORS}
              editor={editor}
              onSelect={v => {
                if (v) editor.chain().focus().setHighlight({ color: v }).run()
                else editor.chain().focus().unsetHighlight().run()
                setHlPickerOpen(false)
              }}
            />
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

        {/* Spacer + focus mode */}
        <div style={{ flex: 1 }} />
        {onFocusMode && (
          <ToolBtn onClick={() => onFocusMode(!focusMode)} title={focusMode ? 'Exit focus mode' : 'Focus mode'}>
            {focusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </ToolBtn>
        )}
      </div>

      {/* ── Editor area ── */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative', minHeight: 0 }} onKeyDown={handleKeyDown}>
        <EditorContent editor={editor} style={{ height: '100%' }} />

        {/* ── Slash command menu ── */}
        {slashOpen && flatFiltered.length > 0 && (
          <div style={{
            position: 'absolute', left: 20, top: 60, zIndex: 100,
            backgroundColor: '#12121a', border: '1px solid #3a3a5e',
            borderRadius: 12, padding: 6, width: 260,
            boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            maxHeight: 360, overflowY: 'auto',
          }}>
            <p style={{ fontSize: 10, color: '#3a3a5e', padding: '4px 8px 6px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Blocks</p>
            {flatFiltered.map((cmd, i) => (
              <button
                key={cmd.label}
                type="button"
                onMouseDown={e => { e.preventDefault(); applySlashCommand(cmd) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  backgroundColor: i === slashIdx ? 'rgba(124,106,255,0.15)' : 'transparent',
                  textAlign: 'left',
                }}
                onMouseEnter={() => setSlashIdx(i)}
              >
                <div style={{
                  width: 30, height: 30, borderRadius: 7,
                  backgroundColor: i === slashIdx ? 'rgba(124,106,255,0.2)' : '#1e1e2e',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 13, fontWeight: 700, color: '#7c6aff',
                }}>
                  {cmd.icon}
                </div>
                <div>
                  <p style={{ fontSize: 13, color: '#e8e8f0', margin: 0 }}>{cmd.label}</p>
                  <p style={{ fontSize: 11, color: '#6b6b88', margin: 0 }}>{cmd.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Link dialog ── */}
        {linkDialogOpen && (
          <FloatingDialog onClose={() => setLinkDialogOpen(false)} title="Insert link">
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
          <FloatingDialog onClose={() => setImageDialogOpen(false)} title="Insert image">
            <input
              autoFocus
              value={imageUrl}
              onChange={e => setImageUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') insertImage(); if (e.key === 'Escape') setImageDialogOpen(false) }}
              placeholder="https://... (image URL)"
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={insertImage} style={primaryBtnStyle}>Insert</button>
              <button type="button" onClick={() => setImageDialogOpen(false)} style={secondaryBtnStyle}>Cancel</button>
            </div>
          </FloatingDialog>
        )}
      </div>

      {/* ── Footer: stats + autosave ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 14px', borderTop: '1px solid #1e1e2e',
        backgroundColor: '#0a0a12', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {stats && (
            <>
              <span style={{ fontSize: 11, color: '#3a3a5e' }}>{stats.words} words</span>
              <span style={{ fontSize: 11, color: '#3a3a5e' }}>{stats.chars} chars</span>
              <span style={{ fontSize: 11, color: '#3a3a5e' }}>~{stats.readTime} min read</span>
            </>
          )}
        </div>
        {autoSaveStatus && (
          <span style={{
            fontSize: 11,
            color: autoSaveStatus === 'saved' ? '#10b981' : autoSaveStatus === 'saving' ? '#7c6aff' : '#6b6b88',
          }}>
            {autoSaveStatus === 'saved' ? '✓ Saved' : autoSaveStatus === 'saving' ? '⟳ Saving…' : '● Unsaved'}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Shared dialog styles ─────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 7,
  border: '1px solid #3a3a5e', backgroundColor: '#1a1a28',
  color: '#e8e8f0', fontSize: 13, outline: 'none', marginBottom: 10,
}
const primaryBtnStyle: React.CSSProperties = {
  flex: 1, padding: '7px', borderRadius: 7, backgroundColor: '#7c6aff',
  border: 'none', color: 'white', fontSize: 13, cursor: 'pointer',
}
const secondaryBtnStyle: React.CSSProperties = {
  flex: 1, padding: '7px', borderRadius: 7, backgroundColor: '#1e1e2e',
  border: '1px solid #2a2a3e', color: '#a0a0b8', fontSize: 13, cursor: 'pointer',
}
const dangerBtnStyle: React.CSSProperties = {
  flex: 1, padding: '7px', borderRadius: 7, backgroundColor: 'rgba(239,68,68,0.15)',
  border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: 13, cursor: 'pointer',
}

// ── Sub-components ───────────────────────────────────────────
function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 1 }}>{children}</div>
}

function Divider() {
  return <div style={{ width: 1, height: 20, backgroundColor: '#2a2a3e', margin: '0 4px', flexShrink: 0 }} />
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
        backgroundColor: active ? 'rgba(124,106,255,0.2)' : 'transparent',
        color: active ? '#7c6aff' : disabled ? '#3a3a5e' : '#a0a0b8',
        transition: 'all 0.1s', flexShrink: 0,
      }}
      onMouseEnter={e => { if (!active && !disabled) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      {children}
    </button>
  )
}

function FloatingDialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{
      position: 'absolute', left: '50%', top: 50, transform: 'translateX(-50%)', zIndex: 200,
      backgroundColor: '#12121a', border: '1px solid #3a3a5e',
      borderRadius: 12, padding: 18, width: 340,
      boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
    }}>
      <p style={{ fontSize: 12, color: '#a0a0b8', margin: '0 0 10px', fontWeight: 600 }}>{title}</p>
      {children}
    </div>
  )
}

function HeadingDropdown({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false)
  if (!editor) return null

  const current = editor.isActive('heading', { level: 1 }) ? 'Heading 1'
    : editor.isActive('heading', { level: 2 }) ? 'Heading 2'
    : editor.isActive('heading', { level: 3 }) ? 'Heading 3'
    : 'Normal'

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 8px', borderRadius: 6, border: '1px solid #2a2a3e',
          backgroundColor: 'transparent', color: '#a0a0b8', fontSize: 12,
          cursor: 'pointer', minWidth: 82, whiteSpace: 'nowrap',
        }}
      >
        {current} <ChevronDown size={11} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4,
          backgroundColor: '#12121a', border: '1px solid #2a2a3e',
          borderRadius: 10, padding: 4, minWidth: 140,
          boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
        }}>
          {[
            { label: 'Normal',    fs: 13, fw: 400, action: () => editor.chain().focus().setParagraph().run() },
            { label: 'Heading 1', fs: 20, fw: 700, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
            { label: 'Heading 2', fs: 16, fw: 700, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
            { label: 'Heading 3', fs: 14, fw: 600, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
          ].map(item => (
            <button key={item.label} type="button" onClick={() => { item.action(); setOpen(false) }} style={{
              width: '100%', padding: '7px 10px', borderRadius: 7, border: 'none',
              backgroundColor: 'transparent', color: '#e8e8f0', cursor: 'pointer',
              textAlign: 'left', fontSize: item.fs, fontWeight: item.fw,
            }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(124,106,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >{item.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function FontDropdown({ editor, open, setOpen, ref }: {
  editor: ReturnType<typeof useEditor>; open: boolean; setOpen: (v: boolean) => void; ref: React.RefObject<HTMLDivElement>
}) {
  if (!editor) return null
  const currentFont = editor.getAttributes('textStyle').fontFamily ?? ''
  const currentLabel = FONT_FAMILIES.find(f => f.value === currentFont)?.label ?? 'Default'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 8px', borderRadius: 6, border: '1px solid #2a2a3e',
          backgroundColor: 'transparent', color: '#a0a0b8', fontSize: 12,
          cursor: 'pointer', minWidth: 70, whiteSpace: 'nowrap',
        }}
      >
        {currentLabel} <ChevronDown size={11} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4,
          backgroundColor: '#12121a', border: '1px solid #2a2a3e',
          borderRadius: 10, padding: 4, minWidth: 160,
          boxShadow: '0 8px 28px rgba(0,0,0,0.5)',
        }}>
          {FONT_FAMILIES.map(f => (
            <button key={f.label} type="button" onClick={() => {
              if (f.value) editor.chain().focus().setFontFamily(f.value).run()
              else editor.chain().focus().unsetFontFamily().run()
              setOpen(false)
            }} style={{
              width: '100%', padding: '7px 10px', borderRadius: 7, border: 'none',
              backgroundColor: 'transparent', color: '#e8e8f0', cursor: 'pointer',
              textAlign: 'left', fontSize: 13, fontFamily: f.value || 'inherit',
            }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(124,106,255,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >{f.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function ColorPicker({ colors, activeValue, onSelect, onReset }: {
  colors: { label: string; value: string }[]
  activeValue: string
  onSelect: (v: string) => void
  onReset: () => void
}) {
  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4,
      backgroundColor: '#12121a', border: '1px solid #2a2a3e',
      borderRadius: 10, padding: 10, width: 200,
      boxShadow: '0 8px 28px rgba(0,0,0,0.6)',
    }}>
      <p style={{ fontSize: 10, color: '#3a3a5e', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Text color</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
        {colors.map(c => (
          <button
            key={c.label}
            type="button"
            title={c.label}
            onClick={() => onSelect(c.value)}
            style={{
              width: 28, height: 28, borderRadius: 6, border: activeValue === c.value ? '2px solid #7c6aff' : '2px solid transparent',
              backgroundColor: c.value || '#3a3a5e',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {!c.value && <span style={{ fontSize: 10, color: '#a0a0b8' }}>A</span>}
          </button>
        ))}
      </div>
      <button type="button" onClick={onReset} style={{
        marginTop: 8, width: '100%', padding: '5px', borderRadius: 6,
        backgroundColor: '#1a1a28', border: '1px solid #2a2a3e', color: '#6b6b88',
        fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
        <RotateCcw size={10} /> Reset color
      </button>
    </div>
  )
}

function HighlightPicker({ colors, editor, onSelect }: {
  colors: { label: string; value: string; dot: string }[]
  editor: ReturnType<typeof useEditor>
  onSelect: (v: string) => void
}) {
  return (
    <div style={{
      position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 4,
      backgroundColor: '#12121a', border: '1px solid #2a2a3e',
      borderRadius: 10, padding: 10, width: 200,
      boxShadow: '0 8px 28px rgba(0,0,0,0.6)',
    }}>
      <p style={{ fontSize: 10, color: '#3a3a5e', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Highlight color</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
        {colors.map(c => {
          const isActive = c.value ? editor.isActive('highlight', { color: c.value }) : false
          return (
            <button
              key={c.label}
              type="button"
              title={c.label}
              onClick={() => onSelect(c.value)}
              style={{
                height: 28, borderRadius: 6, border: isActive ? '2px solid #7c6aff' : '2px solid transparent',
                backgroundColor: c.value || '#1e1e2e',
                cursor: 'pointer', fontSize: 11, color: '#e8e8f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '0 6px',
              }}
            >
              {c.dot ? <span style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: c.dot, display: 'inline-block', flexShrink: 0 }} /> : null}
              {!c.value ? <span style={{ fontSize: 10, color: '#6b6b88' }}>None</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
