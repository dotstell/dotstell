'use client'
import { useState, useEffect } from 'react'
import { Sparkles, Loader2, AlertCircle, Link2, Layers, GitBranch, FileText, ExternalLink, RefreshCw } from 'lucide-react'
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
  { key: 'missing',  label: 'Missing links', icon: Link2,     hint: 'Highly similar notes with no wikilink between them' },
  { key: 'clusters', label: 'Clusters',      icon: Layers,    hint: 'Orphaned notes grouped by semantic topic' },
  { key: 'gaps',     label: 'Gap detection', icon: GitBranch, hint: 'Notes sharing many links but no direct bridge' },
]

export function AIGraphIntelPanel({ config, onOpenNote }: AIGraphIntelPanelProps) {
  const [mode,    setMode]    = useState<IntelMode>('missing')
  const [results, setResults] = useState<unknown[]>([])
  const [counts,  setCounts]  = useState<Partial<Record<IntelMode, number>>>({})
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [ran,     setRan]     = useState(false)

  // Auto-run missing links when the panel first opens
  useEffect(() => { run('missing') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function run(m: IntelMode) {
    setMode(m); setResults([]); setError(null); setRan(false); setLoading(true)
    try {
      const res  = await fetch('/api/ai/graph-links', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ mode: m, limit: 8 }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Analysis failed')
      const list = Array.isArray(data) ? data : []
      setResults(list)
      setCounts(prev => ({ ...prev, [m]: list.length }))
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

      {/* Mode tabs — clicking a tab immediately runs the analysis */}
      <div style={{ display: 'flex', gap: 4 }}>
        {MODES.map(m => {
          const Icon    = m.icon
          const active  = mode === m.key
          const count   = counts[m.key]
          return (
            <button key={m.key} type="button" onClick={() => run(m.key)} style={{
              flex: 1, padding: '7px 4px', borderRadius: 8, fontSize: 11, fontWeight: 600,
              border: `1px solid ${active ? 'color-mix(in srgb, var(--primary) 45%, transparent)' : 'var(--border)'}`,
              backgroundColor: active ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent',
              color: active ? 'var(--primary)' : 'var(--muted-foreground)',
              cursor: 'pointer', transition: 'all 0.12s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
              <Icon size={13} />
              <span>{m.label}</span>
              {count !== undefined && (
                <span style={{
                  fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99,
                  backgroundColor: active ? 'var(--primary)' : 'var(--border)',
                  color: active ? 'white' : 'var(--muted-foreground)',
                }}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Hint + re-run button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)', flex: 1 }}>
          {currentMode.hint}
        </p>
        {ran && !loading && (
          <button type="button" onClick={() => run(mode)} style={{
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
            padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)',
            backgroundColor: 'transparent', color: 'var(--muted-foreground)',
            fontSize: 11, cursor: 'pointer',
          }}>
            <RefreshCw size={10} /> Refresh
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: 'var(--muted-foreground)', fontSize: 12 }}>
          <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Analysing your knowledge graph…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '8px 10px', borderRadius: 8, backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', fontSize: 12, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      )}

      {/* Initial prompt — before first run */}
      {!ran && !loading && !error && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
            <Sparkles size={18} color="var(--primary)" />
          </div>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>
            Select a mode above to analyse your knowledge graph
          </p>
        </div>
      )}

      {/* Empty state — after run with 0 results */}
      {ran && !loading && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--muted-foreground)', fontSize: 12 }}>
          {mode === 'missing'  ? '✓ No highly-similar unlinked note pairs found — your graph is well-linked!' :
           mode === 'clusters' ? '✓ No orphaned notes to cluster — all your notes are connected!' :
           '✓ No gap candidates found yet — keep adding notes to discover bridges.'}
        </div>
      )}

      {/* Results: Missing links */}
      {mode === 'missing' && (results as MissingLink[]).filter(r => r?.source && r?.target && r.source.id !== r.target.id).map((r, i) => (
        <div key={i} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <NoteButton title={r.source.title} id={r.source.id} onOpen={onOpenNote} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
              <span style={{ fontSize: 9, color: 'var(--primary)', fontWeight: 700 }}>{r.similarity}%</span>
              <div style={{ width: 32, height: 3, borderRadius: 2, backgroundColor: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${r.similarity}%`, backgroundColor: 'var(--primary)', borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 8, color: 'var(--muted-foreground)' }}>similar</span>
            </div>
            <NoteButton title={r.target.title} id={r.target.id} onOpen={onOpenNote} />
          </div>
          <p style={{ margin: 0, fontSize: 10, color: 'var(--muted-foreground)' }}>Consider adding a wikilink between these notes.</p>
        </div>
      ))}

      {/* Results: Clusters */}
      {mode === 'clusters' && (results as Cluster[]).filter(c => c?.label).map((c, i) => (
        <div key={i} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Layers size={11} color="var(--primary)" />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>{c.label}</span>
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)', marginLeft: 'auto' }}>{c.notes?.length ?? 0} notes</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(c.notes ?? []).map(n => (
              <NoteButton key={n.id} title={n.title} id={n.id} onOpen={onOpenNote} full />
            ))}
          </div>
        </div>
      ))}

      {/* Results: Gaps */}
      {mode === 'gaps' && (results as Gap[]).filter(g => g?.a && g?.b).map((g, i) => (
        <div key={i} style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--muted)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <NoteButton title={g.a.title} id={g.a.id} onOpen={onOpenNote} />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flexShrink: 0 }}>
              <GitBranch size={10} color="var(--primary)" />
              <span style={{ fontSize: 9, color: 'var(--muted-foreground)' }}>{g.shared} shared</span>
            </div>
            <NoteButton title={g.b.title} id={g.b.id} onOpen={onOpenNote} />
          </div>
          <p style={{ margin: 0, fontSize: 10, color: 'var(--muted-foreground)' }}>
            {g.shared} common neighbours — a bridge note could connect them.
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
        padding: '4px 8px', borderRadius: 6,
        border: '1px solid var(--border)',
        backgroundColor: 'var(--card)', cursor: onOpen ? 'pointer' : 'default',
        fontSize: 11, color: 'var(--foreground)', fontWeight: 500,
        overflow: 'hidden',
        // flex: 1 + minWidth: 0 lets both side-by-side buttons shrink proportionally
        // instead of overflowing the card container
        flex: full ? undefined : 1, minWidth: 0,
        width: full ? '100%' : undefined,
        transition: 'all 0.12s', textAlign: 'left',
      }}
      onMouseEnter={e => { if (onOpen) { e.currentTarget.style.backgroundColor = 'var(--accent)'; e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 40%, transparent)' } }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--card)'; e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      <FileText size={9} color="var(--primary)" style={{ flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {title || 'Untitled'}
      </span>
      {onOpen && <ExternalLink size={8} style={{ flexShrink: 0, opacity: 0.4 }} />}
    </button>
  )
}
