'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, ExternalLink, Trash2, Search, Upload, X, Clock, Tag, Link2 } from 'lucide-react'
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

// ── Metadata fetch helper ────────────────────────────────────
async function fetchMeta(url: string) {
  try {
    const res = await fetch(`/api/bookmarks/fetch-meta?url=${encodeURIComponent(url)}`)
    if (res.ok) return await res.json()
  } catch {}
  return null
}

// ── Domain colour map for visual variety ────────────────────
const DOMAIN_COLORS = ['#7c6aff', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6']
function domainColor(hostname: string) {
  let hash = 0
  for (let i = 0; i < hostname.length; i++) hash = hostname.charCodeAt(i) + ((hash << 5) - hash)
  return DOMAIN_COLORS[Math.abs(hash) % DOMAIN_COLORS.length]
}

export default function BookmarksPage() {
  const [bookmarks,   setBookmarks]   = useState<Bookmark[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [tagFilter,   setTagFilter]   = useState<string | null>(null)
  const [dialogOpen,  setDialogOpen]  = useState(false)
  const [editing,     setEditing]     = useState<Partial<Bookmark>>({ title: '', url: '', description: '', tags: [] })
  const [tagInput,    setTagInput]    = useState('')
  const [saving,      setSaving]      = useState(false)

  // Quick capture
  const [captureUrl,    setCaptureUrl]    = useState('')
  const [captureFetching, setCaptureFetching] = useState(false)

  // Bulk import
  const [importing,    setImporting]    = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; total: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Drag and drop
  const [dragging, setDragging] = useState(false)

  const fetchBookmarks = useCallback(async () => {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    const res = await fetch(`/api/bookmarks?${params}`)
    const data = await res.json()
    setBookmarks(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [search])

  useEffect(() => { fetchBookmarks() }, [fetchBookmarks])

  // ── Quick capture ────────────────────────────────────────
  async function handleQuickCapture(e: React.FormEvent | React.KeyboardEvent) {
    e.preventDefault()
    const url = captureUrl.trim()
    if (!url) return
    try { new URL(url) } catch { toast.error('Invalid URL'); return }

    setCaptureFetching(true)
    const meta = await fetchMeta(url)

    const res = await fetch('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        title: meta?.title ?? new URL(url).hostname,
        description: meta?.description ?? '',
        favicon_url: meta?.favicon_url ?? null,
        reading_time: meta?.reading_time ?? null,
        hostname: meta?.hostname ?? new URL(url).hostname,
        tags: [],
      }),
    })

    if (res.ok) {
      toast.success('Bookmark saved')
      setCaptureUrl('')
      fetchBookmarks()
    } else {
      toast.error('Failed to save')
    }
    setCaptureFetching(false)
  }

  // ── Drag and drop ────────────────────────────────────────
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave() { setDragging(false) }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)

    // Try URL from drag
    const url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
    if (!url) { toast.error('No URL detected'); return }
    try { new URL(url) } catch { toast.error('Not a valid URL'); return }

    setCaptureFetching(true)
    const meta = await fetchMeta(url)
    const res = await fetch('/api/bookmarks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        title: meta?.title ?? new URL(url).hostname,
        description: meta?.description ?? '',
        favicon_url: meta?.favicon_url ?? null,
        reading_time: meta?.reading_time ?? null,
        hostname: meta?.hostname ?? new URL(url).hostname,
        tags: [],
      }),
    })
    if (res.ok) { toast.success('Link saved!'); fetchBookmarks() }
    else toast.error('Failed to save')
    setCaptureFetching(false)
  }

  // ── Bulk import ──────────────────────────────────────────
  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    const html = await file.text()
    const res = await fetch('/api/bookmarks/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html }),
    })
    const data = await res.json()
    if (res.ok) {
      setImportResult({ imported: data.imported, total: data.total })
      toast.success(`Imported ${data.imported} bookmarks`)
      fetchBookmarks()
    } else {
      toast.error(data.error ?? 'Import failed')
    }
    setImporting(false)
    e.target.value = ''
  }

  // ── Edit / save dialog ───────────────────────────────────
  async function openEdit(bm: Bookmark) {
    setEditing(bm)
    setTagInput('')
    setDialogOpen(true)
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase()
    if (!tag || editing.tags?.includes(tag)) return
    setEditing(p => ({ ...p, tags: [...(p.tags ?? []), tag] }))
    setTagInput('')
  }

  async function saveEdit() {
    if (!editing.url?.trim()) { toast.error('URL is required'); return }
    setSaving(true)
    try {
      const isEdit = !!(editing as Bookmark).id
      const res = await fetch(
        isEdit ? `/api/bookmarks/${(editing as Bookmark).id}` : '/api/bookmarks',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editing),
        }
      )
      if (!res.ok) throw new Error()
      toast.success(isEdit ? 'Updated' : 'Saved')
      setDialogOpen(false)
      fetchBookmarks()
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  async function deleteBookmark(id: string) {
    const res = await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' })
    if (res.ok) { setBookmarks(prev => prev.filter(b => b.id !== id)); toast.success('Deleted') }
  }

  // All unique tags from all bookmarks
  const allTags = [...new Set(bookmarks.flatMap(b => b.tags))]
  const displayed = tagFilter ? bookmarks.filter(b => b.tags.includes(tagFilter)) : bookmarks

  return (
    <AppLayout>
      <div
        style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {dragging && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 500,
            backgroundColor: 'rgba(124,106,255,0.15)',
            border: '3px dashed #7c6aff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔗</div>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#7c6aff' }}>Drop to save bookmark</p>
            </div>
          </div>
        )}

        <PageHeader
          title="Bookmarks"
          description="Save links — paste, drop, or import"
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importing}>
                <Upload size={14} /> {importing ? 'Importing...' : 'Import'}
              </Button>
              <Button size="sm" onClick={() => { setEditing({ title: '', url: '', description: '', tags: [] }); setDialogOpen(true) }}>
                <Plus size={14} /> Add
              </Button>
              <input ref={fileInputRef} type="file" accept=".html,.htm" style={{ display: 'none' }} onChange={handleFileImport} />
            </div>
          }
        />

        {/* Import result banner */}
        {importResult && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', borderRadius: 10, marginBottom: 16,
            backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
          }}>
            <span style={{ fontSize: 13, color: '#10b981' }}>
              ✓ Imported {importResult.imported} of {importResult.total} bookmarks
            </span>
            <button type="button" onClick={() => setImportResult(null)} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Quick capture bar ── */}
        <form onSubmit={handleQuickCapture} style={{ marginBottom: 20 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 0,
            backgroundColor: '#12121a',
            border: dragging ? '2px solid #7c6aff' : '2px solid #3a3a5e',
            borderRadius: 12, overflow: 'hidden',
            transition: 'border-color 0.15s',
          }}
            onFocus={() => {}}
          >
            <div style={{ padding: '0 14px', color: '#6b6b88', flexShrink: 0 }}>
              <Link2 size={16} />
            </div>
            <input
              type="url"
              value={captureUrl}
              onChange={e => setCaptureUrl(e.target.value)}
              placeholder="Paste a URL and press Enter to save instantly..."
              style={{
                flex: 1, padding: '14px 0', background: 'none', border: 'none',
                outline: 'none', fontSize: 14, color: '#e8e8f0',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
              }}
              onFocus={e => { e.currentTarget.closest('div')!.style.borderColor = '#7c6aff' }}
              onBlur={e => { e.currentTarget.closest('div')!.style.borderColor = '#3a3a5e' }}
            />
            {captureFetching ? (
              <div style={{ padding: '0 16px', color: '#6b6b88', fontSize: 12 }}>Fetching...</div>
            ) : captureUrl ? (
              <button type="submit" style={{
                padding: '10px 18px', backgroundColor: '#7c6aff', border: 'none',
                color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                borderRadius: '0 10px 10px 0',
              }}>
                Save ↵
              </button>
            ) : (
              <div style={{ padding: '0 16px', color: '#3a3a5e', fontSize: 11 }}>or drag a link here</div>
            )}
          </div>
        </form>

        {/* Search + tag filters */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '0 0 260px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b6b88' }} />
            <Input
              placeholder="Search bookmarks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 32 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {tagFilter && (
              <button type="button" onClick={() => setTagFilter(null)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 10px', borderRadius: 20, border: '1px solid #7c6aff',
                backgroundColor: '#7c6aff22', color: '#7c6aff', fontSize: 12, cursor: 'pointer',
              }}>
                {tagFilter} <X size={10} />
              </button>
            )}
            {!tagFilter && allTags.slice(0, 8).map(tag => (
              <button key={tag} type="button" onClick={() => setTagFilter(tag)} style={{
                padding: '4px 10px', borderRadius: 20, border: '1px solid #2a2a3e',
                backgroundColor: 'transparent', color: '#6b6b88', fontSize: 12, cursor: 'pointer',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c6aff55'; e.currentTarget.style.color = '#e8e8f0' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a3e'; e.currentTarget.style.color = '#6b6b88' }}
              >
                {tag}
              </button>
            ))}
          </div>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6b6b88' }}>
            {displayed.length} bookmark{displayed.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Bookmark list */}
        {loading ? (
          <p style={{ color: '#6b6b88', fontSize: 13 }}>Loading...</p>
        ) : displayed.length === 0 ? (
          <EmptyState
            icon="🔖"
            title={search || tagFilter ? 'No results' : 'No bookmarks yet'}
            description={search || tagFilter ? 'Try a different search or tag.' : 'Paste a URL above, drag a link here, or import from your browser.'}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {displayed.map(bm => (
              <BookmarkCard
                key={bm.id}
                bookmark={bm}
                onEdit={() => openEdit(bm)}
                onDelete={() => deleteBookmark(bm.id)}
                onTagClick={tag => setTagFilter(tag)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{(editing as Bookmark).id ? 'Edit bookmark' : 'Add bookmark'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input placeholder="URL *" type="url" value={editing.url ?? ''} onChange={e => setEditing(p => ({ ...p, url: e.target.value }))} />
            <Input placeholder="Title" value={editing.title ?? ''} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))} />
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
            <Button onClick={saveEdit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}

// ── Bookmark card ────────────────────────────────────────────
function BookmarkCard({ bookmark: bm, onEdit, onDelete, onTagClick }: {
  bookmark: Bookmark
  onEdit: () => void
  onDelete: () => void
  onTagClick: (tag: string) => void
}) {
  const hostname = bm.hostname ?? (() => { try { return new URL(bm.url).hostname } catch { return bm.url } })()
  const color = domainColor(hostname)

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        backgroundColor: '#12121a', border: '1px solid #2a2a3e',
        borderRadius: 10, padding: '12px 14px',
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#3a3a5e')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#2a2a3e')}
      className="group"
    >
      {/* Favicon */}
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        backgroundColor: color + '22', border: `1px solid ${color}33`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        {bm.favicon_url ? (
          <img src={bm.favicon_url} alt="" width={18} height={18} style={{ borderRadius: 3 }}
            onError={e => { e.currentTarget.style.display = 'none' }} />
        ) : (
          <span style={{ fontSize: 13, color }}>{hostname.charAt(0).toUpperCase()}</span>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {/* Title + external link */}
            <a
              href={bm.url} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 14, fontWeight: 600, color: '#e8e8f0',
                textDecoration: 'none', maxWidth: '100%',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = '#7c6aff')}
              onMouseLeave={e => (e.currentTarget.style.color = '#e8e8f0')}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bm.title}</span>
              <ExternalLink size={11} style={{ flexShrink: 0, opacity: 0.5 }} />
            </a>

            {/* Domain chip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
              <span style={{
                fontSize: 11, color, backgroundColor: color + '18',
                padding: '1px 8px', borderRadius: 99, fontWeight: 500,
              }}>
                {hostname}
              </span>
              {bm.reading_time && (
                <span style={{ fontSize: 11, color: '#6b6b88', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Clock size={10} /> {bm.reading_time} min read
                </span>
              )}
              <span style={{ fontSize: 11, color: '#3a3a5e' }}>{formatRelative(bm.created_at)}</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 4, opacity: 0, transition: 'opacity 0.15s' }} className="group-hover-actions">
            <button type="button" onClick={onEdit}
              style={{ background: 'none', border: 'none', color: '#6b6b88', cursor: 'pointer', padding: 4, borderRadius: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#e8e8f0')}
              onMouseLeave={e => (e.currentTarget.style.color = '#6b6b88')}
            >✏️</button>
            <button type="button" onClick={onDelete}
              style={{ background: 'none', border: 'none', color: '#6b6b88', cursor: 'pointer', padding: 4, borderRadius: 4 }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={e => (e.currentTarget.style.color = '#6b6b88')}
            ><Trash2 size={13} /></button>
          </div>
        </div>

        {/* Description */}
        {bm.description && (
          <p style={{ fontSize: 12, color: '#6b6b88', margin: '5px 0 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>
            {bm.description}
          </p>
        )}

        {/* Tags */}
        {bm.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 7 }}>
            {bm.tags.map(tag => (
              <button key={tag} type="button" onClick={() => onTagClick(tag)} style={{
                display: 'flex', alignItems: 'center', gap: 3,
                fontSize: 11, color: '#6b6b88', backgroundColor: '#1e1e2e',
                border: '1px solid #2a2a3e', padding: '1px 8px', borderRadius: 99, cursor: 'pointer',
              }}
                onMouseEnter={e => { e.currentTarget.style.color = '#7c6aff'; e.currentTarget.style.borderColor = '#7c6aff55' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#6b6b88'; e.currentTarget.style.borderColor = '#2a2a3e' }}
              >
                <Tag size={9} /> {tag}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
