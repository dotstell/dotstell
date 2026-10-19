'use client'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, GripHorizontal, Mic, Settings2, Square, X } from 'lucide-react'
import { DICTATION_LANGUAGES } from '@/hooks/useDictation'
import { dictationLayout } from '@/lib/voice/layout'

export type DictationEngine = 'browser' | 'accurate'

const ACK_KEY = 'dotstell:dictation-notice-seen'
const POSITION_KEY = 'dotstell:dictation-bar-bottom'
const EDGE = 8
const KEY_STEP = 32

/** Whether the user has already accepted the first-use notice about where dictated audio goes. */
export const dictationNoticeSeen = () => typeof window !== 'undefined' && localStorage.getItem(ACK_KEY) === '1'

function savedPosition(): number | null {
  if (typeof window === 'undefined') return null
  const value = Number(localStorage.getItem(POSITION_KEY))
  return Number.isFinite(value) && localStorage.getItem(POSITION_KEY) !== null ? value : null
}

/** The last words of a long phrase, so what is being heard is visible in a narrow bar. */
function tail(text: string, max: number): string {
  return text.length > max ? `…${text.slice(text.length - max)}` : text
}

interface Props {
  listening: boolean
  interim: string
  error: string | null
  /** Raw recognition events, shown only when the page is opened with ?dictationDebug. */
  debug?: string[]
  lang: string
  onLang: (code: string) => void
  onStart: () => void
  onStop: () => void
  onDismiss: () => void
  /** Which speech engine is used, and the means to change it. */
  engine: DictationEngine
  onEngine: (engine: DictationEngine) => void
  /** Whether the browser has built-in speech recognition (it does not in Firefox). */
  browserAvailable: boolean
  /** Name of the speech service High accuracy would send audio to, or null when no key is set up. */
  accurateService: string | null
  /** True once the user asked to dictate, so the bar shows even before recognition has started. */
  open: boolean
}

/**
 * Floating control shown while dictating. The first time, it explains where the audio goes before the browser
 * asks for the microphone, because in Chrome and Edge the browser sends speech to its vendor for recognition.
 *
 * It is one slim row so the note stays visible on a phone, can be dragged (or moved with the arrow keys) to wherever
 * it is out of the way, and keeps its place. The language and other options are in a row that opens on demand.
 */
export function DictationBar({ listening, interim, error, debug, lang, onLang, engine, onEngine, browserAvailable, accurateService, onStart, onStop, onDismiss, open }: Props) {
  const [acknowledged, setAcknowledged] = useState(dictationNoticeSeen)
  const [bottom, setBottom] = useState<number | null>(savedPosition)
  const [options, setOptions] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startY: number; startBottom: number } | null>(null)

  /** Keeps the bar fully on screen, whatever the screen size or keyboard. */
  const clamp = useCallback((value: number) => {
    const height = barRef.current?.offsetHeight ?? 56
    const viewport = window.visualViewport?.height ?? window.innerHeight
    return Math.min(Math.max(value, EDGE), Math.max(EDGE, viewport - height - EDGE))
  }, [])

  const currentBottom = useCallback(() => {
    const bar = barRef.current
    if (!bar) return EDGE
    const viewport = window.visualViewport?.height ?? window.innerHeight
    return viewport - bar.getBoundingClientRect().bottom
  }, [])

  const place = useCallback((value: number) => {
    const next = clamp(value)
    setBottom(next)
    localStorage.setItem(POSITION_KEY, String(Math.round(next)))
  }, [clamp])

  // Tell the note where the bar is, so it can keep the words being dictated clear of it.
  useLayoutEffect(() => {
    if (!open) { dictationLayout.rect = null; return }
    const report = () => {
      const rect = barRef.current?.getBoundingClientRect()
      dictationLayout.rect = rect ? { top: rect.top, bottom: rect.bottom } : null
    }
    report()
    const viewport = window.visualViewport
    window.addEventListener('resize', report)
    viewport?.addEventListener('resize', report)
    const observer = typeof ResizeObserver !== 'undefined' && barRef.current ? new ResizeObserver(report) : null
    if (observer && barRef.current) observer.observe(barRef.current)
    return () => {
      window.removeEventListener('resize', report)
      viewport?.removeEventListener('resize', report)
      observer?.disconnect()
      dictationLayout.rect = null
    }
  }, [open, acknowledged, options, bottom, listening, error, debug?.length])

  // A saved position from a taller screen or with the keyboard closed must still fit now.
  useEffect(() => {
    if (!open || bottom === null) return
    const refit = () => setBottom(prev => (prev === null ? prev : clamp(prev)))
    window.visualViewport?.addEventListener('resize', refit)
    window.addEventListener('resize', refit)
    return () => { window.visualViewport?.removeEventListener('resize', refit); window.removeEventListener('resize', refit) }
  }, [open, bottom, clamp])

  if (!open) return null

  function accept() {
    localStorage.setItem(ACK_KEY, '1')
    setAcknowledged(true)
    onStart()
  }

  function onGripDown(e: React.PointerEvent<HTMLButtonElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startY: e.clientY, startBottom: currentBottom() }
  }
  function onGripMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return
    setBottom(clamp(drag.current.startBottom - (e.clientY - drag.current.startY)))
  }
  function onGripUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return
    const moved = clamp(drag.current.startBottom - (e.clientY - drag.current.startY))
    drag.current = null
    place(moved)
  }
  function onGripKey(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    place(currentBottom() + (e.key === 'ArrowUp' ? KEY_STEP : -KEY_STEP))
  }

  /** Jumps between the top and the bottom of the screen, for people who would rather tap than drag. */
  function flip() {
    const viewport = window.visualViewport?.height ?? window.innerHeight
    const height = barRef.current?.offsetHeight ?? 56
    const atTop = currentBottom() > viewport / 2
    place(atTop ? EDGE : viewport - height - EDGE)
  }
  const onTop = bottom !== null && typeof window !== 'undefined' && bottom > (window.visualViewport?.height ?? window.innerHeight) / 2

  return (
    <div ref={barRef} role="region" aria-label="Dictation" style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)', zIndex: 150,
      bottom: bottom === null ? 'calc(var(--bottom-nav-h, 0px) + 8px + env(safe-area-inset-bottom))' : bottom,
      width: 'min(520px, calc(100% - 16px))', padding: '6px 8px', borderRadius: 12,
      backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {!acknowledged ? (
        <>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--foreground)', lineHeight: 1.5 }}>
            {engine === 'accurate'
              ? <>High accuracy sends your voice to {accurateService ?? 'your speech service'} to be turned into text, using your own key. dotstell never receives the audio. Nothing is recorded unless you press start.</>
              : <>Dictation uses your browser&apos;s speech service. In Chrome and Edge your voice is sent to Google or Microsoft to be turned into text; dotstell never receives the audio. Nothing is recorded unless you press start.</>}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onDismiss} style={ghostBtn}>Not now</button>
            <button type="button" onClick={accept} style={primaryBtn}><Mic size={13} /> Continue</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button" aria-label="Drag to move the dictation bar, or use the up and down arrow keys"
              onPointerDown={onGripDown} onPointerMove={onGripMove} onPointerUp={onGripUp} onPointerCancel={onGripUp} onKeyDown={onGripKey}
              style={{ ...iconBtn, cursor: 'grab', touchAction: 'none' }}
            ><GripHorizontal size={16} /></button>
            <span aria-hidden className={listening ? 'animate-pulse' : undefined} style={{ width: 10, height: 10, borderRadius: 99, flexShrink: 0, backgroundColor: listening ? '#ef4444' : 'var(--muted-foreground)' }} />
            <span role="status" aria-live="polite" style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {listening ? (tail(interim, 44) || 'Listening… speak now') : 'Dictation is off'}
            </span>
            {listening
              ? <button type="button" onClick={onStop} aria-label="Stop dictation" style={{ ...primaryBtn, backgroundColor: '#dc2626' }}><Square size={12} /> Stop</button>
              : <button type="button" onClick={onStart} aria-label="Start dictation" style={primaryBtn}><Mic size={13} /> Start</button>}
            <button type="button" onClick={flip} aria-label={onTop ? 'Move the dictation bar to the bottom' : 'Move the dictation bar to the top'} style={iconBtn}>
              {onTop ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
            <button type="button" onClick={() => setOptions(o => !o)} aria-expanded={options} aria-label="Dictation options" style={{ ...iconBtn, color: options ? 'var(--primary)' : 'var(--muted-foreground)' }}><Settings2 size={15} /></button>
            <button type="button" onClick={onDismiss} aria-label="Close dictation" style={iconBtn}><X size={15} /></button>
          </div>
          {options && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingLeft: 4 }}>
              <div role="radiogroup" aria-label="Speech engine" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {browserAvailable && (
                  <button type="button" role="radio" aria-checked={engine === 'browser'} onClick={() => onEngine('browser')} style={engine === 'browser' ? chipOn : chipOff}>Fast (browser)</button>
                )}
                <button type="button" role="radio" aria-checked={engine === 'accurate'} onClick={() => onEngine('accurate')} style={engine === 'accurate' ? chipOn : chipOff}>High accuracy</button>
              </div>
              <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.4 }}>
                {engine === 'accurate'
                  ? accurateService
                    ? `Text appears a moment after each pause, with punctuation and capitals. Audio goes to ${accurateService} with your key.`
                    : 'Needs a speech key: add an OpenAI, Groq or Gemini key in AI settings, or in the Meeting assistant recording box.'
                  : 'Words appear as you speak. Your browser decides the accuracy.'}
              </p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--muted-foreground)' }}>
                Language
                <select value={lang} onChange={e => onLang(e.target.value)} aria-label="Dictation language" style={{ fontSize: 12, padding: '4px 6px', borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'var(--muted)', color: 'var(--foreground)', maxWidth: 200 }}>
                  {DICTATION_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
              </label>
            </div>
          )}
          {error && <p role="alert" style={{ margin: 0, fontSize: 12, color: '#f87171' }}>{error}</p>}
          {debug && debug.length > 0 && (
            <button type="button" onClick={() => navigator.clipboard?.writeText(debug.join('\n'))} style={{ ...ghostBtn, alignSelf: 'flex-start', fontSize: 11, padding: '3px 8px' }}>Copy debug log</button>
          )}
          {debug && debug.length > 0 && (
            <pre aria-label="Dictation events" style={{ margin: 0, maxHeight: 120, overflow: 'auto', fontSize: 10, lineHeight: 1.4, whiteSpace: 'pre-wrap', color: 'var(--muted-foreground)' }}>{debug.join('\n')}</pre>
          )}
        </>
      )}
    </div>
  )
}

const primaryBtn: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }
const ghostBtn: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, fontSize: 12, border: '1px solid var(--border)', cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--foreground)', display: 'flex', alignItems: 'center' }
const iconBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--muted-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
const chipBase: React.CSSProperties = { padding: '5px 10px', borderRadius: 99, fontSize: 12, cursor: 'pointer', border: '1px solid var(--border)' }
const chipOn: React.CSSProperties = { ...chipBase, backgroundColor: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)', borderColor: 'color-mix(in srgb, var(--primary) 45%, transparent)', fontWeight: 600 }
const chipOff: React.CSSProperties = { ...chipBase, backgroundColor: 'transparent', color: 'var(--muted-foreground)' }
