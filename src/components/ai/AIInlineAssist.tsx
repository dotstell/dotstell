'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Loader2, Check, RefreshCw, ChevronDown } from 'lucide-react'
import { AIConfig, AssistOperation, ASSIST_LABELS } from '@/lib/ai/types'
import { useAIAssist } from '@/hooks/useAI'

interface AIInlineAssistProps {
  config:      AIConfig
  selectedText: string
  noteContext?: string  // full note content for 'explain' operation context
  anchorRect:  DOMRect // bounding rect of the selection — toolbar positioned relative to this
  onApply:     (text: string) => void
  onClose:     () => void
}

// Operation groups shown in the toolbar — ordered for visual grouping
const OP_GROUPS: AssistOperation[][] = [
  ['fix', 'rewrite'],
  ['expand', 'shorten'],
  ['outline', 'checklist'],
  ['explain'],
]

export function AIInlineAssist({ config, selectedText, noteContext, anchorRect, onApply, onClose }: AIInlineAssistProps) {
  const [phase,     setPhase]     = useState<'menu' | 'result'>('menu')
  const [operation, setOperation] = useState<AssistOperation | null>(null)
  const { result, streaming, error, assist, cancel } = useAIAssist(config)
  const panelRef = useRef<HTMLDivElement>(null)

  // Reposition panel above/below the selection based on available viewport space
  const top  = anchorRect.bottom + window.scrollY + 6
  const left = Math.max(8, Math.min(anchorRect.left + window.scrollX, window.innerWidth - 360))

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [onClose])

  // Close on Escape
  useEffect(() => {
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') { cancel(); onClose() } }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [cancel, onClose])

  async function run(op: AssistOperation) {
    setOperation(op)
    setPhase('result')
    await assist(op, selectedText, noteContext)
  }

  function handleApply() {
    if (result) { onApply(result); onClose() }
  }

  function handleRetry() {
    if (operation) run(operation)
  }

  if (phase === 'menu') {
    return (
      <div
        ref={panelRef}
        style={{
          position:        'fixed', zIndex: 9999,
          top:             top, left: left,
          backgroundColor: 'var(--card)', border: '1px solid var(--border)',
          borderRadius:    10, boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          padding:         '6px', display: 'flex', flexWrap: 'wrap', gap: 4,
          maxWidth:        352,
        }}
      >
        {OP_GROUPS.flat().map(op => (
          <button
            key={op}
            type="button"
            onClick={() => run(op)}
            style={{
              padding:         '5px 10px', borderRadius: 6, border: '1px solid var(--border)',
              backgroundColor: 'var(--muted)', color: 'var(--foreground)',
              fontSize: 12, cursor: 'pointer', fontWeight: 500,
              transition: 'all 0.12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--accent)'; e.currentTarget.style.borderColor = 'var(--primary)' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--muted)';  e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            {ASSIST_LABELS[op]}
          </button>
        ))}
      </div>
    )
  }

  // Result phase: show streaming output + apply/retry/cancel controls
  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed', zIndex: 9999,
        top: top, left: left,
        backgroundColor: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        width: 340, padding: '12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {operation ? ASSIST_LABELS[operation] : 'AI'}
        </p>
        <div style={{ display: 'flex', gap: 4 }}>
          {!streaming && result && (
            <button type="button" onClick={handleRetry} title="Regenerate" style={iconBtn}>
              <RefreshCw size={12} />
            </button>
          )}
          <button type="button" onClick={() => { cancel(); onClose() }} style={iconBtn}><X size={12} /></button>
        </div>
      </div>

      {/* Result text */}
      <div style={{
        minHeight: 48, maxHeight: 240, overflowY: 'auto',
        padding: '8px 10px', borderRadius: 8, backgroundColor: 'var(--muted)',
        border: '1px solid var(--border)', fontSize: 13, lineHeight: 1.5,
        color: 'var(--foreground)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: 8,
      }}>
        {result || (streaming && <Loader2 size={13} color="var(--muted-foreground)" style={{ animation: 'spin 1s linear infinite' }} />)}
      </div>

      {error && (
        <div style={{ padding: '6px 10px', borderRadius: 6, marginBottom: 8, fontSize: 11, color: '#f87171', backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <button type="button" onClick={() => { setPhase('menu'); setOperation(null) }} style={{ flex: 1, padding: '7px', borderRadius: 7, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--foreground)', fontSize: 12, cursor: 'pointer' }}>
          Back
        </button>
        <button type="button" onClick={handleApply} disabled={!result || streaming} style={{ flex: 2, padding: '7px', borderRadius: 7, border: 'none', backgroundColor: result && !streaming ? 'var(--primary)' : 'var(--muted)', color: result && !streaming ? 'white' : 'var(--muted-foreground)', fontSize: 12, cursor: result && !streaming ? 'pointer' : 'default', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          {streaming ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Writing…</> : <><Check size={11} /> Replace selection</>}
        </button>
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--muted-foreground)', padding: 4, borderRadius: 5, display: 'flex',
}
