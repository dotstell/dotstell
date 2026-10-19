'use client'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createSegmenter } from '@/lib/voice/segmenter'
import { cleanTranscript, languageCode } from '@/lib/voice/transcript-filter'
import { transcribeAudio, type TranscriptionTarget } from '@/lib/voice/transcribe'

const POLL_MS = 50
const RETRY_DELAY_MS = 1000
/** How much of the text before is sent along as context for the next piece. */
const CONTEXT_CHARS = 200
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

const noSubscription = () => () => {}
const canRecord = () => typeof MediaRecorder !== 'undefined' && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

interface Segment {
  rec: MediaRecorder
  chunks: Blob[]
}

/** The rest of the recording is useless when the key is wrong, so these stop it. */
const isKeyProblem = (message: string) => message.includes('key was rejected')

/**
 * High accuracy dictation: the microphone is recorded, cut at pauses in speech, and each piece is turned into text
 * by a Whisper-class service (OpenAI, Groq or Gemini) with the user's own key. Unlike the browser's speech
 * recognition this uses the same models as the recording feature, which handle accents and earbuds better and
 * add punctuation and capital letters. Text arrives a moment after each pause, in order, through `onText`.
 *
 * Audio is held in memory only until its piece is transcribed, and is sent from the browser to the service, not
 * through dotstell's servers.
 */
export function useAccurateDictation(opts: {
  target: TranscriptionTarget | null
  /** A locale such as en-US; its language is passed to the service. */
  lang: string
  onText: (text: string) => void
}) {
  const supported = useSyncExternalStore(noSubscription, canRecord, () => false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [pending, setPending] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const optsRef = useRef(opts)
  const wantRef = useRef(false)
  const startingRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<AudioContext | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const abortRef = useRef<AbortController | null>(null)
  const contextRef = useRef('')
  const aliveRef = useRef(true)
  const stopCurrentRef = useRef<() => void>(() => {})

  useEffect(() => { optsRef.current = opts }, [opts])

  const release = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    audioRef.current?.close().catch(() => {})
    audioRef.current = null
  }, [])

  /** Transcribes one piece after the ones before it, so text always arrives in the order it was spoken. */
  const enqueue = useCallback((audio: Blob, speechMs: number) => {
    setPending(n => n + 1)
    queueRef.current = queueRef.current.then(async () => {
      const { target, lang } = optsRef.current
      try {
        if (!target) throw new Error('Choose a speech service first.')
        const options = { language: languageCode(lang), prompt: contextRef.current, signal: abortRef.current?.signal }
        let raw: string
        try {
          raw = await transcribeAudio(audio, target, options)
        } catch (err) {
          if (options.signal?.aborted || (err instanceof Error && isKeyProblem(err.message))) throw err
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
          raw = await transcribeAudio(audio, target, options)
        }
        const text = cleanTranscript(raw, { speechMs, context: contextRef.current })
        if (text && aliveRef.current) {
          contextRef.current = (contextRef.current + ' ' + text).slice(-CONTEXT_CHARS)
          optsRef.current.onText(text + ' ')
        }
      } catch (err) {
        if (abortRef.current?.signal.aborted || !aliveRef.current) return
        const message = err instanceof Error ? err.message : 'Transcription failed.'
        setError(message)
        if (isKeyProblem(message)) { wantRef.current = false; setListening(false); release() }
      } finally {
        if (aliveRef.current) setPending(n => n - 1)
      }
    })
  }, [release])

  const stop = useCallback(() => {
    wantRef.current = false
    setListening(false)
    setSpeaking(false)
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    // The recorder in progress is ended by the loop that owns it, which also sends its last piece.
    stopCurrentRef.current()
  }, [])

  const start = useCallback(async () => {
    if (wantRef.current || startingRef.current || !canRecord()) return
    if (!optsRef.current.target) {
      setError('High accuracy needs a speech key. Add an OpenAI, Groq or Gemini key in AI settings, or in the recording box of the Meeting assistant.')
      return
    }
    setError(null)
    startingRef.current = true
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch (err) {
      startingRef.current = false
      const denied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')
      setError(denied ? 'Microphone access is blocked. Allow it for this site in your browser settings, then try again.' : 'No microphone was found.')
      return
    }
    startingRef.current = false
    if (!aliveRef.current) { stream.getTracks().forEach(t => t.stop()); return }

    wantRef.current = true
    abortRef.current = new AbortController()
    streamRef.current = stream
    const mimeType = MIME_TYPES.find(t => MediaRecorder.isTypeSupported(t))

    const audio = new AudioContext()
    audioRef.current = audio
    const analyser = audio.createAnalyser()
    analyser.fftSize = 1024
    audio.createMediaStreamSource(stream).connect(analyser)
    const samples = new Float32Array(analyser.fftSize)
    const segmenter = createSegmenter()

    let current: Segment | null = null
    /** Starts recording the next piece; the one before it is ended separately, so no sound falls between them. */
    const open = (): Segment => {
      const rec = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32_000 })
      const segment: Segment = { rec, chunks: [] }
      rec.ondataavailable = e => { if (e.data.size > 0) segment.chunks.push(e.data) }
      rec.start()
      return segment
    }
    const close = (segment: Segment, cut: { hadSpeech: boolean; speechMs: number }, last: boolean) => {
      segment.rec.onstop = () => {
        const blob = new Blob(segment.chunks, { type: segment.rec.mimeType || mimeType || 'audio/webm' })
        if (cut.hadSpeech && blob.size > 0) enqueue(blob, cut.speechMs)
        if (last) {
          // Only this run's microphone: a new run may already have its own.
          stream.getTracks().forEach(t => t.stop())
          audio.close().catch(() => {})
          if (streamRef.current === stream) { streamRef.current = null; audioRef.current = null }
        }
      }
      if (segment.rec.state !== 'inactive') segment.rec.stop()
      else segment.rec.onstop?.(new Event('stop'))
    }

    stopCurrentRef.current = () => {
      if (!current) return
      const ending = current
      current = null
      close(ending, segmenter.finish(), true)
    }

    current = open()
    setListening(true)
    let shown = false
    timerRef.current = setInterval(() => {
      analyser.getFloatTimeDomainData(samples)
      let sum = 0
      for (const s of samples) sum += s * s
      const { speaking: voice, cut } = segmenter.push(Math.sqrt(sum / samples.length), performance.now())
      if (voice !== shown) { shown = voice; setSpeaking(voice) }
      if (cut && current) {
        const ending = current
        current = open()
        close(ending, cut, false)
      }
    }, POLL_MS)
  }, [enqueue])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      wantRef.current = false
      abortRef.current?.abort()
      if (timerRef.current) clearInterval(timerRef.current)
      stopCurrentRef.current()
      release()
    }
  }, [release])

  return {
    supported, listening, speaking, error, start, stop,
    /** Shown in the bar: what is happening to the audio. */
    interim: pending > 0 ? 'Transcribing…' : speaking ? 'Listening…' : '',
  }
}
