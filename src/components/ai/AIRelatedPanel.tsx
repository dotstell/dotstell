'use client'
import { useEffect, useState } from 'react'
import { Sparkles, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { AIConfig } from '@/lib/ai/types'

/** A note or task returned by the related-items endpoint. */
interface RelatedItem {
  id:         string
  title:      string
  type:       'note' | 'task'
  similarity: number  // 0–100 percentage
}

interface AIRelatedPanelProps {
  config:       AIConfig
  noteId:       string
  isConfigured: boolean
  onOpen?:      (noteId: string) => void
}

/** Sidebar panel that surfaces semantically similar notes and tasks for the current note. */
export function AIRelatedPanel({ config, noteId, isConfigured, onOpen }: AIRelatedPanelProps) {
  const [items,   setItems]   = useState<RelatedItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [loaded,  setLoaded]  = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ai/related/${noteId}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ config }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Surface actionable message for common setup failures
        if (res.status === 404 && data.error?.includes('not found')) {
          setError('This note has no embedding yet. Run "Build search index" in AI Settings.')
        } else {
          setError(data.error ?? 'Failed to load related items')
        }
        return
      }
      setItems(data)
      setLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  // Load on mount and when the note or AI config changes.
  // Guard on isConfigured so we never fire with the default unset config.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isConfigured) return
    setItems([]); setLoaded(false); load()
  }, [noteId, config.provider, config.model, config.embeddingProvider, config.embeddingModel, isConfigured])

  if (loading && !loaded) {
    return (
      <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted-foreground)', fontSize: 12 }}>
        <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Finding related items…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '10px 0' }}>
        <div style={{ padding: '8px 10px', borderRadius: 8, backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', fontSize: 11, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
        <button type="button" onClick={load} style={{ marginTop: 6, fontSize: 11, color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <RefreshCw size={10} /> Retry
        </button>
      </div>
    )
  }

  if (loaded && items.length === 0) {
    return (
      <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '8px 0 0', lineHeight: 1.5 }}>
        No closely related items found yet. Add more content or run Build search index in AI Settings.
      </p>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Sparkles size={10} /> Related items
        </p>
        <button type="button" onClick={load} disabled={loading} title="Refresh" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 2, display: 'flex' }}>
          <RefreshCw size={11} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            onClick={() => item.type === 'note' ? onOpen?.(item.id) : undefined}
            style={{
              display:         'flex', alignItems: 'center', justifyContent: 'space-between',
              padding:         '7px 10px', borderRadius: 8, border: '1px solid var(--border)',
              backgroundColor: 'var(--muted)', cursor: item.type === 'note' && onOpen ? 'pointer' : 'default',
              textAlign:       'left', width: '100%', transition: 'all 0.12s',
            }}
            onMouseEnter={e => { if (item.type === 'note' && onOpen) e.currentTarget.style.backgroundColor = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--muted)' }}
          >
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 6 }}>
              <TypeBadge type={item.type} />
              <p style={{ margin: 0, fontSize: 12, color: 'var(--foreground)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.title || 'Untitled'}
              </p>
            </div>
            <SimilarityBadge value={item.similarity} />
          </button>
        ))}
      </div>
    </div>
  )
}

function TypeBadge({ type }: { type: 'note' | 'task' }) {
  const label = type === 'task' ? 'Task' : 'Note'
  const color = type === 'task' ? 'rgba(99,102,241,0.15)' : 'rgba(148,163,184,0.15)'
  const text  = type === 'task' ? '#818cf8' : 'var(--muted-foreground)'
  return (
    <span style={{ fontSize: 9, fontWeight: 700, color: text, background: color, padding: '1px 5px', borderRadius: 4, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {label}
    </span>
  )
}

function SimilarityBadge({ value }: { value: number }) {
  const color = value >= 80 ? '#4ade80' : value >= 60 ? '#a3e635' : 'var(--muted-foreground)'
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, marginLeft: 8, flexShrink: 0 }}>
      {value}%
    </span>
  )
}
