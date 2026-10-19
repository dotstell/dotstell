'use client'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createDictationAssembler } from '@/lib/voice/dictation-assembler'

// The Web Speech API is not in TypeScript's DOM types; these are the parts used here.
interface RecognitionResult { isFinal: boolean; 0: { transcript: string; confidence?: number } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

export const DICTATION_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en-US', label: 'English (US)' }, { code: 'en-GB', label: 'English (UK)' }, { code: 'ja-JP', label: '日本語' },
  { code: 'zh-CN', label: '中文 (简体)' }, { code: 'ko-KR', label: '한국어' }, { code: 'es-ES', label: 'Español' },
  { code: 'fr-FR', label: 'Français' }, { code: 'de-DE', label: 'Deutsch' }, { code: 'pt-BR', label: 'Português (Brasil)' },
  { code: 'it-IT', label: 'Italiano' }, { code: 'hi-IN', label: 'हिन्दी' }, { code: 'bn-BD', label: 'বাংলা' },
]

const LANG_KEY = 'dotstell:dictation-lang'

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const noSubscription = () => () => {}

/** Android Chrome reports continuous results as the whole session so far, so the assembler starts in that mode there. */
const isAndroid = () => typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

/** A session that ends this quickly, this many times in a row, is a failure loop, not a pause in speech. */
const QUICK_END_MS = 400
const MAX_QUICK_ENDS = 5
const DEBUG_KEY = 'dotstell:dictation-debug'
const DEBUG_LINES = 14

function debugEnabled(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(DEBUG_KEY) === '1' || new URLSearchParams(window.location.search).has('dictationDebug')
}

function initialLanguage(): string {
  if (typeof window === 'undefined') return 'en-US'
  const saved = localStorage.getItem(LANG_KEY)
  return saved ?? (DICTATION_LANGUAGES.some(l => l.code === navigator.language) ? navigator.language : 'en-US')
}

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked. Allow it for this site in your browser settings, then try again.',
  'service-not-allowed': 'Your browser does not allow speech recognition for this site.',
  'audio-capture': 'No microphone was found.',
  network: 'The browser\'s speech service could not be reached. Check your connection.',
  'language-not-supported': 'That language is not available for dictation in this browser.',
}

/**
 * Voice dictation with the browser's own speech recognition. `onText` receives each finished phrase, once. Recognition
 * stops by itself after a pause in some browsers, so it is restarted until the user presses stop.
 *
 * Only the newest recognition session is listened to, and what it reports goes through `createDictationAssembler`,
 * so a late event from an ended session or a result list that repeats earlier words never inserts text twice.
 */
export function useDictation(onText: (text: string) => void) {
  // Support is a fact about the browser; the server snapshot says no so server and client first render agree.
  const supported = useSyncExternalStore(noSubscription, () => recognitionCtor() !== null, () => false)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [lang, setLangState] = useState(initialLanguage)
  const [debug, setDebug] = useState<string[]>([])
  const recRef = useRef<Recognition | null>(null)
  const wantRef = useRef(false)
  const quickEndsRef = useRef(0)
  const onTextRef = useRef(onText)

  useEffect(() => { onTextRef.current = onText }, [onText])

  const stop = useCallback(() => {
    wantRef.current = false
    recRef.current?.stop()
    setListening(false)
    setInterim('')
  }, [])

  const start = useCallback(() => {
    const Ctor = recognitionCtor()
    if (!Ctor || wantRef.current) return // already running: a second session would insert every word twice
    setError(null)
    wantRef.current = true
    quickEndsRef.current = 0
    const logging = debugEnabled()
    if (logging) setDebug([])

    const begin = () => {
      const rec = new Ctor()
      recRef.current = rec
      const startedAt = Date.now()
      const assembler = createDictationAssembler({ assumeCumulative: isAndroid() })
      // Events from a session that has been replaced or stopped are ignored.
      const current = () => recRef.current === rec

      rec.lang = lang
      rec.continuous = true
      rec.interimResults = true
      rec.onresult = e => {
        if (!current()) return
        const pieces = Array.from(e.results, r => ({ isFinal: r.isFinal, transcript: r[0].transcript }))
        if (logging) {
          const line = `#${e.resultIndex} ` + Array.from(e.results, (r, i) => `${i}${r.isFinal ? 'F' : 'i'}${r[0].confidence ?? '?'}:"${r[0].transcript}"`).join(' ')
          setDebug(prev => [...prev, line].slice(-DEBUG_LINES))
        }
        const { insert, interim: partial } = assembler.update(e.resultIndex, pieces)
        for (const text of insert) onTextRef.current(text + ' ')
        setInterim(partial)
      }
      rec.onerror = e => {
        if (!current()) return
        if (e.error === 'no-speech' || e.error === 'aborted') return
        wantRef.current = false
        setError(ERRORS[e.error] ?? 'Dictation stopped unexpectedly.')
      }
      rec.onend = () => {
        if (!current()) return
        if (wantRef.current) {
          quickEndsRef.current = Date.now() - startedAt < QUICK_END_MS ? quickEndsRef.current + 1 : 0
          if (quickEndsRef.current >= MAX_QUICK_ENDS) {
            wantRef.current = false
            setListening(false); setInterim('')
            setError('Dictation keeps stopping on this device. Check the microphone permission and try again.')
            return
          }
          try { begin() } catch { wantRef.current = false; setListening(false) }
          return
        }
        setListening(false); setInterim('')
      }
      rec.start()
    }

    try { begin(); setListening(true) } catch { wantRef.current = false; setError('Dictation could not start.') }
  }, [lang])

  const setLang = useCallback((code: string) => {
    setLangState(code)
    localStorage.setItem(LANG_KEY, code)
    // A running session keeps the language it started with, so stop it; the user starts again in the new one.
    if (wantRef.current) stop()
  }, [stop])

  useEffect(() => () => { wantRef.current = false; recRef.current?.abort() }, [])

  return { supported, listening, interim, error, lang, setLang, start, stop, debug }
}
