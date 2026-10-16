'use client'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

// The Web Speech API is not in TypeScript's DOM types; these are the parts used here.
interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
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
 * Voice dictation with the browser's own speech recognition. `onText` receives each finished phrase. Recognition
 * stops by itself after a pause in some browsers, so it is restarted until the user presses stop.
 */
export function useDictation(onText: (text: string) => void) {
  // Support is a fact about the browser; the server snapshot says no so server and client first render agree.
  const supported = useSyncExternalStore(noSubscription, () => recognitionCtor() !== null, () => false)
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [lang, setLangState] = useState(initialLanguage)
  const recRef = useRef<Recognition | null>(null)
  const wantRef = useRef(false)
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
    if (!Ctor) return
    setError(null)
    wantRef.current = true

    const begin = () => {
      const rec = new Ctor()
      recRef.current = rec
      rec.lang = lang
      rec.continuous = true
      rec.interimResults = true
      rec.onresult = e => {
        let partial = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const piece = e.results[i][0].transcript
          if (e.results[i].isFinal) { const text = piece.trim(); if (text) onTextRef.current(text + ' ') }
          else partial += piece
        }
        setInterim(partial)
      }
      rec.onerror = e => {
        if (e.error === 'no-speech' || e.error === 'aborted') return
        wantRef.current = false
        setError(ERRORS[e.error] ?? 'Dictation stopped unexpectedly.')
      }
      rec.onend = () => {
        if (wantRef.current) { try { begin() } catch { wantRef.current = false; setListening(false) } return }
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

  return { supported, listening, interim, error, lang, setLang, start, stop }
}
