'use client'
import { FileText, AlignLeft, CheckSquare, Trash2, ExternalLink } from 'lucide-react'
import { Note } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatRelative, truncate } from '@/lib/utils'

const TYPE_ICON = {
  plain: AlignLeft,
  markdown: FileText,
  checklist: CheckSquare,
}

interface NoteCardProps {
  note: Note
  onClick: () => void
  onDelete: (id: string) => void
}

export function NoteCard({ note, onClick, onDelete }: NoteCardProps) {
  const Icon = TYPE_ICON[note.type]

  const preview = note.type === 'checklist'
    ? `${note.checklist_items?.filter(i => i.checked).length ?? 0}/${note.checklist_items?.length ?? 0} done`
    : truncate(note.content.replace(/[#*`>\-]/g, '').trim(), 80)

  return (
    <div
      onClick={onClick}
      className="group bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 cursor-pointer hover:border-[var(--primary)]/40 hover:bg-[var(--card)] transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={14} className="text-[var(--muted-foreground)] flex-shrink-0" />
          <h3 className="text-sm font-medium truncate">{note.title || 'Untitled'}</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 h-6 w-6 text-[var(--muted-foreground)] hover:text-[var(--destructive)] flex-shrink-0"
          onClick={e => { e.stopPropagation(); onDelete(note.id) }}
        >
          <Trash2 size={12} />
        </Button>
      </div>

      {preview && (
        <p className="text-xs text-[var(--muted-foreground)] mb-3 line-clamp-2">{preview}</p>
      )}

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {note.tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
          ))}
        </div>
        <span className="text-xs text-[var(--muted-foreground)]">{formatRelative(note.updated_at)}</span>
      </div>
    </div>
  )
}
