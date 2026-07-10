'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus, ExternalLink, Trash2, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { Bookmark } from '@/types'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { formatRelative } from '@/lib/utils'

const DEFAULT_BOOKMARK: Partial<Bookmark> = { title: '', url: '', description: '', tags: [] }

export default function BookmarksPage() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Partial<Bookmark>>(DEFAULT_BOOKMARK)
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchBookmarks = useCallback(async () => {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    const res = await fetch(`/api/bookmarks?${params}`)
    const data = await res.json()
    setBookmarks(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [search])

  useEffect(() => { fetchBookmarks() }, [fetchBookmarks])

  function openNew() {
    setEditing({ ...DEFAULT_BOOKMARK })
    setTagInput('')
    setDialogOpen(true)
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase()
    if (!tag || editing.tags?.includes(tag)) return
    setEditing(p => ({ ...p, tags: [...(p.tags ?? []), tag] }))
    setTagInput('')
  }

  async function save() {
    if (!editing.url?.trim()) { toast.error('URL is required'); return }
    setSaving(true)
    try {
      const isEdit = !!(editing as Bookmark).id
      const res = await fetch(
        isEdit ? `/api/bookmarks/${(editing as Bookmark).id}` : '/api/bookmarks',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...editing,
            title: editing.title || new URL(editing.url!).hostname,
          }),
        }
      )
      if (!res.ok) throw new Error()
      toast.success(isEdit ? 'Bookmark updated' : 'Bookmark saved')
      setDialogOpen(false)
      fetchBookmarks()
    } catch {
      toast.error('Failed to save bookmark')
    } finally {
      setSaving(false)
    }
  }

  async function deleteBookmark(id: string) {
    const res = await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setBookmarks(prev => prev.filter(b => b.id !== id))
      toast.success('Bookmark deleted')
    }
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <PageHeader
          title="Bookmarks"
          description="Save and organise links"
          action={<Button onClick={openNew}><Plus size={16} /> Save link</Button>}
        />

        <div className="mb-6">
          <Input placeholder="Search bookmarks..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        </div>

        {loading ? (
          <div className="text-[var(--muted-foreground)] text-sm">Loading...</div>
        ) : bookmarks.length === 0 ? (
          <EmptyState
            icon="🔖"
            title="No bookmarks yet"
            description="Save links from articles, tools, and resources. Tag them and connect them to your notes and people."
            action="Save your first link"
            onAction={openNew}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {bookmarks.map(bm => (
              <div key={bm.id} className="group flex items-start gap-3 bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 hover:border-[var(--primary)]/40 transition-all">
                <div className="w-8 h-8 rounded bg-[var(--muted)] flex items-center justify-center flex-shrink-0">
                  <Link2 size={14} className="text-[var(--muted-foreground)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <a href={bm.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium hover:text-[var(--primary)] flex items-center gap-1.5 transition-colors">
                        {bm.title || bm.url}
                        <ExternalLink size={11} className="flex-shrink-0 opacity-60" />
                      </a>
                      <p className="text-xs text-[var(--muted-foreground)] truncate mt-0.5">{bm.url}</p>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-[var(--muted-foreground)]" onClick={() => { setEditing(bm); setDialogOpen(true) }}>
                        ✏️
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-[var(--muted-foreground)] hover:text-[var(--destructive)]" onClick={() => deleteBookmark(bm.id)}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                  {bm.description && <p className="text-xs text-[var(--muted-foreground)] mt-1 line-clamp-2">{bm.description}</p>}
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex flex-wrap gap-1">
                      {bm.tags.slice(0, 4).map(tag => <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>)}
                    </div>
                    <span className="text-xs text-[var(--muted-foreground)]">{formatRelative(bm.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{(editing as Bookmark).id ? 'Edit bookmark' : 'Save bookmark'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input placeholder="URL *" type="url" value={editing.url ?? ''} onChange={e => setEditing(p => ({ ...p, url: e.target.value }))} />
            <Input placeholder="Title (optional)" value={editing.title ?? ''} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))} />
            <Textarea placeholder="Description..." rows={3} value={editing.description ?? ''} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} />
            <div>
              <div className="flex flex-wrap gap-1 mb-2">
                {(editing.tags ?? []).map(tag => (
                  <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => setEditing(p => ({ ...p, tags: p.tags?.filter(t => t !== tag) }))}>
                    {tag} ×
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input placeholder="Add tag..." value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} className="text-xs" />
                <Button variant="outline" size="sm" onClick={addTag}>Add</Button>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
