'use client'
import { AlignLeft, FileText, CheckSquare, Trash2 } from 'lucide-react'
import { Note } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatRelative } from '@/lib/utils'

const TYPE_ICON  = { plain: AlignLeft, markdown: FileText, checklist: CheckSquare }
const TYPE_LABEL = { plain: 'Plain', markdown: 'Rich text', checklist: 'List' }
const TYPE_COLOR = { plain: '#6b6b88', markdown: '#7c6aff', checklist: '#10b981' }

/** Strip all HTML tags and decode basic entities → plain readable text */
function htmlToText(html: string): string {
  return html
    .replace(/<(h[1-6])[^>]*>(.*?)<\/\1>/gi, '$2 ')   // headings → text + space
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1 ')         // list items → bullets
    .replace(/<br\s*\/?>/gi, ' ')                        // line breaks → space
    .replace(/<[^>]+>/g, '')                             // strip remaining tags
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')                             // collapse whitespace
    .trim()
}

interface NoteCardProps {
  note: Note
  onClick: () => void
  onDelete: (id: string) => void
}

export function NoteCard({ note, onClick, onDelete }: NoteCardProps) {
  const Icon  = TYPE_ICON[note.type]
  const color = TYPE_COLOR[note.type]

  let preview = ''
  if (note.type === 'checklist') {
    const done  = note.checklist_items?.filter(i => i.checked).length ?? 0
    const total = note.checklist_items?.length ?? 0
    preview = `${done}/${total} items done`
  } else {
    const raw = htmlToText(note.content)
    preview = raw.length > 120 ? raw.slice(0, 120) + '…' : raw
  }

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: '#12121a', border: '1px solid #2a2a3e',
        borderRadius: 10, padding: '14px', cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c6aff44'; e.currentTarget.style.backgroundColor = '#13131e' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a3e'; e.currentTarget.style.backgroundColor = '#12121a' }}
      className="group"
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={12} color={color} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e8e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {note.title || 'Untitled'}
          </span>
        </div>
        <Button
          variant="ghost" size="icon"
          className="opacity-0 group-hover:opacity-100 h-6 w-6 flex-shrink-0"
          style={{ color: '#6b6b88' }}
          onClick={e => { e.stopPropagation(); onDelete(note.id) }}
          onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#6b6b88' }}
        >
          <Trash2 size={12} />
        </Button>
      </div>

      {/* Preview — clean readable text, no HTML */}
      {preview && (
        <p style={{
          fontSize: 12, color: '#6b6b88', lineHeight: 1.55, margin: 0,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        } as React.CSSProperties}>
          {preview}
        </p>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, fontWeight: 500, color, backgroundColor: color + '18', padding: '1px 6px', borderRadius: 99 }}>
            {TYPE_LABEL[note.type]}
          </span>
          {note.tags.slice(0, 2).map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
          ))}
          {note.tags.length > 2 && (
            <span style={{ fontSize: 10, color: '#6b6b88' }}>+{note.tags.length - 2}</span>
          )}
        </div>
        <span style={{ fontSize: 11, color: '#6b6b88', flexShrink: 0 }}>{formatRelative(note.updated_at)}</span>
      </div>
    </div>
  )
}
