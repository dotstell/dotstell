'use client'
import { useState } from 'react'
import { X, Loader2, Check, Wand2, RefreshCw, ChevronLeft } from 'lucide-react'
import { AIConfig } from '@/lib/ai/types'
import { MarkdownContent } from '@/components/ui/MarkdownContent'
import { marked } from 'marked'

type DraftFormat   = 'outline' | 'meeting' | 'daily' | 'research' | 'ooo' | 'proposal' | 'status' | 'email' | 'custom'
type ImproveFormat = 'improve_english' | 'formal' | 'concise' | 'expand' | 'rewrite'

const DRAFT_TEMPLATES: { key: DraftFormat; label: string; desc: string; emoji: string }[] = [
  { key: 'outline',  label: 'Outline',        desc: 'Headings & bullet structure',   emoji: '📋' },
  { key: 'meeting',  label: 'Meeting notes',   desc: 'Agenda, discussion, action items', emoji: '🤝' },
  { key: 'daily',    label: 'Daily log',       desc: 'Done, blockers, tomorrow',     emoji: '📅' },
  { key: 'research', label: 'Research note',   desc: 'Background, findings, sources',emoji: '🔬' },
  { key: 'ooo',      label: 'OoO email',       desc: 'Out of office auto-reply',     emoji: '✈️' },
  { key: 'proposal', label: 'Proposal',        desc: 'Problem, solution, timeline',  emoji: '📊' },
  { key: 'status',   label: 'Status report',   desc: 'Progress, metrics, next steps',emoji: '📈' },
  { key: 'email',    label: 'Email draft',     desc: 'Professional business email',  emoji: '✉️' },
]

const IMPROVE_ACTIONS: { key: ImproveFormat; label: string; desc: string }[] = [
  { key: 'improve_english', label: 'Improve English', desc: 'Fix grammar & clarity'     },
  { key: 'formal',          label: 'Make formal',     desc: 'Professional tone'          },
  { key: 'concise',         label: 'Make concise',    desc: 'Remove filler, keep essence'},
  { key: 'expand',          label: 'Expand',          desc: 'Add detail & examples'      },
  { key: 'rewrite',         label: 'Full rewrite',    desc: 'Clean structure & flow'     },
]

interface AIWritingPanelProps {
  config:         AIConfig
  noteTitle?:     string
  noteContent?:   string  // plain text for improve mode
  isEmpty:        boolean // true = draft mode, false = assist mode
  onInsert:       (html: string) => void  // appends / inserts at cursor
  onReplace:      (html: string) => void  // replaces entire note content
  onClose:        () => void
  initialFormat?: DraftFormat
}

function mdToHtml(md: string): string {
  return String(marked(md, { gfm: true, breaks: false }))
}

export function AIWritingPanel({
  config, noteTitle, noteContent, isEmpty,
  onInsert, onReplace, onClose, initialFormat,
}: AIWritingPanelProps) {
  const [phase,    setPhase]    = useState<'picker' | 'result'>('picker')
  const [format,   setFormat]   = useState<DraftFormat | ImproveFormat | null>(initialFormat ?? null)
  const [intent,   setIntent]   = useState(noteTitle ?? '')
  const [result,   setResult]   = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function generate(fmt: DraftFormat | ImproveFormat) {
    setFormat(fmt)
    setLoading(true); setError(null); setResult('')
    try {
      const body = isEmpty
        ? { config, mode: 'draft',   format: fmt, intent: intent.trim() || undefined, title: noteTitle }
        : { config, mode: 'improve', format: fmt, content: noteContent }
      const res  = await fetch('/api/ai/write', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Writing failed')
      setResult(data.result)
      setPhase('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  function handleInsert() {
    onInsert(mdToHtml(result))
    onClose()
  }

  function handleReplace() {
    onReplace(mdToHtml(result))
    onClose()
  }

  function handleRetry() {
    if (format) generate(format)
  }

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 200,
      width: 380, backgroundColor: 'var(--card)',
      borderLeft: '1px solid var(--border)',
      boxShadow: '-12px 0 40px rgba(0,0,0,0.18)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Wand2 size={14} color="var(--primary)" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>AI Writing</p>
            <p style={{ margin: 0, fontSize: 10, color: 'var(--muted-foreground)' }}>
              {isEmpty ? 'Draft from scratch' : 'Improve existing content'}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} style={iconBtnStyle}>
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── PICKER phase ── */}
        {phase === 'picker' && (
          <>
            {/* Intent field (draft mode only) */}
            {isEmpty && (
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>
                  What are you writing about?
                </label>
                <input
                  value={intent}
                  onChange={e => setIntent(e.target.value)}
                  placeholder="e.g. Q3 security audit plan, meeting with Tanaka-san…"
                  onKeyDown={e => { if (e.key === 'Enter' && intent.trim() && format) generate(format) }}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '8px 10px', borderRadius: 8, fontSize: 13,
                    border: '1px solid var(--border)', backgroundColor: 'var(--muted)',
                    color: 'var(--foreground)', outline: 'none', transition: 'border-color 0.12s',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  autoFocus
                />
              </div>
            )}

            {/* Template / action grid */}
            <div>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {isEmpty ? 'Choose a format' : 'What would you like to do?'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {isEmpty
                  ? DRAFT_TEMPLATES.map(t => (
                    <TemplateCard
                      key={t.key}
                      emoji={t.emoji}
                      label={t.label}
                      desc={t.desc}
                      active={format === t.key}
                      loading={loading && format === t.key}
                      onClick={() => {
                        setFormat(t.key)
                        generate(t.key)
                      }}
                    />
                  ))
                  : IMPROVE_ACTIONS.map(a => (
                    <ActionCard
                      key={a.key}
                      label={a.label}
                      desc={a.desc}
                      loading={loading && format === a.key}
                      onClick={() => generate(a.key)}
                    />
                  ))
                }
              </div>
            </div>

            {/* Custom intent quick-generate for draft mode */}
            {isEmpty && (
              <button
                type="button"
                disabled={!intent.trim() || loading}
                onClick={() => generate('custom')}
                style={{
                  width: '100%', padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: 'none', cursor: intent.trim() && !loading ? 'pointer' : 'default',
                  backgroundColor: intent.trim() && !loading ? 'var(--primary)' : 'var(--muted)',
                  color: intent.trim() && !loading ? 'white' : 'var(--muted-foreground)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.12s',
                }}
              >
                {loading && format === 'custom'
                  ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Drafting…</>
                  : <><Wand2 size={13} /> Draft from my description</>
                }
              </button>
            )}

            {/* Error */}
            {error && (
              <div style={{ padding: '8px 10px', borderRadius: 7, backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', fontSize: 12 }}>
                {error}
              </div>
            )}

            {/* Loading spinner (for template click — no explicit generate button) */}
            {loading && format !== 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--muted-foreground)', fontSize: 12, padding: '4px 0' }}>
                <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
                <span>Writing your {DRAFT_TEMPLATES.find(t => t.key === format)?.label ?? IMPROVE_ACTIONS.find(a => a.key === format)?.label}…</span>
              </div>
            )}
          </>
        )}

        {/* ── RESULT phase ── */}
        {phase === 'result' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button type="button" onClick={() => { setPhase('picker'); setResult('') }} style={iconBtnStyle}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Preview
              </span>
              <button type="button" onClick={handleRetry} title="Regenerate" style={{ ...iconBtnStyle, marginLeft: 'auto' }}>
                <RefreshCw size={13} />
              </button>
            </div>

            {/* Generated content preview */}
            <div style={{
              flex: 1, padding: '12px 14px', borderRadius: 10,
              border: '1px solid var(--border)', backgroundColor: 'var(--muted)',
              fontSize: 13, lineHeight: 1.65, color: 'var(--foreground)',
              overflowY: 'auto', minHeight: 200,
            }}>
              <MarkdownContent>{result}</MarkdownContent>
            </div>

            {/* Apply buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                type="button"
                onClick={isEmpty ? handleInsert : handleReplace}
                style={{
                  width: '100%', padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: 'none', cursor: 'pointer', backgroundColor: 'var(--primary)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <Check size={13} />
                {isEmpty ? 'Insert into note' : 'Replace note content'}
              </button>
              {!isEmpty && (
                <button
                  type="button"
                  onClick={handleInsert}
                  style={{
                    width: '100%', padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                    border: '1px solid var(--border)', cursor: 'pointer',
                    backgroundColor: 'transparent', color: 'var(--foreground)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  Append to note
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────

function TemplateCard({ emoji, label, desc, active, loading, onClick }: {
  emoji: string; label: string; desc: string; active: boolean; loading: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4,
        padding: '10px 11px', borderRadius: 9, textAlign: 'left', cursor: loading ? 'wait' : 'pointer',
        border: `1px solid ${active ? 'color-mix(in srgb, var(--primary) 50%, transparent)' : 'var(--border)'}`,
        backgroundColor: active ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--muted)',
        transition: 'all 0.12s',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.backgroundColor = 'var(--accent)'; e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 35%, transparent)' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.backgroundColor = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' } }}
    >
      <span style={{ fontSize: 16 }}>{loading ? '⏳' : emoji}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--primary)' : 'var(--foreground)' }}>{label}</span>
      <span style={{ fontSize: 10, color: 'var(--muted-foreground)', lineHeight: 1.3 }}>{desc}</span>
    </button>
  )
}

function ActionCard({ label, desc, loading, onClick }: {
  label: string; desc: string; loading: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3,
        padding: '10px 11px', borderRadius: 9, textAlign: 'left', cursor: loading ? 'wait' : 'pointer',
        border: '1px solid var(--border)', backgroundColor: 'var(--muted)',
        transition: 'all 0.12s',
      }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--accent)'; e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 35%, transparent)' }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}
    >
      {loading
        ? <Loader2 size={12} color="var(--primary)" style={{ animation: 'spin 1s linear infinite', marginBottom: 2 }} />
        : <Wand2 size={12} color="var(--primary)" style={{ marginBottom: 2 }} />
      }
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>{label}</span>
      <span style={{ fontSize: 10, color: 'var(--muted-foreground)', lineHeight: 1.3 }}>{desc}</span>
    </button>
  )
}

const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--muted-foreground)', padding: 5, borderRadius: 6,
  display: 'flex', alignItems: 'center', transition: 'all 0.12s',
}
