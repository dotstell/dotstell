'use client'
import { useState } from 'react'
import { Mic, Square, X } from 'lucide-react'
import { DICTATION_LANGUAGES } from '@/hooks/useDictation'

const ACK_KEY = 'dotstell:dictation-notice-seen'

/** Whether the user has already accepted the first-use notice about where dictated audio goes. */
export const dictationNoticeSeen = () => typeof window !== 'undefined' && localStorage.getItem(ACK_KEY) === '1'

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
  /** True once the user asked to dictate, so the bar shows even before recognition has started. */
  open: boolean
}

/**
 * Floating control shown while dictating. The first time, it explains where the audio goes before the browser
 * asks for the microphone, because in Chrome and Edge the browser sends speech to its vendor for recognition.
 */
export function DictationBar({ listening, interim, error, debug, lang, onLang, onStart, onStop, onDismiss, open }: Props) {
  const [acknowledged, setAcknowledged] = useState(dictationNoticeSeen)
  if (!open) return null

  function accept() {
    localStorage.setItem(ACK_KEY, '1')
    setAcknowledged(true)
    onStart()
  }

  return (
    <div role="region" aria-label="Dictation" style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(72px + env(safe-area-inset-bottom))', zIndex: 150,
      width: 'min(520px, calc(100% - 24px))', padding: '10px 12px', borderRadius: 12,
      backgroundColor: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {!acknowledged ? (
        <>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--foreground)', lineHeight: 1.5 }}>
            Dictation uses your browser&apos;s speech service. In Chrome and Edge your voice is sent to Google or Microsoft to be turned into text;
            dotstell never receives the audio. Nothing is recorded unless you press start.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onDismiss} style={ghostBtn}>Not now</button>
            <button type="button" onClick={accept} style={primaryBtn}><Mic size={13} /> Continue</button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span aria-hidden className={listening ? 'animate-pulse' : undefined} style={{ width: 10, height: 10, borderRadius: 99, flexShrink: 0, backgroundColor: listening ? '#ef4444' : 'var(--muted-foreground)' }} />
            <span role="status" aria-live="polite" style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {listening ? (interim || 'Listening… speak now') : 'Dictation is off'}
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted-foreground)' }}>
              <span className="sr-only">Language</span>
              <select value={lang} onChange={e => onLang(e.target.value)} aria-label="Dictation language" style={{ fontSize: 11, padding: '3px 4px', borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'var(--muted)', color: 'var(--foreground)', maxWidth: 130 }}>
                {DICTATION_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </label>
            {listening
              ? <button type="button" onClick={onStop} aria-label="Stop dictation" style={{ ...primaryBtn, backgroundColor: '#dc2626' }}><Square size={12} /> Stop</button>
              : <button type="button" onClick={onStart} aria-label="Start dictation" style={primaryBtn}><Mic size={13} /> Start</button>}
            <button type="button" onClick={onDismiss} aria-label="Close dictation" style={{ ...ghostBtn, padding: 5 }}><X size={14} /></button>
          </div>
          {error && <p role="alert" style={{ margin: 0, fontSize: 12, color: '#f87171' }}>{error}</p>}
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
