'use client'
import { useEffect, useState } from 'react'
import { Sparkles, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { AIConfig } from '@/lib/ai/types'

interface RelatedNote {
  id:         string
  title:      string
  similarity: number  // 0–100 percentage
}

interface AIRelatedPanelProps {
  config:  AIConfig
  noteId:  string
  onOpen?: (noteId: string) => void
}

export function AIRelatedPanel({ config, noteId, onOpen }: AIRelatedPanelProps) {
  const [notes,   setNotes]   = useState<RelatedNote[]>([])
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
          setError('This note has no embedding yet. Run "Re-index all" in AI Settings.')
        } else {
          setError(data.error ?? 'Failed to load related notes')
        }
        return
      }
      setNotes(data)
      setLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  // Load on mount and when the note changes
  useEffect(() => {
    setNotes([])
    setLoaded(false)
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId])

  if (loading && !loaded) {
    return (
      <div style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted-foreground)', fontSize: 12 }}>
        <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Finding related notes…
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

  if (loaded && notes.length === 0) {
    return (
      <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '8px 0 0', lineHeight: 1.5 }}>
        No closely related notes found yet. Add more notes or lower the similarity threshold.
      </p>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: 4 }}>
          <Sparkles size={10} /> Related notes
        </p>
        <button type="button" onClick={load} disabled={loading} title="Refresh" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 2, display: 'flex' }}>
          <RefreshCw size={11} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {notes.map(n => (
          <button
            key={n.id}
            type="button"
            onClick={() => onOpen?.(n.id)}
            style={{
              display:         'flex', alignItems: 'center', justifyContent: 'space-between',
              padding:         '7px 10px', borderRadius: 8, border: '1px solid var(--border)',
              backgroundColor: 'var(--muted)', cursor: onOpen ? 'pointer' : 'default',
              textAlign:       'left', width: '100%', transition: 'all 0.12s',
            }}
            onMouseEnter={e => { if (onOpen) e.currentTarget.style.backgroundColor = 'var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--muted)' }}
          >
            <p style={{ margin: 0, fontSize: 12, color: 'var(--foreground)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {n.title || 'Untitled'}
            </p>
            <SimilarityBadge value={n.similarity} />
          </button>
        ))}
      </div>
    </div>
  )
}

function SimilarityBadge({ value }: { value: number }) {
  // Color from muted (low) to green (high similarity)
  const color = value >= 80 ? '#4ade80' : value >= 60 ? '#a3e635' : 'var(--muted-foreground)'
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, marginLeft: 8, flexShrink: 0 }}>
      {value}%
    </span>
  )
}
