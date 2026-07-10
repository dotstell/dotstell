'use client'
import { useState, useCallback } from 'react'
import { Plus, Trash2, Check } from 'lucide-react'
import dynamic from 'next/dynamic'
import { Note, NoteType, ChecklistItem } from '@/types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { generateId } from '@/lib/utils'

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
    onChange({
      checklist_items: note.checklist_items?.map(item => item.id === id ? { ...item, ...updates } : item) ?? []
    })
  }, [note.checklist_items, onChange])

  const removeCheckItem = useCallback((id: string) => {
    onChange({ checklist_items: note.checklist_items?.filter(item => item.id !== id) ?? [] })
  }, [note.checklist_items, onChange])

  return (
    <div className="flex flex-col gap-4">
      {/* Type selector */}
      <div className="flex gap-1 p-1 bg-[var(--muted)] rounded-md w-fit">
        {TYPE_TABS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onChange({ type: value })}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              note.type === value
                ? 'bg-[var(--primary)] text-white'
                : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
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
        <Textarea
          placeholder="Start writing..."
          value={note.content ?? ''}
          onChange={e => onChange({ content: e.target.value })}
          rows={10}
        />
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
                onClick={() => updateCheckItem(item.id, { checked: !item.checked })}
                className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                  item.checked
                    ? 'bg-[var(--primary)] border-[var(--primary)]'
                    : 'border-[var(--border)] hover:border-[var(--primary)]'
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
              <button onClick={() => removeCheckItem(item.id)} className="text-[var(--muted-foreground)] hover:text-[var(--destructive)]">
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
    </div>
  )
}
