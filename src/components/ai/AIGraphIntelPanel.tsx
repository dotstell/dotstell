'use client'
import { useState } from 'react'
import { Sparkles, Loader2, AlertCircle, Link2, Layers, GitBranch, FileText, ExternalLink } from 'lucide-react'
import { AIConfig } from '@/lib/ai/types'

type IntelMode = 'missing' | 'clusters' | 'gaps'

interface MissingLink { source: { id: string; title: string }; target: { id: string; title: string }; similarity: number }
interface Cluster     { label: string; notes: Array<{ id: string; title: string }> }
interface Gap         { a: { id: string; title: string }; b: { id: string; title: string }; shared: number }

interface AIGraphIntelPanelProps {
  config:        AIConfig
  onOpenNote?:   (id: string) => void
}

const MODES: { key: IntelMode; label: string; icon: React.ElementType; hint: string }[] = [
  { key: 'missing',  label: 'Missing links',     icon: Link2,      hint: 'Highly similar notes with no wikilink between them' },
  { key: 'clusters', label: 'Note clusters',     icon: Layers,     hint: 'Orphaned notes grouped by semantic topic' },
  { key: 'gaps',     label: 'Gap detection',     icon: GitBranch,  hint: 'Notes sharing many links but no bridge between them' },
]

/**
 * Panel for graph-level AI intelligence features:
 * - Missing links: semantically close note pairs with no wikilink
 * - Clusters: group orphaned notes by topic
 * - Gap detection: note pairs that share many neighbours but aren't directly linked
 */
export function AIGraphIntelPanel({ config, onOpenNote }: AIGraphIntelPanelProps) {
  const [mode,    setMode]    = useState<IntelMode>('missing')
  const [results, setResults] = useState<unknown[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [ran,     setRan]     = useState(false)

  async function run(m: IntelMode) {
    // Clear results immediately so stale data from a different mode is never rendered
    setMode(m); setResults([]); setError(null); setRan(false); setLoading(true)
    try {
      const res  = await fetch('/api/ai/graph-links', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mode: m, limit: 8 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed')
      setResults(Array.isArray(data) ? data : [])
      setRan(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  const currentMode = MODES.find(m => m.key === mode)!

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 4 }}>
        {MODES.map(m => (
          <button key={m.key} type="button" onClick={() => setMode(m.key)} style={{
            flex: 1, padding: '6px 4px', borderRadius: 7, fontSize: 11, fontWeight: 600,
            border: `1px solid ${mode === m.key ? 'color-mix(in srgb, var(--primary) 40%, transparent)' : 'var(--border)'}`,
            backgroundColor: mode === m.key ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent',
            color: mode === m.key ? 'var(--primary)' : 'var(--muted-foreground)',
            cursor: 'pointer', transition: 'all 0.12s',
          }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Description + Run button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)', flex: 1 }}>
          {currentMode.hint}
        </p>
        <button
          type="button"
          onClick={() => run(mode)}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            padding: '6px 12px', borderRadius: 8, border: 'none',
            backgroundColor: 'var(--primary)', color: 'white',
            fontSize: 12, fontWeight: 600, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
          }}
        >
          {loading
            ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Analysing…</>
            : <><Sparkles size={11} /> Analyse</>}
        </button>
      </div>

      {error && (
        <div style={{ padding: '8px 10px', borderRadius: 8, backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', fontSize: 12, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      )}

      {/* Results */}
      {ran && !loading && results.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', padding: '12px 0', opacity: 0.6 }}>
          {mode === 'missing'  ? 'No highly-similar unlinked note pairs found.' :
           mode === 'clusters' ? 'No orphaned notes to cluster — your notes are well-connected!' :
           'No gap candidates found yet.'}
        </p>
      )}

      {mode === 'missing' && (results as MissingLink[]).filter(r => r?.source && r?.target).map((r, i) => (
        <div key={i} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <NoteButton title={r.source.title} id={r.source.id} onOpen={onOpenNote} />
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }}>
              ↔ {r.similarity}% similar
            </span>
            <NoteButton title={r.target.title} id={r.target.id} onOpen={onOpenNote} />
          </div>
          <p style={{ margin: 0, fontSize: 10, color: 'var(--muted-foreground)' }}>These notes are semantically close but not linked — consider adding a wikilink.</p>
        </div>
      ))}

      {mode === 'clusters' && (results as Cluster[]).filter(c => c?.label).map((c, i) => (
        <div key={i} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--muted)' }}>
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>
            <Layers size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Cluster: {c.label}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(c.notes ?? []).map(n => (
              <NoteButton key={n.id} title={n.title} id={n.id} onOpen={onOpenNote} full />
            ))}
          </div>
        </div>
      ))}

      {mode === 'gaps' && (results as Gap[]).filter(g => g?.a && g?.b).map((g, i) => (
        <div key={i} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <NoteButton title={g.a.title} id={g.a.id} onOpen={onOpenNote} />
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }}>
              <GitBranch size={9} style={{ verticalAlign: 'middle' }} /> {g.shared} shared links
            </span>
            <NoteButton title={g.b.title} id={g.b.id} onOpen={onOpenNote} />
          </div>
          <p style={{ margin: 0, fontSize: 10, color: 'var(--muted-foreground)' }}>
            These notes share {g.shared} common neighbours but aren't directly linked — a bridge note could connect them.
          </p>
        </div>
      ))}
    </div>
  )
}

function NoteButton({ title, id, onOpen, full }: { title: string; id: string; onOpen?: (id: string) => void; full?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(id)}
      title={`Open "${title}"`}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 7px', borderRadius: 5,
        border: '1px solid var(--border)',
        backgroundColor: 'var(--card)', cursor: onOpen ? 'pointer' : 'default',
        fontSize: 11, color: 'var(--foreground)', fontWeight: 500,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        maxWidth: full ? '100%' : 120, width: full ? '100%' : undefined,
        transition: 'all 0.12s', textAlign: 'left',
      }}
      onMouseEnter={e => { if (onOpen) { e.currentTarget.style.backgroundColor = 'var(--accent)'; e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 40%, transparent)' } }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--card)'; e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <FileText size={9} color="var(--primary)" style={{ flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {title || 'Untitled'}
      </span>
      {onOpen && <ExternalLink size={8} style={{ flexShrink: 0, opacity: 0.5 }} />}
    </button>
  )
}
