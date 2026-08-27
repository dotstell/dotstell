'use client'
import { useState, useRef } from 'react'
import { Sparkles, Search, FileText, Bookmark, Loader2, AlertCircle, User, ArrowRight } from 'lucide-react'
import { AIConfig } from '@/lib/ai/types'
import { useAIPersonIntel } from '@/hooks/useAI'
import { MarkdownContent } from '@/components/ui/MarkdownContent'

interface AIPersonPanelProps {
  config:     AIConfig
  /** Pre-populate the search field (e.g. from a selected name in the editor). */
  initialName?: string
  onOpenNote?: (id: string) => void
}

/**
 * Person intelligence panel — aggregates everything the user has written about
 * a named person across notes and bookmarks, then produces a structured brief.
 */
export function AIPersonPanel({ config, initialName = '', onOpenNote }: AIPersonPanelProps) {
  const [name,    setName]    = useState(initialName)
  const [queried, setQueried] = useState(initialName)
  const inputRef = useRef<HTMLInputElement>(null)
  const { summary, sources, loading, error, search } = useAIPersonIntel(config)

  async function handleSearch() {
    const q = name.trim()
    if (!q) return
    setQueried(q)
    await search(q)
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSearch()
  }

  const hasResults = summary.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Search bar */}
      <div style={{ display: 'flex', gap: 6 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--muted)' }}>
          <User size={13} color="var(--muted-foreground)" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Enter a person's name…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 13, color: 'var(--foreground)',
            }}
            autoFocus
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          disabled={!name.trim() || loading}
          style={{
            padding: '7px 14px', borderRadius: 8, border: 'none',
            backgroundColor: name.trim() && !loading ? 'var(--primary)' : 'var(--muted)',
            color: name.trim() && !loading ? 'white' : 'var(--muted-foreground)',
            fontSize: 12, fontWeight: 600, cursor: name.trim() && !loading ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
          }}
        >
          {loading
            ? <><Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> Searching…</>
            : <><Search size={12} /> Search</>}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ padding: '8px 10px', borderRadius: 8, backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', fontSize: 12, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[80, 95, 65, 90].map((w, i) => (
            <div key={i} style={{ height: 12, borderRadius: 6, backgroundColor: 'var(--muted)', width: `${w}%`, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && hasResults && (
        <>
          {/* Person header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, backgroundColor: 'color-mix(in srgb, var(--primary) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: 'color-mix(in srgb, var(--primary) 20%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <User size={16} color="var(--primary)" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--foreground)' }}>{queried}</p>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)' }}>
                Found in {sources.filter(s => s.type === 'note').length} notes
                {sources.filter(s => s.type === 'bookmark').length > 0 && ` + ${sources.filter(s => s.type === 'bookmark').length} bookmarks`}
              </p>
            </div>
            <Sparkles size={14} color="var(--primary)" style={{ marginLeft: 'auto', opacity: 0.7 }} />
          </div>

          {/* AI-generated summary */}
          <div style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--foreground)' }}>
            <MarkdownContent>{summary}</MarkdownContent>
          </div>

          {/* Source list */}
          {sources.length > 0 && (
            <div>
              <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Sources
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {sources.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => s.type === 'note' && onOpenNote?.(s.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 10px', borderRadius: 7,
                      border: `1px solid ${s.type === 'note' && onOpenNote ? 'var(--border)' : 'var(--border)'}`,
                      backgroundColor: 'var(--muted)',
                      cursor: s.type === 'note' && onOpenNote ? 'pointer' : 'default',
                      textAlign: 'left', width: '100%', transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => {
                      if (s.type === 'note' && onOpenNote) {
                        e.currentTarget.style.backgroundColor = 'var(--accent)'
                        e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 40%, transparent)'
                      }
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = 'var(--muted)'
                      e.currentTarget.style.borderColor = 'var(--border)'
                    }}
                  >
                    {s.type === 'note'
                      ? <FileText size={11} color="var(--primary)" style={{ flexShrink: 0 }} />
                      : <Bookmark size={11} color="var(--muted-foreground)" style={{ flexShrink: 0 }} />}
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.title}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }}>
                      {new Date(s.updatedAt).toLocaleDateString()}
                    </span>
                    {s.type === 'note' && onOpenNote && (
                      <ArrowRight size={10} style={{ flexShrink: 0, color: 'var(--primary)', opacity: 0.6 }} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Empty state — only shown after a search with no results */}
      {!loading && !error && !hasResults && queried && (
        <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted-foreground)' }}>
          <User size={28} style={{ opacity: 0.3, margin: '0 auto 8px' }} />
          <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>No results for "{queried}"</p>
          <p style={{ margin: '4px 0 0', fontSize: 12 }}>Try a different spelling, or start taking notes about this person.</p>
        </div>
      )}
    </div>
  )
}
