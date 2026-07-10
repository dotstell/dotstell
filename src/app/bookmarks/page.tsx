'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, ExternalLink, Trash2, Search, Upload, X, Clock, Tag, Link2, LayoutList, Layers, Pencil, CheckSquare, Square, AlertTriangle, ChevronDown, ChevronRight, Settings2, ArrowUpDown } from 'lucide-react'
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

  // View mode — default collections, persisted in localStorage
  const [viewMode, setViewMode] = useState<'list' | 'collections'>(() => {
    if (typeof window === 'undefined') return 'collections'
    return (localStorage.getItem('bookmarks-view') as 'list' | 'collections') ?? 'collections'
  })

  function setAndPersistViewMode(mode: 'list' | 'collections') {
    setViewMode(mode)
    localStorage.setItem('bookmarks-view', mode)
  }

  // Tag expansion
  const [showAllTags, setShowAllTags] = useState(false)

  // Import preview
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewData,     setPreviewData]     = useState<{ folder: string; count: number }[] | null>(null)
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set())
  const [folderSearch,    setFolderSearch]    = useState('')
  const [folderSort,      setFolderSort]      = useState<'name-asc' | 'name-desc' | 'count-desc' | 'count-asc'>('count-desc')

  // Tag manager
  const [tagManagerOpen, setTagManagerOpen] = useState(false)
  const [tagSort,        setTagSort]        = useState<'name-asc' | 'name-desc' | 'count-desc' | 'count-asc' | 'recent'>('count-desc')
  const [tagSearch,      setTagSearch]      = useState('')
  const [renamingTag,    setRenamingTag]    = useState<string | null>(null)
  const [renameValue,    setRenameValue]    = useState('')
  const [tagWorking,     setTagWorking]     = useState(false)

  // Bulk import
  const [importing,    setImporting]    = useState(false)
  const [importResult, setImportResult] = useState<{
    imported: number
    duplicates: number
    skipped_invalid: number
    total_in_file: number
    existing_in_db: number
    in_file_duplicates: number
    insert_errors: number
    first_error: string | null
    skip_reasons: Record<string, number>
  } | null>(null)
  const [lastImportHtml, setLastImportHtml] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Drag and drop
  const [dragging, setDragging] = useState(false)

  // Bulk select
  const [selected,      setSelected]      = useState<Set<string>>(new Set())
  const [selectMode,    setSelectMode]    = useState(false)
  const [confirmOpen,   setConfirmOpen]   = useState(false)
  const [confirmTarget, setConfirmTarget] = useState<{ ids: string[]; label: string } | null>(null)
  const [deleting,      setDeleting]      = useState(false)
  const [deleteProgress, setDeleteProgress] = useState<{ done: number; total: number } | null>(null)

  const fetchBookmarks = useCallback(async () => {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    const res = await fetch(`/api/bookmarks?${params}`)
    const data = await res.json()
    setBookmarks(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [search])

  async function trackVisit(id: string) {
    await fetch('/api/bookmarks/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    // Update local state immediately without refetch
    setBookmarks(prev => prev.map(b => b.id === id ? {
      ...b,
      last_visited_at: new Date().toISOString(),
      visit_count: (b.visit_count ?? 0) + 1,
    } : b))
  }

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
  async function runImport(html: string, force = false, selectedTags?: string[]) {
    setImporting(true)
    const res = await fetch('/api/bookmarks/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, force, selectedTags }),
    })
    const data = await res.json()
    if (res.ok) {
      setImportResult(data)
      if (data.imported > 0) {
        toast.success(`Imported ${data.imported} new bookmark${data.imported !== 1 ? 's' : ''}`)
        fetchBookmarks()
      } else if (data.duplicates > 0) {
        toast.info(`All ${data.duplicates} bookmarks already exist`)
      }
    } else {
      toast.error(data.error ?? 'Import failed')
    }
    setImporting(false)
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const html = await file.text()
    setLastImportHtml(html)

    // Show preview first so user can see what collections will be created
    const res = await fetch('/api/bookmarks/preview-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html }),
    })
    if (res.ok) {
      const data = await res.json()
      setPreviewData(data.folders)
      setSelectedFolders(new Set(data.folders.map((f: { folder: string }) => f.folder)))
      setFolderSearch('')
      setFolderSort('count-desc')
      setPreviewOpen(true)
    } else {
      await runImport(html, false)
    }
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

  // ── Bulk operations ──────────────────────────────────────
  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(displayed.map(b => b.id)))
  }

  function selectNone() {
    setSelected(new Set())
  }

  function selectGroup(ids: string[]) {
    setSelected(prev => {
      const next = new Set(prev)
      const allIn = ids.every(id => next.has(id))
      ids.forEach(id => allIn ? next.delete(id) : next.add(id))
      return next
    })
  }

  function promptDelete(ids: string[], label: string) {
    setConfirmTarget({ ids, label })
    setConfirmOpen(true)
  }

  async function confirmDelete() {
    if (!confirmTarget) return
    const { ids } = confirmTarget
    setConfirmOpen(false)
    setDeleting(true)

    const BATCH = 500  // Supabase IN clause limit
    let totalDeleted = 0
    setDeleteProgress({ done: 0, total: ids.length })

    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH)
        const res = await fetch('/api/bookmarks/bulk-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: batch }),
        })
        if (res.ok) {
          const data = await res.json()
          totalDeleted += data.deleted ?? batch.length
        }
        setDeleteProgress({ done: Math.min(i + BATCH, ids.length), total: ids.length })
      }

      setBookmarks(prev => prev.filter(b => !ids.includes(b.id)))
      setSelected(new Set())
      setSelectMode(false)
      toast.success(`Deleted ${totalDeleted} bookmark${totalDeleted !== 1 ? 's' : ''}`)
    } catch {
      toast.error('Delete failed — please try again')
    } finally {
      setDeleting(false)
      setDeleteProgress(null)
    }
  }

  // ── Tag manager ──────────────────────────────────────────
  async function renameTag(oldTag: string, newTag: string) {
    if (!newTag.trim() || newTag === oldTag) { setRenamingTag(null); return }
    setTagWorking(true)
    const res = await fetch('/api/bookmarks/manage-tags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldTag, newTag: newTag.toLowerCase().trim() }),
    })
    if (res.ok) {
      toast.success(`Renamed "${oldTag}" → "${newTag}"`)
      fetchBookmarks()
    } else toast.error('Rename failed')
    setRenamingTag(null)
    setTagWorking(false)
  }

  async function deleteTag(tag: string) {
    setTagWorking(true)
    const res = await fetch('/api/bookmarks/manage-tags', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag }),
    })
    if (res.ok) {
      const data = await res.json()
      toast.success(`Removed tag "${tag}" from ${data.updated} bookmarks`)
      fetchBookmarks()
    } else toast.error('Delete failed')
    setTagWorking(false)
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
        {/* ── Delete progress overlay ── */}
        {deleting && deleteProgress && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 600,
            backgroundColor: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              backgroundColor: '#12121a', border: '1px solid #2a2a3e',
              borderRadius: 16, padding: '32px 40px', minWidth: 320, textAlign: 'center',
              boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            }}>
              <div style={{ fontSize: 36, marginBottom: 16 }}>🗑️</div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#e8e8f0', margin: '0 0 6px' }}>
                Deleting bookmarks...
              </h3>
              <p style={{ fontSize: 13, color: '#6b6b88', margin: '0 0 20px' }}>
                {deleteProgress.done} of {deleteProgress.total} deleted
              </p>

              {/* Progress bar */}
              <div style={{ height: 6, backgroundColor: '#1e1e2e', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
                <div style={{
                  height: '100%', borderRadius: 99,
                  backgroundColor: '#ef4444',
                  width: `${Math.round((deleteProgress.done / deleteProgress.total) * 100)}%`,
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <p style={{ fontSize: 12, color: '#3a3a5e', margin: 0 }}>
                {Math.round((deleteProgress.done / deleteProgress.total) * 100)}% complete
              </p>
            </div>
          </div>
        )}

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
              <Button variant="outline" size="sm" onClick={() => setTagManagerOpen(true)}>
                <Settings2 size={14} /> Manage tags
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => { setSelectMode(s => !s); setSelected(new Set()) }}
                style={selectMode ? { borderColor: '#7c6aff', color: '#7c6aff', backgroundColor: '#7c6aff11' } : {}}
              >
                <CheckSquare size={14} /> {selectMode ? 'Cancel' : 'Select'}
              </Button>
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

        {/* ── Bulk action toolbar ── */}
        {selectMode && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', marginBottom: 14,
            backgroundColor: '#1a1a28', border: '1px solid #3a3a5e',
            borderRadius: 10,
          }}>
            {/* Select all / none toggle */}
            <button type="button" onClick={selected.size === displayed.length ? selectNone : selectAll} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#a0a0b8', fontSize: 13,
            }}>
              {selected.size === displayed.length
                ? <CheckSquare size={15} color="#7c6aff" />
                : selected.size > 0
                  ? <CheckSquare size={15} color="#6b6b88" />
                  : <Square size={15} color="#6b6b88" />}
              {selected.size === displayed.length ? 'Deselect all' : 'Select all'}
            </button>

            {/* Count pill */}
            {selected.size > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: '#7c6aff', backgroundColor: '#7c6aff22',
                padding: '2px 10px', borderRadius: 99,
              }}>
                {selected.size} of {displayed.length} selected
              </span>
            )}
            {selected.size === 0 && (
              <span style={{ fontSize: 12, color: '#3a3a5e' }}>Click cards to select</span>
            )}

            <div style={{ flex: 1 }} />

            {/* Single smart delete button */}
            {selected.size > 0 ? (
              // Some or all selected — delete exactly what's selected
              <button type="button"
                onClick={() => promptDelete(
                  [...selected],
                  selected.size === displayed.length
                    ? `all ${selected.size} bookmark${selected.size !== 1 ? 's' : ''}${tagFilter ? ` in "${tagFilter}"` : ''}`
                    : `${selected.size} selected bookmark${selected.size !== 1 ? 's' : ''}`
                )}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 16px', borderRadius: 8,
                  backgroundColor: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)',
                  color: '#ef4444', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.22)' }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.12)' }}
              >
                <Trash2 size={14} />
                Delete {selected.size === displayed.length ? 'all' : selected.size}
              </button>
            ) : (
              // Nothing selected — offer delete all as a secondary option
              <button type="button"
                onClick={() => promptDelete(displayed.map(b => b.id), `all ${displayed.length} bookmark${displayed.length !== 1 ? 's' : ''}${tagFilter ? ` in "${tagFilter}"` : ''}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 8,
                  backgroundColor: 'transparent', border: '1px solid #2a2a3e',
                  color: '#6b6b88', fontSize: 13, cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef444444'; e.currentTarget.style.color = '#ef4444' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a3e'; e.currentTarget.style.color = '#6b6b88' }}
              >
                <Trash2 size={14} /> Delete all {displayed.length}
              </button>
            )}
          </div>
        )}

        {/* Import result banner */}
        {importResult && (
          <div style={{
            padding: '12px 16px', borderRadius: 10, marginBottom: 16,
            backgroundColor: importResult.imported > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(124,106,255,0.08)',
            border: `1px solid ${importResult.imported > 0 ? 'rgba(16,185,129,0.25)' : 'rgba(124,106,255,0.25)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1 }}>
                {/* Summary row */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
                  {importResult.imported > 0 ? (
                    <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>
                      ✓ {importResult.imported} new bookmark{importResult.imported !== 1 ? 's' : ''} imported
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, color: '#7c6aff', fontWeight: 600 }}>
                      ℹ No new bookmarks to import
                    </span>
                  )}
                  {importResult.duplicates > 0 && (
                    <span style={{ fontSize: 13, color: '#6b6b88' }}>
                      · {importResult.duplicates} already in your library
                    </span>
                  )}
                  {importResult.skipped_invalid > 0 && (
                    <span style={{ fontSize: 13, color: '#f59e0b' }}>
                      · {importResult.skipped_invalid} invalid links skipped
                    </span>
                  )}
                  {importResult.insert_errors > 0 && (
                    <span style={{ fontSize: 13, color: '#ef4444' }}>
                      · {importResult.insert_errors} failed to save
                      {importResult.first_error && `: "${importResult.first_error}"`}
                    </span>
                  )}
                </div>

                {/* Debug: counts */}
                <div style={{ fontSize: 11, color: '#3a3a5e', marginBottom: importResult.skipped_invalid > 0 ? 6 : 0 }}>
                  {importResult.total_in_file} links in file
                  {importResult.in_file_duplicates > 0 && ` · ${importResult.in_file_duplicates} duplicate URLs within file (merged tags)`}
                  {` · ${importResult.existing_in_db} already in your library`}
                </div>

                {/* Skip reasons */}
                {importResult.skipped_invalid > 0 && Object.keys(importResult.skip_reasons).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, color: '#6b6b88' }}>Skipped:</span>
                    {Object.entries(importResult.skip_reasons).map(([reason, count]) => (
                      <span key={reason} style={{
                        fontSize: 11, color: '#6b6b88',
                        backgroundColor: '#1e1e2e', border: '1px solid #2a2a3e',
                        padding: '1px 8px', borderRadius: 99,
                      }}>
                        {reason}: {count}
                      </span>
                    ))}
                  </div>
                )}

                {/* Force re-import option when 0 imported but there were duplicates */}
                {importResult.imported === 0 && importResult.duplicates > 0 && lastImportHtml && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 6, borderTop: '1px solid #2a2a3e' }}>
                    <span style={{ fontSize: 12, color: '#6b6b88' }}>
                      Expected new bookmarks but got none?
                    </span>
                    <button
                      type="button"
                      onClick={() => runImport(lastImportHtml, true)}
                      disabled={importing}
                      style={{
                        fontSize: 12, color: '#7c6aff', fontWeight: 600,
                        background: 'none', border: '1px solid #7c6aff44',
                        borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
                      }}
                    >
                      Force re-import all
                    </button>
                  </div>
                )}
              </div>
              <button type="button" onClick={() => setImportResult(null)} style={{ background: 'none', border: 'none', color: '#6b6b88', cursor: 'pointer', flexShrink: 0 }}>
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── Quick capture bar ── */}
        <form onSubmit={handleQuickCapture} style={{ marginBottom: 12 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 0,
            backgroundColor: '#12121a',
            border: dragging ? '2px solid #7c6aff' : '2px solid #3a3a5e',
            borderRadius: 12, overflow: 'hidden',
            transition: 'border-color 0.15s',
          }}>
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
              onBlur={e => { e.currentTarget.closest('div')!.style.borderColor = dragging ? '#7c6aff' : '#3a3a5e' }}
            />
            {captureFetching ? (
              <div style={{ padding: '0 16px', color: '#6b6b88', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 14, height: 14, border: '2px solid #3a3a5e', borderTopColor: '#7c6aff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                Fetching...
              </div>
            ) : captureUrl ? (
              <button type="submit" style={{
                padding: '10px 18px', backgroundColor: '#7c6aff', border: 'none',
                color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                borderRadius: '0 10px 10px 0',
              }}>
                Save ↵
              </button>
            ) : (
              <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: 6, color: '#3a3a5e', fontSize: 12 }}>
                <span>or</span>
              </div>
            )}
          </div>
        </form>

        {/* ── Drop zone strip (always visible, lights up on drag) ── */}
        <DropZoneStrip dragging={dragging} hasBookmarks={displayed.length > 0} />

        {/* ── Recently visited ── */}
        {(() => {
          const recentlyVisited = bookmarks
            .filter(b => b.last_visited_at)
            .sort((a, b) => (b.last_visited_at! > a.last_visited_at! ? 1 : -1))
            .slice(0, 6)
          if (recentlyVisited.length === 0) return null
          return (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: '#3a3a5e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Recently visited
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {recentlyVisited.map(bm => {
                  const hostname = bm.hostname ?? (() => { try { return new URL(bm.url).hostname } catch { return bm.url } })()
                  const color = domainColor(hostname)
                  return (
                    <a
                      key={bm.id}
                      href={bm.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackVisit(bm.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 12px', borderRadius: 20, textDecoration: 'none',
                        backgroundColor: '#12121a', border: `1px solid ${color}33`,
                        maxWidth: 220, transition: 'border-color 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = color + '88')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = color + '33')}
                    >
                      {bm.favicon_url ? (
                        <img src={bm.favicon_url} alt="" width={14} height={14} style={{ borderRadius: 2, flexShrink: 0 }}
                          onError={e => { e.currentTarget.style.display = 'none' }} />
                      ) : (
                        <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ fontSize: 8, color: 'white', fontWeight: 700 }}>{hostname.charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <span style={{ fontSize: 12, color: '#e8e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {bm.title}
                      </span>
                      <span style={{ fontSize: 10, color: '#3a3a5e', flexShrink: 0 }}>{formatRelative(bm.last_visited_at!)}</span>
                    </a>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* Search + filters + view toggle */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '0 0 260px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#6b6b88' }} />
            <Input placeholder="Search bookmarks..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
          </div>

          {/* Tag filter chips — always visible, active one highlighted */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1, alignItems: 'center' }}>
            {tagFilter && (
              <button
                type="button"
                onClick={() => setTagFilter(null)}
                title="Clear filter"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 26, height: 26, borderRadius: '50%',
                  border: '1px solid #ef444444', backgroundColor: '#ef444411',
                  color: '#ef4444', cursor: 'pointer', flexShrink: 0,
                }}
              >
                <X size={12} />
              </button>
            )}
            {(showAllTags ? allTags : allTags.slice(0, 12)).map(tag => {
              const active = tagFilter === tag
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagFilter(active ? null : tag)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '4px 10px', borderRadius: 20, fontSize: 12,
                    cursor: 'pointer', transition: 'all 0.15s',
                    border: active ? '1px solid #7c6aff' : '1px solid #2a2a3e',
                    backgroundColor: active ? '#7c6aff22' : 'transparent',
                    color: active ? '#7c6aff' : '#6b6b88',
                    fontWeight: active ? 600 : 400,
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.borderColor = '#7c6aff55'
                      e.currentTarget.style.color = '#e8e8f0'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.borderColor = '#2a2a3e'
                      e.currentTarget.style.color = '#6b6b88'
                    }
                  }}
                >
                  <Tag size={9} />
                  {tag}
                  {active && <X size={9} style={{ marginLeft: 2, opacity: 0.7 }} />}
                </button>
              )
            })}
            {allTags.length > 12 && (
              <button
                type="button"
                onClick={() => setShowAllTags(s => !s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 20, fontSize: 12,
                  cursor: 'pointer', transition: 'all 0.15s',
                  border: '1px dashed #3a3a5e',
                  backgroundColor: 'transparent',
                  color: '#6b6b88',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c6aff55'; e.currentTarget.style.color = '#7c6aff' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#3a3a5e'; e.currentTarget.style.color = '#6b6b88' }}
              >
                {showAllTags
                  ? <><ChevronRight size={10} style={{ rotate: '270deg' }} /> Show less</>
                  : <>+{allTags.length - 12} more</>
                }
              </button>
            )}
          </div>

          {/* View toggle + count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: '#6b6b88' }}>{displayed.length} saved</span>
            <div style={{ display: 'flex', gap: 2, backgroundColor: '#1e1e2e', borderRadius: 8, padding: 3 }}>
              {([['list', LayoutList, 'List'], ['collections', Layers, 'Collections']] as const).map(([mode, Icon, label]) => (
                <button key={mode} type="button" onClick={() => setAndPersistViewMode(mode)} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  backgroundColor: viewMode === mode ? '#7c6aff' : 'transparent',
                  color: viewMode === mode ? 'white' : '#6b6b88',
                  fontSize: 12, fontWeight: viewMode === mode ? 600 : 400,
                  transition: 'all 0.15s',
                }}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <p style={{ color: '#6b6b88', fontSize: 13 }}>Loading...</p>
        ) : displayed.length === 0 ? (
          search || tagFilter ? (
            <EmptyState icon="🔖" title="No results" description="Try a different search or tag." />
          ) : (
            <BigDropZone dragging={dragging} onClickImport={() => fileInputRef.current?.click()} />
          )
        ) : viewMode === 'collections' ? (
          <CollectionsView
            bookmarks={displayed}
            allTags={allTags}
            onEdit={openEdit}
            onDelete={id => promptDelete([id], '1 bookmark')}
            onTagClick={tag => setTagFilter(tag)}
            selectMode={selectMode}
            selected={selected}
            onToggleSelect={toggleSelect}
            onSelectGroup={selectGroup}
            onDeleteGroup={(ids, label) => promptDelete(ids, label)}
            onVisit={trackVisit}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {displayed.map(bm => (
              <BookmarkCard
                key={bm.id}
                bookmark={bm}
                onEdit={() => openEdit(bm)}
                onDelete={() => promptDelete([bm.id], `"${bm.title}"`)}
                onTagClick={tag => setTagFilter(tag)}
                selectMode={selectMode}
                isSelected={selected.has(bm.id)}
                onToggleSelect={() => toggleSelect(bm.id)}
                onVisit={trackVisit}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Tag manager dialog ── */}
      <Dialog open={tagManagerOpen} onOpenChange={setTagManagerOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings2 size={16} color="#7c6aff" /> Manage Tags
            </DialogTitle>
          </DialogHeader>

          {(() => {
            // Build tag → {count, latestSaved} map
            const tagMeta = new Map<string, { count: number; latestSaved: string; latestVisited: string | null }>()
            bookmarks.forEach(b => {
              b.tags.forEach(t => {
                const existing = tagMeta.get(t)
                const saved = b.created_at ?? ''
                const visited = b.last_visited_at ?? null
                if (!existing) {
                  tagMeta.set(t, { count: 1, latestSaved: saved, latestVisited: visited })
                } else {
                  tagMeta.set(t, {
                    count: existing.count + 1,
                    latestSaved: saved > existing.latestSaved ? saved : existing.latestSaved,
                    latestVisited: (!existing.latestVisited || (visited && visited > existing.latestVisited)) ? visited : existing.latestVisited,
                  })
                }
              })
            })

            const sortedTags = [...tagMeta.entries()]
              .filter(([t]) => t.toLowerCase().includes(tagSearch.toLowerCase()))
              .sort((a, b) => {
                if (tagSort === 'name-asc')   return a[0].localeCompare(b[0])
                if (tagSort === 'name-desc')  return b[0].localeCompare(a[0])
                if (tagSort === 'count-asc')  return a[1].count - b[1].count
                if (tagSort === 'recent')     return (b[1].latestSaved > a[1].latestSaved ? 1 : -1)
                return b[1].count - a[1].count
              })

            return (
              <>
                <div style={{ fontSize: 13, color: '#6b6b88', marginBottom: 10 }}>
                  {tagMeta.size} tags across {bookmarks.length} bookmarks
                </div>

                {/* Search + Sort */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#6b6b88' }} />
                    <input
                      value={tagSearch}
                      onChange={e => setTagSearch(e.target.value)}
                      placeholder="Search tags..."
                      style={{
                        width: '100%', padding: '7px 10px 7px 28px', borderRadius: 8,
                        border: '1px solid #2a2a3e', backgroundColor: '#1a1a28',
                        color: '#e8e8f0', fontSize: 13, outline: 'none',
                      }}
                    />
                  </div>
                  <select
                    value={tagSort}
                    onChange={e => setTagSort(e.target.value as typeof tagSort)}
                    style={{
                      padding: '7px 10px', borderRadius: 8, border: '1px solid #2a2a3e',
                      backgroundColor: '#1a1a28', color: '#a0a0b8', fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    <option value="count-desc">Most used</option>
                    <option value="count-asc">Least used</option>
                    <option value="name-asc">A → Z</option>
                    <option value="name-desc">Z → A</option>
                    <option value="recent">Last saved</option>
                  </select>
                </div>

                {/* Tag list */}
                <div style={{ maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {sortedTags.map(([tag, meta]) => (
                    <div key={tag} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '7px 10px', borderRadius: 8,
                      backgroundColor: '#1a1a28', border: '1px solid #2a2a3e',
                    }}>
                      <Tag size={12} color="#6b6b88" style={{ flexShrink: 0 }} />

                      {renamingTag === tag ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') renameTag(tag, renameValue)
                            if (e.key === 'Escape') setRenamingTag(null)
                          }}
                          style={{
                            flex: 1, background: 'none', border: 'none',
                            borderBottom: '1px solid #7c6aff', outline: 'none',
                            color: '#e8e8f0', fontSize: 13, padding: '0 4px',
                          }}
                        />
                      ) : (
                        <span style={{ flex: 1, fontSize: 13, color: '#e8e8f0', textTransform: 'capitalize' }}>{tag}</span>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, color: '#6b6b88', backgroundColor: '#2a2a3e', padding: '1px 8px', borderRadius: 99 }}>
                          {meta.count}
                        </span>
                        {tagSort === 'recent' && (
                          <span style={{ fontSize: 10, color: '#3a3a5e' }}>
                            {formatRelative(meta.latestSaved)}
                          </span>
                        )}
                      </div>

                      {renamingTag === tag ? (
                        <>
                          <button type="button" onClick={() => renameTag(tag, renameValue)} disabled={tagWorking}
                            style={{ fontSize: 11, color: '#7c6aff', background: 'none', border: '1px solid #7c6aff44', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>
                            Save
                          </button>
                          <button type="button" onClick={() => setRenamingTag(null)}
                            style={{ fontSize: 11, color: '#6b6b88', background: 'none', border: '1px solid #2a2a3e', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button"
                            onClick={() => { setRenamingTag(tag); setRenameValue(tag) }}
                            title="Rename tag"
                            style={{ background: 'none', border: 'none', color: '#6b6b88', cursor: 'pointer', padding: 3, borderRadius: 4, display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#e8e8f0')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#6b6b88')}
                          ><Pencil size={13} /></button>
                          <button type="button"
                            onClick={() => deleteTag(tag)}
                            title="Remove tag from all bookmarks"
                            disabled={tagWorking}
                            style={{ background: 'none', border: 'none', color: '#6b6b88', cursor: 'pointer', padding: 3, borderRadius: 4, display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#6b6b88')}
                          ><Trash2 size={13} /></button>
                        </>
                      )}
                    </div>
                  ))}
                  {sortedTags.length === 0 && (
                    <p style={{ fontSize: 13, color: '#3a3a5e', textAlign: 'center', padding: '20px 0' }}>No tags match</p>
                  )}
                </div>
              </>
            )
          })()}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <Button variant="outline" onClick={() => setTagManagerOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Import preview dialog ── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Choose collections to import</DialogTitle>
          </DialogHeader>

          {previewData && (() => {
            const totalBookmarks = previewData.reduce((s, f) => s + f.count, 0)
            const selectedBookmarks = previewData.filter(f => selectedFolders.has(f.folder)).reduce((s, f) => s + f.count, 0)

            const sorted = [...previewData]
              .filter(f => f.folder.toLowerCase().includes(folderSearch.toLowerCase()))
              .sort((a, b) => {
                if (folderSort === 'name-asc')   return a.folder.localeCompare(b.folder)
                if (folderSort === 'name-desc')  return b.folder.localeCompare(a.folder)
                if (folderSort === 'count-asc')  return a.count - b.count
                return b.count - a.count
              })

            return (
              <>
                {/* Stats */}
                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  <span style={{ fontSize: 13, color: '#a0a0b8' }}>
                    <strong style={{ color: '#e8e8f0' }}>{previewData.length}</strong> collections ·{' '}
                    <strong style={{ color: '#e8e8f0' }}>{totalBookmarks}</strong> bookmarks in file
                  </span>
                  <span style={{ fontSize: 13, color: '#7c6aff', marginLeft: 'auto' }}>
                    {selectedFolders.size} selected · {selectedBookmarks} bookmarks
                  </span>
                </div>

                {/* Search + Sort toolbar */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#6b6b88' }} />
                    <input
                      value={folderSearch}
                      onChange={e => setFolderSearch(e.target.value)}
                      placeholder="Search collections..."
                      style={{
                        width: '100%', padding: '6px 10px 6px 28px', borderRadius: 8,
                        border: '1px solid #2a2a3e', backgroundColor: '#1a1a28',
                        color: '#e8e8f0', fontSize: 13, outline: 'none',
                      }}
                    />
                  </div>
                  <select
                    value={folderSort}
                    onChange={e => setFolderSort(e.target.value as typeof folderSort)}
                    style={{
                      padding: '6px 10px', borderRadius: 8, border: '1px solid #2a2a3e',
                      backgroundColor: '#1a1a28', color: '#a0a0b8', fontSize: 12, cursor: 'pointer',
                    }}
                  >
                    <option value="count-desc">Most bookmarks</option>
                    <option value="count-asc">Fewest bookmarks</option>
                    <option value="name-asc">Name A → Z</option>
                    <option value="name-desc">Name Z → A</option>
                  </select>
                </div>

                {/* Select all / none */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <button type="button" onClick={() => setSelectedFolders(new Set(previewData.map(f => f.folder)))} style={{
                    fontSize: 12, color: '#7c6aff', background: 'none',
                    border: '1px solid #7c6aff44', borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
                  }}>Select all</button>
                  <button type="button" onClick={() => setSelectedFolders(new Set())} style={{
                    fontSize: 12, color: '#6b6b88', background: 'none',
                    border: '1px solid #2a2a3e', borderRadius: 6, padding: '3px 10px', cursor: 'pointer',
                  }}>Deselect all</button>
                  <span style={{ fontSize: 12, color: '#3a3a5e', marginLeft: 4, alignSelf: 'center' }}>
                    {sorted.length !== previewData.length && `Showing ${sorted.length} of ${previewData.length}`}
                  </span>
                </div>

                {/* Folder list with checkboxes */}
                <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {sorted.map(({ folder, count }) => {
                    const checked = selectedFolders.has(folder)
                    return (
                      <div
                        key={folder}
                        onClick={() => {
                          setSelectedFolders(prev => {
                            const next = new Set(prev)
                            checked ? next.delete(folder) : next.add(folder)
                            return next
                          })
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                          backgroundColor: checked ? 'rgba(124,106,255,0.08)' : 'transparent',
                          border: checked ? '1px solid rgba(124,106,255,0.2)' : '1px solid transparent',
                          transition: 'all 0.1s',
                        }}
                        onMouseEnter={e => { if (!checked) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)' }}
                        onMouseLeave={e => { if (!checked) e.currentTarget.style.backgroundColor = 'transparent' }}
                      >
                        {/* Checkbox */}
                        <div style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                          border: checked ? '2px solid #7c6aff' : '2px solid #3a3a5e',
                          backgroundColor: checked ? '#7c6aff' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'all 0.1s',
                        }}>
                          {checked && <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>✓</span>}
                        </div>
                        <span style={{ fontSize: 13, color: checked ? '#e8e8f0' : '#a0a0b8', flex: 1, textTransform: 'capitalize' }}>
                          {folder}
                        </span>
                        <span style={{
                          fontSize: 11, fontWeight: 600,
                          color: checked ? '#7c6aff' : '#6b6b88',
                          backgroundColor: checked ? '#7c6aff22' : '#1e1e2e',
                          padding: '1px 8px', borderRadius: 99,
                        }}>
                          {count}
                        </span>
                      </div>
                    )
                  })}
                  {sorted.length === 0 && (
                    <p style={{ fontSize: 13, color: '#3a3a5e', textAlign: 'center', padding: '20px 0' }}>No collections match</p>
                  )}
                </div>
              </>
            )
          })()}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cancel</Button>
            <Button
              disabled={selectedFolders.size === 0}
              onClick={async () => {
                setPreviewOpen(false)
                if (lastImportHtml) await runImport(lastImportHtml, false, [...selectedFolders])
              }}
            >
              Import {selectedFolders.size === previewData?.length ? 'all' : `${selectedFolders.size} selected`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Confirmation dialog ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={18} color="#ef4444" />
              Delete bookmarks?
            </DialogTitle>
          </DialogHeader>
          <div style={{ padding: '4px 0 16px' }}>
            <p style={{ fontSize: 14, color: '#a0a0b8', lineHeight: 1.6 }}>
              You are about to permanently delete{' '}
              <strong style={{ color: '#e8e8f0' }}>{confirmTarget?.label}</strong>.
              This cannot be undone.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              onClick={confirmDelete}
              disabled={deleting}
              style={{ backgroundColor: '#ef4444', color: 'white' }}
            >
              <Trash2 size={14} /> Yes, delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
function BookmarkCard({ bookmark: bm, onEdit, onDelete, onTagClick, selectMode, isSelected, onToggleSelect, onVisit }: {
  bookmark: Bookmark
  onEdit: () => void
  onDelete: () => void
  onTagClick: (tag: string) => void
  selectMode?: boolean
  isSelected?: boolean
  onToggleSelect?: () => void
  onVisit?: (id: string) => void
}) {
  const hostname = bm.hostname ?? (() => { try { return new URL(bm.url).hostname } catch { return bm.url } })()
  const color = domainColor(hostname)

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        backgroundColor: isSelected ? 'rgba(124,106,255,0.06)' : '#12121a',
        border: isSelected ? '1px solid #7c6aff55' : '1px solid #2a2a3e',
        borderRadius: 10, padding: '12px 14px',
        transition: 'border-color 0.15s, background 0.15s',
        cursor: selectMode ? 'pointer' : 'default',
      }}
      onClick={selectMode ? onToggleSelect : undefined}
      onMouseEnter={e => { if (!selectMode) e.currentTarget.style.borderColor = '#3a3a5e' }}
      onMouseLeave={e => { if (!selectMode) e.currentTarget.style.borderColor = isSelected ? '#7c6aff55' : '#2a2a3e' }}
      className="group"
    >
      {/* Checkbox (select mode) */}
      {selectMode && (
        <div style={{ paddingTop: 6, flexShrink: 0 }}>
          {isSelected
            ? <CheckSquare size={17} color="#7c6aff" />
            : <Square size={17} color="#3a3a5e" />}
        </div>
      )}

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
              onClick={() => onVisit?.(bm.id)}
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

          {/* Actions — always visible */}
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <button type="button" onClick={onEdit}
              title="Edit"
              style={{
                width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: '1px solid #2a2a3e', borderRadius: 6,
                color: '#6b6b88', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#e8e8f0'; e.currentTarget.style.borderColor = '#3a3a5e'; e.currentTarget.style.backgroundColor = '#1e1e2e' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6b6b88'; e.currentTarget.style.borderColor = '#2a2a3e'; e.currentTarget.style.backgroundColor = 'transparent' }}
            ><Pencil size={12} /></button>
            <button type="button" onClick={onDelete}
              title="Delete"
              style={{
                width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: '1px solid #2a2a3e', borderRadius: 6,
                color: '#6b6b88', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef444433'; e.currentTarget.style.backgroundColor = '#ef444411' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#6b6b88'; e.currentTarget.style.borderColor = '#2a2a3e'; e.currentTarget.style.backgroundColor = 'transparent' }}
            ><Trash2 size={12} /></button>
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

// ── Collections view — grouped by tag ───────────────────────
function CollectionsView({ bookmarks, allTags, onEdit, onDelete, onTagClick, selectMode, selected, onToggleSelect, onSelectGroup, onDeleteGroup, onVisit }: {
  bookmarks: Bookmark[]
  allTags: string[]
  onEdit: (bm: Bookmark) => void
  onDelete: (id: string) => void
  onTagClick: (tag: string) => void
  selectMode?: boolean
  selected?: Set<string>
  onToggleSelect?: (id: string) => void
  onSelectGroup?: (ids: string[]) => void
  onDeleteGroup?: (ids: string[], label: string) => void
  onVisit?: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function toggleGroup(tag: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(tag) ? next.delete(tag) : next.add(tag)
      return next
    })
  }

  // Group bookmarks by tag, untagged go to "Uncategorised"
  const groups: { tag: string; items: Bookmark[] }[] = []

  allTags.forEach(tag => {
    const items = bookmarks.filter(b => b.tags.includes(tag))
    if (items.length > 0) groups.push({ tag, items })
  })

  const untagged = bookmarks.filter(b => b.tags.length === 0)
  if (untagged.length > 0) groups.push({ tag: '__untagged__', items: untagged })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {groups.map(({ tag, items }) => {
        const isCollapsed = collapsed.has(tag)
        const label = tag === '__untagged__' ? 'Uncategorised' : tag
        const color = tag === '__untagged__' ? '#6b6b88' : domainColor(tag)

        return (
          <div key={tag} style={{ backgroundColor: '#12121a', border: `1px solid ${isCollapsed ? '#2a2a3e' : color + '33'}`, borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.2s' }}>
            {/* Group header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 14px',
              borderBottom: isCollapsed ? 'none' : `1px solid ${color}22`,
              backgroundColor: isCollapsed ? 'transparent' : color + '08',
              transition: 'background-color 0.2s',
            }}>
              <button type="button" onClick={() => toggleGroup(tag)} style={{
                display: 'flex', alignItems: 'center', gap: 10, flex: 1,
                background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}>
                {/* Chevron — the main expand/collapse indicator */}
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  backgroundColor: isCollapsed ? '#1e1e2e' : color + '22',
                  border: `1px solid ${isCollapsed ? '#2a2a3e' : color + '44'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}>
                  {isCollapsed
                    ? <ChevronRight size={15} color="#6b6b88" />
                    : <ChevronDown size={15} color={color} />
                  }
                </div>

                {/* Tag icon */}
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  backgroundColor: color + '22', border: `1px solid ${color}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Tag size={13} color={color} />
                </div>

                {/* Label */}
                <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f0', textTransform: tag === '__untagged__' ? 'none' : 'capitalize', flex: 1 }}>
                  {label}
                </span>

                {/* Count badge */}
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: isCollapsed ? '#6b6b88' : color,
                  backgroundColor: isCollapsed ? '#1e1e2e' : color + '22',
                  padding: '3px 10px', borderRadius: 99,
                  border: `1px solid ${isCollapsed ? '#2a2a3e' : color + '33'}`,
                  transition: 'all 0.2s',
                }}>
                  {items.length}
                </span>
              </button>

              {/* Group actions */}
              {selectMode && onSelectGroup && (
                <button type="button" onClick={() => onSelectGroup(items.map(i => i.id))} style={{
                  fontSize: 11, color: '#7c6aff', background: 'none',
                  border: '1px solid #7c6aff44', borderRadius: 6,
                  padding: '3px 8px', cursor: 'pointer',
                }}>
                  {items.every(i => selected?.has(i.id)) ? 'Deselect' : 'Select all'}
                </button>
              )}
              {onDeleteGroup && (
                <button type="button"
                  onClick={() => onDeleteGroup(items.map(i => i.id), `all ${items.length} bookmarks in "${label}"`)}
                  title={`Delete all in ${label}`}
                  style={{
                    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'none', border: '1px solid #2a2a3e', borderRadius: 6,
                    color: '#6b6b88', cursor: 'pointer',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef444433' }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#6b6b88'; e.currentTarget.style.borderColor = '#2a2a3e' }}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>

            {/* Group items */}
            {!isCollapsed && (
              <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {items.map(bm => (
                  <BookmarkCard
                    key={bm.id}
                    bookmark={bm}
                    onEdit={() => onEdit(bm)}
                    onDelete={() => onDelete(bm.id)}
                    onTagClick={onTagClick}
                    selectMode={selectMode}
                    isSelected={selected?.has(bm.id)}
                    onToggleSelect={() => onToggleSelect?.(bm.id)}
                    onVisit={onVisit}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Drop zone strip — compact, always visible below capture bar ──
function DropZoneStrip({ dragging, hasBookmarks }: { dragging: boolean; hasBookmarks: boolean }) {
  if (!hasBookmarks) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      padding: '10px 16px', marginBottom: 16,
      border: dragging ? '2px dashed #7c6aff' : '1.5px dashed #2a2a3e',
      borderRadius: 10,
      backgroundColor: dragging ? 'rgba(124,106,255,0.08)' : 'transparent',
      transition: 'all 0.2s ease',
    }}>
      <span style={{ fontSize: 18 }}>{dragging ? '🎯' : '🔗'}</span>
      <span style={{ fontSize: 13, color: dragging ? '#7c6aff' : '#3a3a5e', fontWeight: dragging ? 600 : 400, transition: 'color 0.2s' }}>
        {dragging ? 'Release to save this link' : 'Drag any link from your browser and drop it here'}
      </span>
    </div>
  )
}

// ── Big drop zone — shown when bookmarks list is empty ──
function BigDropZone({ dragging, onClickImport }: { dragging: boolean; onClickImport: () => void }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '60px 24px', gap: 16,
      border: dragging ? '2.5px dashed #7c6aff' : '2px dashed #2a2a3e',
      borderRadius: 16,
      backgroundColor: dragging ? 'rgba(124,106,255,0.08)' : 'rgba(124,106,255,0.02)',
      transition: 'all 0.2s ease',
      minHeight: 320,
    }}>
      <div style={{ fontSize: 56, transition: 'filter 0.2s', filter: dragging ? 'none' : 'grayscale(0.4)' }}>
        {dragging ? '🎯' : '🔗'}
      </div>

      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 18, fontWeight: 700, color: dragging ? '#7c6aff' : '#e8e8f0', margin: '0 0 8px', transition: 'color 0.2s' }}>
          {dragging ? 'Release to save this link' : 'Drop a link anywhere on this page'}
        </p>
        {!dragging && (
          <p style={{ fontSize: 13, color: '#6b6b88', margin: 0, lineHeight: 1.6 }}>
            Drag any URL from your browser address bar, a tab, or a webpage
          </p>
        )}
      </div>

      {!dragging && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 320 }}>
            <div style={{ flex: 1, height: 1, backgroundColor: '#2a2a3e' }} />
            <span style={{ fontSize: 12, color: '#3a3a5e' }}>or</span>
            <div style={{ flex: 1, height: 1, backgroundColor: '#2a2a3e' }} />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 10,
              backgroundColor: '#12121a', border: '1px solid #2a2a3e',
              fontSize: 13, color: '#a0a0b8',
            }}>
              <span>📋</span>
              <span>Paste a URL above and press{' '}
                <kbd style={{ backgroundColor: '#1e1e2e', border: '1px solid #2a2a3e', borderRadius: 4, padding: '1px 6px', fontSize: 11, color: '#7c6aff' }}>Enter</kbd>
              </span>
            </div>
            <button type="button" onClick={onClickImport} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 16px', borderRadius: 10,
              backgroundColor: '#12121a', border: '1px solid #2a2a3e',
              fontSize: 13, color: '#a0a0b8', cursor: 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c6aff44'; e.currentTarget.style.color = '#e8e8f0' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a3e'; e.currentTarget.style.color = '#a0a0b8' }}
            >
              <span>📂</span>
              <span>Import from Chrome / Firefox / Edge</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
