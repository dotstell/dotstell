'use client'
import { useState, useEffect, useCallback } from 'react'
import { Link2, Plus, X, FileText, Users, Bookmark, CheckSquare, ExternalLink } from 'lucide-react'
import { LinkableType } from '@/types'
import { useDebounce } from '@/hooks/useDebounce'

interface LinkedItem {
  id: string
  type: LinkableType
  label: string
  link_id?: string
}

interface SearchResult {
  id: string
  _type: string
  _label: string
}

const TYPE_ICON: Record<string, React.ElementType> = {
  note: FileText, person: Users, bookmark: Bookmark, task: CheckSquare,
}
const TYPE_COLOR: Record<string, string> = {
  note: 'var(--primary)', person: '#10b981', bookmark: '#f59e0b', task: '#ef4444',
}
const TYPE_HREF: Record<string, (id: string) => string> = {
  note: () => '/notes', person: (id) => `/people/${id}`, bookmark: () => '/bookmarks', task: () => '/tasks',
}

interface LinkPanelProps {
  sourceId: string
  sourceType: LinkableType
}

export function LinkPanel({ sourceId, sourceType }: LinkPanelProps) {
  const [links, setLinks]         = useState<LinkedItem[]>([])
  const [searching, setSearching] = useState(false)
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<SearchResult[]>([])
  const [loading, setLoading]     = useState(false)
  const debouncedQ = useDebounce(query, 250)

  const loadLinks = useCallback(async () => {
    const res = await fetch(`/api/links?source_id=${sourceId}`)
    if (!res.ok) return
    const data = await res.json()
    if (!Array.isArray(data)) return
    // Fetch labels for each linked item
    const enriched = await Promise.all(
      data.map(async (link: { id: string; target_id: string; target_type: string }) => {
        const r = await fetch(`/api/search?q=${link.target_id}&exact=${link.target_id}`)
        return { id: link.target_id, type: link.target_type as LinkableType, label: link.target_id, link_id: link.id }
      })
    )
    setLinks(enriched)
  }, [sourceId])

  const loadLinksWithLabels = useCallback(async () => {
    const res = await fetch(`/api/links?source_id=${sourceId}`)
    if (!res.ok) return
    const data = await res.json()
    // Exclude auto-tracked wikilinks — those are managed by the editor, not shown here as manual links
    const filtered = data.filter((l: { label?: string }) => l.label !== '__wikilink__')
    if (!Array.isArray(filtered) || filtered.length === 0) { setLinks([]); return }

    const enriched: LinkedItem[] = await Promise.all(
      filtered.map(async (link: { id: string; target_id: string; target_type: string }) => {
        try {
          const r = await fetch(`/api/${link.target_type === 'person' ? 'people' : link.target_type + 's'}/${link.target_id}`)
          if (r.ok) {
            const item = await r.json()
            return { id: link.target_id, type: link.target_type as LinkableType, label: item.name ?? item.title ?? link.target_id, link_id: link.id }
          }
        } catch {}
        return { id: link.target_id, type: link.target_type as LinkableType, label: link.target_id, link_id: link.id }
      })
    )
    setLinks(enriched)
  }, [sourceId])

  useEffect(() => { loadLinksWithLabels() }, [loadLinksWithLabels])

  useEffect(() => {
    if (!debouncedQ || debouncedQ.length < 2) { setResults([]); return }
    setLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(debouncedQ)}`)
      .then(r => r.json())
      .then(d => {
        const filtered = Array.isArray(d)
          ? d.filter((r: SearchResult) => !(r.id === sourceId && r._type === sourceType))
          : []
        setResults(filtered)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [debouncedQ, sourceId, sourceType])

  async function addLink(target: SearchResult) {
    const already = links.some(l => l.id === target.id)
    if (already) return
    await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: sourceId, source_type: sourceType, target_id: target.id, target_type: target._type }),
    })
    setLinks(prev => [...prev, { id: target.id, type: target._type as LinkableType, label: target._label }])
    setQuery('')
    setResults([])
    setSearching(false)
  }

  async function removeLink(linkItem: LinkedItem) {
    await fetch('/api/links', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: sourceId, target_id: linkItem.id }),
    })
    setLinks(prev => prev.filter(l => l.id !== linkItem.id))
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Link2 size={13} color="var(--muted-foreground)" />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Linked items {links.length > 0 && `(${links.length})`}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setSearching(s => !s)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '4px 10px', borderRadius: 6,
            border: '1px solid var(--border)', backgroundColor: 'transparent',
            color: 'var(--primary)', fontSize: 12, cursor: 'pointer',
          }}
        >
          <Plus size={12} /> Link item
        </button>
      </div>

      {/* Existing links */}
      {links.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {links.map(link => {
            const Icon = TYPE_ICON[link.type] ?? FileText
            const color = TYPE_COLOR[link.type] ?? 'var(--primary)'
            return (
              <div key={link.id} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 8px 4px 6px',
                borderRadius: 20,
                backgroundColor: color + '15',
                border: `1px solid ${color}33`,
              }}>
                <Icon size={11} color={color} />
                <a
                  href={TYPE_HREF[link.type]?.(link.id)}
                  style={{ fontSize: 12, color, textDecoration: 'none', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {link.label}
                </a>
                <button
                  type="button"
                  onClick={() => removeLink(link)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: color + '88', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  <X size={10} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Search to add link */}
      {searching && (
        <div style={{ position: 'relative' }}>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search notes, people, tasks, bookmarks..."
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 8,
              border: '1px solid var(--border)', backgroundColor: 'var(--muted)',
              color: 'var(--foreground)', fontSize: 13, outline: 'none',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          />
          {(results.length > 0 || loading) && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              backgroundColor: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 8, marginTop: 4,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              overflow: 'hidden',
            }}>
              {loading && <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--muted-foreground)' }}>Searching...</div>}
              {results.map(r => {
                const Icon = TYPE_ICON[r._type] ?? FileText
                const color = TYPE_COLOR[r._type] ?? 'var(--primary)'
                const alreadyLinked = links.some(l => l.id === r.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => !alreadyLinked && addLink(r)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', border: 'none',
                      backgroundColor: alreadyLinked ? 'rgba(255,255,255,0.02)' : 'transparent',
                      cursor: alreadyLinked ? 'default' : 'pointer',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (!alreadyLinked) e.currentTarget.style.backgroundColor = 'rgba(124,106,255,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = alreadyLinked ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                  >
                    <div style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon size={13} color={color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: alreadyLinked ? 'var(--muted-foreground)' : 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r._label}</p>
                      <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0, textTransform: 'capitalize' }}>{r._type}</p>
                    </div>
                    {alreadyLinked && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Linked</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {links.length === 0 && !searching && (
        <p style={{ fontSize: 12, color: 'var(--border)', fontStyle: 'italic' }}>No linked items yet. Click &quot;Link item&quot; to connect this to a note, person, task or bookmark.</p>
      )}
    </div>
  )
}
