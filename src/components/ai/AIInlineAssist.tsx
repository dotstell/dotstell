'use client'
import { useState, useEffect, useRef } from 'react'
import { marked } from 'marked'
import { Loader2, RotateCcw, Check, X, Sparkles } from 'lucide-react'
import { AIConfig, AssistOperation } from '@/lib/ai/types'
import { useAIAssist } from '@/hooks/useAI'

interface Props {
  config: AIConfig
  selectedText: string     // empty when from === to (continue writing mode)
  noteContext: string
  anchorRect: DOMRect
  from: number
  to: number               // equals from when no selection (continue mode)
  onReplace: (html: string) => void
  onInsertAfter: (html: string) => void
  onClose: () => void
}

const REPLACE_OPS = new Set<AssistOperation>(['rewrite', 'expand', 'shorten', 'fix', 'outline', 'checklist'])

const SELECTION_OPS: AssistOperation[] = ['rewrite', 'expand', 'shorten', 'fix', 'outline', 'checklist', 'explain']

const OP_META: Record<AssistOperation, { icon: string; label: string }> = {
  rewrite:   { icon: '✏️', label: 'Rewrite' },
  expand:    { icon: '📝', label: 'Expand' },
  shorten:   { icon: '✂️', label: 'Shorten' },
  fix:       { icon: '🔧', label: 'Fix grammar' },
  outline:   { icon: '📋', label: 'Make outline' },
  checklist: { icon: '☑️', label: 'Extract tasks' },
  explain:   { icon: '💡', label: 'Explain' },
  continue:  { icon: '➡️', label: 'Continue writing' },
}

const PANEL_W = 340
const PANEL_H = 300

export function AIInlineAssist({
  config, selectedText, noteContext, anchorRect, from, to,
  onReplace, onInsertAfter, onClose,
}: Props) {
  const isContinue = from === to
  const [activeOp, setActiveOp] = useState<AssistOperation | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)
  const { result, streaming, error, assist, cancel } = useAIAssist(config)

  const top = anchorRect.top > PANEL_H + 20
    ? anchorRect.top - PANEL_H - 10
    : anchorRect.bottom + 10
  const left = Math.max(12, Math.min(
    anchorRect.left + anchorRect.width / 2 - PANEL_W / 2,
    window.innerWidth - PANEL_W - 12,
  ))

  // Close on Escape and outside click
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { cancel(); onClose() } }
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) { cancel(); onClose() }
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [cancel, onClose])

  // Auto-start continue writing when Ctrl+Space fired without selection
  useEffect(() => {
    if (isContinue && !startedRef.current) {
      startedRef.current = true
      setActiveOp('continue')
      assist('continue', selectedText, noteContext)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function runOp(op: AssistOperation) {
    setActiveOp(op)
    assist(op, selectedText, noteContext)
  }

  async function handleApply() {
    if (!result || !activeOp) return
    const html = await marked(result, { gfm: true, breaks: true }) as string
    if (REPLACE_OPS.has(activeOp)) onReplace(html)
    else onInsertAfter(html)
    onClose()
  }

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed', top, left, width: PANEL_W, zIndex: 9500,
        backgroundColor: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        maxHeight: PANEL_H + 60,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Sparkles size={13} color="var(--primary)" />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
            {activeOp ? OP_META[activeOp].label : 'AI Assist'}
          </span>
          {streaming && (
            <Loader2 size={12} color="var(--muted-foreground)" style={{ animation: 'spin 1s linear infinite' }} />
          )}
        </div>
        <button
          type="button"
          onClick={() => { cancel(); onClose() }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 2, display: 'flex' }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Operation picker — shown when no operation is active */}
      {!activeOp && (
        <div style={{ padding: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {SELECTION_OPS.map(op => (
            <button
              key={op}
              type="button"
              onClick={() => runOp(op)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 11px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--muted)',
                color: 'var(--foreground)', fontSize: 12, cursor: 'pointer', fontWeight: 500,
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'color-mix(in srgb, var(--primary) 12%, transparent)'
                e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 35%, transparent)'
                e.currentTarget.style.color = 'var(--primary)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--muted)'
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--foreground)'
              }}
            >
              <span role="img" aria-hidden>{OP_META[op].icon}</span>
              {OP_META[op].label}
            </button>
          ))}
        </div>
      )}

      {/* Streaming result */}
      {activeOp && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', minHeight: 80, maxHeight: 200 }}>
            {result ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--foreground)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                {result}
              </p>
            ) : !error ? (
              <p style={{ margin: 0, fontSize: 13, color: 'var(--muted-foreground)', fontStyle: 'italic' }}>
                Generating…
              </p>
            ) : null}
            {error && (
              <p style={{ margin: 0, fontSize: 12, color: '#ef4444' }}>{error}</p>
            )}
          </div>

          {/* Action bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderTop: '1px solid var(--border)', flexShrink: 0,
          }}>
            {!isContinue ? (
              <button
                type="button"
                onClick={() => { cancel(); setActiveOp(null) }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 7, border: 'none', background: 'none', color: 'var(--muted-foreground)', fontSize: 12, cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent)'; e.currentTarget.style.color = 'var(--foreground)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--muted-foreground)' }}
              >
                <RotateCcw size={11} /> Try another
              </button>
            ) : <div />}
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                type="button"
                onClick={() => { cancel(); onClose() }}
                style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border)', background: 'none', color: 'var(--foreground)', fontSize: 12, cursor: 'pointer' }}
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => { handleApply() }}
                disabled={streaming || !result}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 7, border: 'none',
                  backgroundColor: !result || streaming ? 'var(--muted)' : 'var(--primary)',
                  color: !result || streaming ? 'var(--muted-foreground)' : 'white',
                  fontSize: 12, fontWeight: 600,
                  cursor: !result || streaming ? 'not-allowed' : 'pointer',
                  opacity: !result || streaming ? 0.7 : 1,
                }}
              >
                <Check size={11} />
                {streaming ? 'Generating…' : activeOp && REPLACE_OPS.has(activeOp) ? 'Replace' : 'Insert'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
