'use client'
import { AlignLeft, FileText, CheckSquare, Trash2 } from 'lucide-react'
import { Note } from '@/types'
import { formatRelative } from '@/lib/utils'

const TYPE_ICON  = { plain: AlignLeft, markdown: FileText, checklist: CheckSquare }
const TYPE_LABEL = { plain: 'Plain', markdown: 'Rich text', checklist: 'List' }
const TYPE_COLOR = { plain: '#6b6b88', markdown: '#7c6aff', checklist: '#10b981' }

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
}

export function NoteRow({ note, onClick, onDelete }: NoteRowProps) {
  const Icon  = TYPE_ICON[note.type]
  const color = TYPE_COLOR[note.type]

  const preview = note.type === 'checklist'
    ? `${note.checklist_items?.filter(i => i.checked).length ?? 0}/${note.checklist_items?.length ?? 0} items done`
    : htmlToText(note.content).slice(0, 80) || ''

  return (
    <div
      onClick={onClick}
      role="button"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', borderRadius: 9,
        cursor: 'pointer', transition: 'background 0.12s',
        backgroundColor: 'transparent',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = '#12121a'
        const btn = e.currentTarget.querySelector<HTMLElement>('.delete-btn')
        if (btn) btn.style.opacity = '1'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'transparent'
        const btn = e.currentTarget.querySelector<HTMLElement>('.delete-btn')
        if (btn) btn.style.opacity = '0'
      }}
    >
      {/* Icon */}
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        backgroundColor: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={14} color={color} />
      </div>

      {/* Title + preview */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#e8e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {note.title || 'Untitled'}
        </p>
        {preview && (
          <p style={{ margin: 0, fontSize: 12, color: '#6b6b88', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {preview}
          </p>
        )}
      </div>

      {/* Tags */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {note.tags?.slice(0, 3).map(tag => (
          <span key={tag} style={{ fontSize: 10, color: '#7c6aff', backgroundColor: '#7c6aff18', padding: '2px 7px', borderRadius: 99 }}>
            {tag}
          </span>
        ))}
        {(note.tags?.length ?? 0) > 3 && (
          <span style={{ fontSize: 10, color: '#6b6b88' }}>+{note.tags.length - 3}</span>
        )}
      </div>

      {/* Type badge */}
      <span style={{ fontSize: 10, color, backgroundColor: color + '18', padding: '2px 8px', borderRadius: 99, flexShrink: 0 }}>
        {TYPE_LABEL[note.type]}
      </span>

      {/* Date */}
      <span style={{ fontSize: 11, color: '#6b6b88', flexShrink: 0, minWidth: 72, textAlign: 'right' }}>
        {formatRelative(note.updated_at)}
      </span>

      {/* Delete */}
      <button
        type="button"
        className="delete-btn"
        onClick={e => { e.stopPropagation(); onDelete(note.id) }}
        style={{
          opacity: 0, transition: 'opacity 0.15s', background: 'none', border: 'none',
          cursor: 'pointer', color: '#6b6b88', padding: '2px', borderRadius: 5, flexShrink: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
        onMouseLeave={e => (e.currentTarget.style.color = '#6b6b88')}
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}
