'use client'
import { useState, useCallback, useRef } from 'react'
import { Plus, Trash2, Check, AtSign } from 'lucide-react'
import dynamic from 'next/dynamic'
import { Note, NoteType, ChecklistItem } from '@/types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { generateId } from '@/lib/utils'
import { useMention } from '@/hooks/useMention'
import { LinkPanel } from '@/components/links/LinkPanel'

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

interface NoteEditorProps {
  note: Partial<Note>
  onChange: (updates: Partial<Note>) => void
}

const TYPE_TABS: { value: NoteType; label: string }[] = [
  { value: 'plain', label: 'Plain' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'checklist', label: 'Checklist' },
]

export function NoteEditor({ note, onChange }: NoteEditorProps) {
  const [tagInput, setTagInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { suggestions, selectedIdx, pickSuggestion, handleKeyDown: mentionKeyDown, active: mentionActive } = useMention(
    note.content ?? '',
    (updated) => onChange({ content: updated })
  )

  const addTag = useCallback(() => {
    const tag = tagInput.trim().toLowerCase()
    if (!tag || note.tags?.includes(tag)) return
    onChange({ tags: [...(note.tags ?? []), tag] })
    setTagInput('')
  }, [tagInput, note.tags, onChange])

  const removeTag = useCallback((tag: string) => {
    onChange({ tags: note.tags?.filter(t => t !== tag) ?? [] })
  }, [note.tags, onChange])

  const addCheckItem = useCallback(() => {
    const items = note.checklist_items ?? []
    onChange({ checklist_items: [...items, { id: generateId(), text: '', checked: false }] })
  }, [note.checklist_items, onChange])

  const updateCheckItem = useCallback((id: string, updates: Partial<ChecklistItem>) => {
    onChange({ checklist_items: note.checklist_items?.map(item => item.id === id ? { ...item, ...updates } : item) ?? [] })
  }, [note.checklist_items, onChange])

  const removeCheckItem = useCallback((id: string) => {
    onChange({ checklist_items: note.checklist_items?.filter(item => item.id !== id) ?? [] })
  }, [note.checklist_items, onChange])

  const noteId = (note as Note).id

  return (
    <div className="flex flex-col gap-4">
      {/* Type selector */}
      <div className="flex gap-1 p-1 bg-[var(--muted)] rounded-md w-fit">
        {TYPE_TABS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange({ type: value })}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              note.type === value ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Title */}
      <Input
        placeholder="Note title..."
        value={note.title ?? ''}
        onChange={e => onChange({ title: e.target.value })}
        className="text-base font-medium"
      />

      {/* Content */}
      {note.type === 'plain' && (
        <div style={{ position: 'relative' }}>
          <Textarea
            ref={textareaRef}
            placeholder="Start writing... (type @ to mention a person)"
            value={note.content ?? ''}
            onChange={e => onChange({ content: e.target.value })}
            onKeyDown={mentionKeyDown}
            rows={10}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
            <AtSign size={11} color="var(--muted-foreground)" />
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Type @ to mention a person</span>
          </div>

          {/* @mention dropdown */}
          {mentionActive && suggestions.length > 0 && (
            <div style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 50,
              backgroundColor: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 8, overflow: 'hidden', marginBottom: 4,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}>
              {suggestions.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickSuggestion(s)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', border: 'none', cursor: 'pointer', textAlign: 'left',
                    backgroundColor: i === selectedIdx ? 'rgba(124,106,255,0.12)' : 'transparent',
                    color: 'var(--foreground)',
                  }}
                >
                  <div style={{ width: 26, height: 26, borderRadius: '50%', backgroundColor: '#10b98122', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#10b981', fontWeight: 700, flexShrink: 0 }}>
                    {s.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--foreground)', margin: 0 }}>{s.name}</p>
                    {s.role && <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0 }}>{s.role}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {note.type === 'markdown' && (
        <div data-color-mode="dark">
          <MDEditor
            value={note.content ?? ''}
            onChange={val => onChange({ content: val ?? '' })}
            height={300}
            preview="live"
          />
        </div>
      )}

      {note.type === 'checklist' && (
        <div className="space-y-2">
          {(note.checklist_items ?? []).map(item => (
            <div key={item.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateCheckItem(item.id, { checked: !item.checked })}
                className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                  item.checked ? 'bg-[var(--primary)] border-[var(--primary)]' : 'border-[var(--border)] hover:border-[var(--primary)]'
                }`}
              >
                {item.checked && <Check size={10} className="text-white" />}
              </button>
              <input
                className={`flex-1 bg-transparent text-sm border-none outline-none ${
                  item.checked ? 'line-through text-[var(--muted-foreground)]' : 'text-[var(--foreground)]'
                }`}
                value={item.text}
                onChange={e => updateCheckItem(item.id, { text: e.target.value })}
                placeholder="Item..."
                onKeyDown={e => e.key === 'Enter' && addCheckItem()}
              />
              <button type="button" onClick={() => removeCheckItem(item.id)} className="text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={addCheckItem} className="text-[var(--muted-foreground)]">
            <Plus size={14} /> Add item
          </Button>
        </div>
      )}

      {/* Tags */}
      <div>
        <div className="flex gap-2 flex-wrap mb-2">
          {(note.tags ?? []).map(tag => (
            <Badge key={tag} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeTag(tag)}>
              {tag} ×
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add tag..."
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTag()}
            className="text-xs"
          />
          <Button variant="outline" size="sm" onClick={addTag}>Add</Button>
        </div>
      </div>

      {/* Knowledge links — only shown when editing an existing note */}
      {noteId && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <LinkPanel sourceId={noteId} sourceType="note" />
        </div>
      )}
    </div>
  )
}
