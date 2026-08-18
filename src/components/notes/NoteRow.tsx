'use client'
import { AlignLeft, FileText, CheckSquare, Trash2, GitBranch, Pin } from 'lucide-react'
import { Note } from '@/types'
import { formatRelative } from '@/lib/utils'

const TYPE_ICON  = { plain: AlignLeft, markdown: FileText, checklist: CheckSquare }
const TYPE_LABEL = { plain: 'Plain', markdown: 'Rich text', checklist: 'List' }
const TYPE_COLOR = { plain: 'var(--muted-foreground)', markdown: 'var(--primary)', checklist: '#10b981' }

function htmlToText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ').trim()
}

interface NoteRowProps {
  note: Note
  onClick: () => void
  onDelete: (id: string) => void
  onContextMenu?: (e: React.MouseEvent) => void
  onPin?: () => void
}

export function NoteRow({ note, onClick, onDelete, onContextMenu, onPin }: NoteRowProps) {
  const Icon  = TYPE_ICON[note.type]
  const color = TYPE_COLOR[note.type]

  const preview = note.type === 'checklist'
    ? `${note.checklist_items?.filter(i => i.checked).length ?? 0}/${note.checklist_items?.length ?? 0} items done`
    : htmlToText(note.content).slice(0, 80) || ''

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      role="button"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', borderRadius: 9,
        cursor: 'pointer', transition: 'background 0.12s',
        backgroundColor: note.pinned ? 'color-mix(in srgb, var(--primary) 5%, transparent)' : 'transparent',
        borderLeft: note.pinned ? '2px solid var(--primary)' : '2px solid transparent',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = 'var(--card)'
        const btn = e.currentTarget.querySelector<HTMLElement>('.delete-btn')
        if (btn) btn.style.opacity = '1'
        const pinBtn = e.currentTarget.querySelector<HTMLElement>('.pin-btn')
        if (pinBtn) pinBtn.style.opacity = '1'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = note.pinned ? 'color-mix(in srgb, var(--primary) 5%, transparent)' : 'transparent'
        const btn = e.currentTarget.querySelector<HTMLElement>('.delete-btn')
        if (btn) btn.style.opacity = '0'
        const pinBtn = e.currentTarget.querySelector<HTMLElement>('.pin-btn')
        if (pinBtn) pinBtn.style.opacity = '0'
      }}
    >
      <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, backgroundColor: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} style={{ color }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {note.title || 'Untitled'}
          </p>
          {note.pinned && <Pin size={11} style={{ color: 'var(--primary)', flexShrink: 0 }} />}
        </div>
        {preview && (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {preview}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
        {note.tags?.filter(t => !t.startsWith('nb:')).slice(0, 3).map(tag => (
          <span key={tag} style={{ fontSize: 10, color: 'var(--primary)', backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)', padding: '2px 7px', borderRadius: 99 }}>
            {tag}
          </span>
        ))}
        {(note.tags?.filter(t => !t.startsWith('nb:')).length ?? 0) > 3 && (
          <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>+{note.tags.filter(t => !t.startsWith('nb:')).length - 3}</span>
        )}
        {(note.sub_notes_count ?? 0) > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--muted-foreground)', backgroundColor: 'var(--muted)', padding: '2px 7px', borderRadius: 99 }}>
            <GitBranch size={9} /> {note.sub_notes_count}
          </span>
        )}
      </div>

      <span style={{ fontSize: 10, color, backgroundColor: color + '18', padding: '2px 8px', borderRadius: 99, flexShrink: 0 }}>
        {TYPE_LABEL[note.type]}
      </span>

      <span style={{ fontSize: 11, color: 'var(--muted-foreground)', flexShrink: 0, minWidth: 72, textAlign: 'right' }}>
        {formatRelative(note.updated_at)}
      </span>

      {onPin && (
        <button
          type="button"
          className="pin-btn"
          onClick={e => { e.stopPropagation(); onPin() }}
          title={note.pinned ? 'Unpin' : 'Pin'}
          style={{
            opacity: 0, transition: 'opacity 0.15s', background: 'none', border: 'none',
            cursor: 'pointer', color: note.pinned ? 'var(--primary)' : 'var(--muted-foreground)',
            padding: '2px', borderRadius: 5, flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = note.pinned ? 'var(--primary)' : 'var(--muted-foreground)')}
        >
          <Pin size={13} />
        </button>
      )}

      <button
        type="button"
        className="delete-btn"
        onClick={e => { e.stopPropagation(); onDelete(note.id) }}
        style={{
          opacity: 0, transition: 'opacity 0.15s', background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--muted-foreground)', padding: '2px', borderRadius: 5, flexShrink: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--destructive)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}
