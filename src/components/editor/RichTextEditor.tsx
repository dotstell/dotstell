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
import { useEffect, useCallback, useState, useRef } from 'react'
import {
  Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Quote, Minus, Table as TableIcon,
  Link as LinkIcon, Highlighter, Undo, Redo, Maximize2, Minimize2,
  AlignLeft, ChevronDown,
} from 'lucide-react'

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

const SLASH_COMMANDS = [
  { label: 'Heading 1',    icon: 'H1', desc: 'Large heading',      action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'Heading 2',    icon: 'H2', desc: 'Medium heading',     action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Heading 3',    icon: 'H3', desc: 'Small heading',      action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: 'Bullet list',  icon: '•',  desc: 'Unordered list',     action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().toggleBulletList().run() },
  { label: 'Numbered list',icon: '1.', desc: 'Ordered list',       action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().toggleOrderedList().run() },
  { label: 'Checklist',    icon: '☑', desc: 'Task list',           action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().toggleTaskList().run() },
  { label: 'Quote',        icon: '"',  desc: 'Blockquote',         action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().toggleBlockquote().run() },
  { label: 'Code block',   icon: '<>', desc: 'Code block',         action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().toggleCodeBlock().run() },
  { label: 'Divider',      icon: '—',  desc: 'Horizontal rule',    action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().setHorizontalRule().run() },
  { label: 'Table',        icon: '⊞', desc: '3×3 table',           action: (e: ReturnType<typeof useEditor>) => e?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
]

export function RichTextEditor({
  content, onChange, placeholder = 'Start writing... (type / for commands)',
  autoSaveStatus, wordCount, readingTime, onFocusMode, focusMode,
}: RichTextEditorProps) {
  const [slashOpen,    setSlashOpen]    = useState(false)
  const [slashFilter,  setSlashFilter]  = useState('')
  const [slashIdx,     setSlashIdx]     = useState(0)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkUrl,      setLinkUrl]      = useState('')
  const slashRef = useRef<HTMLDivElement>(null)

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
    ],
    content,
    editorProps: {
      attributes: { class: 'tiptap-editor' },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())

      // Slash command detection
      const { state } = editor
      const { selection } = state
      const { $from } = selection
      const textBefore = $from.nodeBefore?.text ?? ''
      const lineText = $from.parent.textContent.slice(0, selection.from - $from.start())

      if (lineText.endsWith('/') || (lineText.includes('/') && !lineText.includes(' '))) {
        const afterSlash = lineText.split('/').pop() ?? ''
        setSlashFilter(afterSlash)
        setSlashOpen(true)
        setSlashIdx(0)
      } else {
        setSlashOpen(false)
      }
    },
  })

  // Sync content if changed externally
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  const filteredCommands = SLASH_COMMANDS.filter(c =>
    c.label.toLowerCase().includes(slashFilter.toLowerCase())
  )

  function applySlashCommand(cmd: typeof SLASH_COMMANDS[0]) {
    if (!editor) return
    // Delete the slash + filter text
    const { from } = editor.state.selection
    const deleteCount = slashFilter.length + 1 // +1 for the /
    editor.chain().focus().deleteRange({ from: from - deleteCount, to: from }).run()
    cmd.action(editor)
    setSlashOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!slashOpen) return
    if (e.key === 'ArrowDown')  { e.preventDefault(); setSlashIdx(i => Math.min(i + 1, filteredCommands.length - 1)) }
    if (e.key === 'ArrowUp')    { e.preventDefault(); setSlashIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter')      { e.preventDefault(); if (filteredCommands[slashIdx]) applySlashCommand(filteredCommands[slashIdx]) }
    if (e.key === 'Escape')     { setSlashOpen(false) }
  }

  function setLink() {
    if (!editor) return
    if (linkUrl) editor.chain().focus().setLink({ href: linkUrl }).run()
    else editor.chain().focus().unsetLink().run()
    setLinkDialogOpen(false)
    setLinkUrl('')
  }

  const stats = editor ? {
    words: editor.storage.characterCount?.words() ?? 0,
    chars: editor.storage.characterCount?.characters() ?? 0,
    readTime: Math.max(1, Math.round((editor.storage.characterCount?.words() ?? 0) / 200)),
  } : null

  if (!editor) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, position: 'relative' }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
        padding: '6px 10px', borderBottom: '1px solid #2a2a3e',
        backgroundColor: '#12121a', position: 'sticky', top: 0, zIndex: 10,
      }}>
        {/* Undo/Redo */}
        <ToolbarGroup>
          <ToolBtn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo ⌘Z"><Undo size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo ⌘⇧Z"><Redo size={14} /></ToolBtn>
        </ToolbarGroup>

        <Divider />

        {/* Headings dropdown */}
        <HeadingDropdown editor={editor} />

        <Divider />

        {/* Text formatting */}
        <ToolbarGroup>
          <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold ⌘B"><Bold size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic ⌘I"><Italic size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><Strikethrough size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code"><Code size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight"><Highlighter size={14} /></ToolBtn>
        </ToolbarGroup>

        <Divider />

        {/* Lists */}
        <ToolbarGroup>
          <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list"><List size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list"><ListOrdered size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Checklist"><CheckSquare size={14} /></ToolBtn>
        </ToolbarGroup>

        <Divider />

        {/* Blocks */}
        <ToolbarGroup>
          <ToolBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Quote"><Quote size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block"><Code size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider"><Minus size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Table"><TableIcon size={14} /></ToolBtn>
        </ToolbarGroup>

        <Divider />

        {/* Link */}
        <ToolBtn
          onClick={() => { setLinkUrl(editor.getAttributes('link').href ?? ''); setLinkDialogOpen(true) }}
          active={editor.isActive('link')} title="Link"
        ><LinkIcon size={14} /></ToolBtn>

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

        {/* Slash command menu */}
        {slashOpen && filteredCommands.length > 0 && (
          <div ref={slashRef} style={{
            position: 'absolute', left: 20, top: 60, zIndex: 100,
            backgroundColor: '#12121a', border: '1px solid #3a3a5e',
            borderRadius: 10, padding: 4, width: 240,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            <p style={{ fontSize: 10, color: '#3a3a5e', padding: '4px 8px 6px', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Commands</p>
            {filteredCommands.map((cmd, i) => (
              <button
                key={cmd.label}
                type="button"
                onMouseDown={e => { e.preventDefault(); applySlashCommand(cmd) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  backgroundColor: i === slashIdx ? 'rgba(124,106,255,0.15)' : 'transparent',
                  textAlign: 'left',
                }}
                onMouseEnter={() => setSlashIdx(i)}
              >
                <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: '#1e1e2e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#7c6aff' }}>
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

        {/* Link dialog */}
        {linkDialogOpen && (
          <div style={{
            position: 'absolute', left: '50%', top: 40, transform: 'translateX(-50%)', zIndex: 100,
            backgroundColor: '#12121a', border: '1px solid #3a3a5e',
            borderRadius: 10, padding: 16, width: 320,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }}>
            <p style={{ fontSize: 12, color: '#a0a0b8', margin: '0 0 8px' }}>Insert link</p>
            <input
              autoFocus
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setLink(); if (e.key === 'Escape') setLinkDialogOpen(false) }}
              placeholder="https://..."
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 7,
                border: '1px solid #3a3a5e', backgroundColor: '#1a1a28',
                color: '#e8e8f0', fontSize: 13, outline: 'none', marginBottom: 10,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={setLink} style={{ flex: 1, padding: '7px', borderRadius: 7, backgroundColor: '#7c6aff', border: 'none', color: 'white', fontSize: 13, cursor: 'pointer' }}>Apply</button>
              <button type="button" onClick={() => setLinkDialogOpen(false)} style={{ flex: 1, padding: '7px', borderRadius: 7, backgroundColor: '#1e1e2e', border: '1px solid #2a2a3e', color: '#a0a0b8', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer: stats + autosave ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 12px', borderTop: '1px solid #2a2a3e',
        backgroundColor: '#0e0e16',
      }}>
        <div style={{ display: 'flex', gap: 14 }}>
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
            {autoSaveStatus === 'saved' ? '✓ Saved' : autoSaveStatus === 'saving' ? '⟳ Saving...' : '● Unsaved'}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Small reusable toolbar pieces ──────────────────────────
function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 1 }}>{children}</div>
}

function Divider() {
  return <div style={{ width: 1, height: 20, backgroundColor: '#2a2a3e', margin: '0 4px' }} />
}

function ToolBtn({ onClick, active, disabled, title, children }: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 6, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: active ? 'rgba(124,106,255,0.2)' : 'transparent',
        color: active ? '#7c6aff' : disabled ? '#3a3a5e' : '#a0a0b8',
        transition: 'all 0.1s',
      }}
      onMouseEnter={e => { if (!active && !disabled) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = 'transparent' }}
    >
      {children}
    </button>
  )
}

function HeadingDropdown({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [open, setOpen] = useState(false)
  if (!editor) return null

  const current = editor.isActive('heading', { level: 1 }) ? 'H1'
    : editor.isActive('heading', { level: 2 }) ? 'H2'
    : editor.isActive('heading', { level: 3 }) ? 'H3'
    : 'Text'

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 8px', borderRadius: 6, border: '1px solid #2a2a3e',
          backgroundColor: 'transparent', color: '#a0a0b8', fontSize: 12,
          cursor: 'pointer', minWidth: 68,
        }}
      >
        {current} <ChevronDown size={11} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
          backgroundColor: '#12121a', border: '1px solid #2a2a3e',
          borderRadius: 8, padding: 4, minWidth: 120,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          {[
            { label: 'Normal text', action: () => editor.chain().focus().setParagraph().run(), style: { fontSize: 13 } },
            { label: 'Heading 1',   action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), style: { fontSize: 18, fontWeight: 700 } },
            { label: 'Heading 2',   action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), style: { fontSize: 15, fontWeight: 700 } },
            { label: 'Heading 3',   action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), style: { fontSize: 13, fontWeight: 700 } },
          ].map(item => (
            <button key={item.label} type="button" onClick={() => { item.action(); setOpen(false) }} style={{
              width: '100%', padding: '6px 10px', borderRadius: 6, border: 'none',
              backgroundColor: 'transparent', color: '#e8e8f0', cursor: 'pointer',
              textAlign: 'left', ...item.style,
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
