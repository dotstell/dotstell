'use client'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

const SEGMENT_MS = 5 * 60 * 1000
/** Three hours; a meeting that long is almost certainly a recording left running. */
const MAX_SECONDS = 3 * 60 * 60

export type RecorderStatus = 'idle' | 'recording' | 'finishing'

interface Options {
  /** Turns one piece of audio into text. Rejecting marks that piece as failed so it can be retried. */
  transcribe: (audio: Blob) => Promise<string>
  /** Receives the text of each piece, in recording order. */
  onText: (text: string) => void
}

interface Pending { index: number; blob: Blob }

const noSubscription = () => () => {}
const canRecord = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported(t))
}

/**
 * Records the microphone (and optionally the audio of a shared browser tab, for online meetings) in short pieces and
 * transcribes each as it finishes, so text appears while the meeting is still going. Audio is held in memory only
 * until its piece is transcribed; nothing is saved.
 */
export function useRecorder({ transcribe, onText }: Options) {
  const supported = useSyncExternalStore(noSubscription, canRecord, () => false)
  const [status, setStatus] = useState<RecorderStatus>('idle')
  const [seconds, setSeconds] = useState(0)
  const [inFlight, setInFlight] = useState(0)
  const [failed, setFailed] = useState<Pending[]>([])
  const [error, setError] = useState<string | null>(null)

  const streamsRef = useRef<MediaStream[]>([])
  const ctxRef = useRef<AudioContext | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const segmentTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clockTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeRef = useRef(false)
  const nextIndex = useRef(0)
  const results = useRef(new Map<number, string>())
  const emitted = useRef(0)
  const optsRef = useRef({ transcribe, onText })
  // A recorder that ends starts the next one, so the function needs to reach itself.
  const startSegmentRef = useRef<(stream: MediaStream, mimeType: string | undefined) => void>(() => {})

  useEffect(() => { optsRef.current = { transcribe, onText } }, [transcribe, onText])

  /** Text is emitted in order even if a later piece finishes first, or an earlier one is retried. */
  const flush = useCallback(() => {
    while (results.current.has(emitted.current)) {
      const text = results.current.get(emitted.current)!
      results.current.delete(emitted.current)
      emitted.current++
      if (text) optsRef.current.onText(text + '\n')
    }
  }, [])

  const send = useCallback(async (piece: Pending) => {
    setInFlight(n => n + 1)
    try {
      const text = await optsRef.current.transcribe(piece.blob)
      results.current.set(piece.index, text)
      setFailed(list => list.filter(p => p.index !== piece.index))
      flush()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transcription failed.')
      setFailed(list => (list.some(p => p.index === piece.index) ? list : [...list, piece]))
    } finally {
      setInFlight(n => n - 1)
    }
  }, [flush])

  const releaseDevices = useCallback(() => {
    streamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()))
    streamsRef.current = []
    ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
    if (segmentTimer.current) clearTimeout(segmentTimer.current)
    if (clockTimer.current) clearInterval(clockTimer.current)
  }, [])

  /** Starts a recorder on the shared stream; when it stops, its audio is sent and (if still active) a new one starts. */
  const startSegment = useCallback((stream: MediaStream, mimeType: string | undefined) => {
    const chunks: Blob[] = []
    const rec = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32_000 })
    recorderRef.current = rec
    rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: rec.mimeType || mimeType || 'audio/webm' })
      if (blob.size > 0) void send({ index: nextIndex.current++, blob })
      if (activeRef.current) startSegmentRef.current(stream, mimeType)
      else { setStatus('idle'); releaseDevices() } // released only now, after the last piece has been flushed
    }
    rec.start()
    segmentTimer.current = setTimeout(() => { if (rec.state === 'recording') rec.stop() }, SEGMENT_MS)
  }, [send, releaseDevices])
  useEffect(() => { startSegmentRef.current = startSegment }, [startSegment])

  const start = useCallback(async (opts: { includeTabAudio?: boolean } = {}) => {
    setError(null)
    if (activeRef.current) return
    let mic: MediaStream
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch (err) {
      const denied = err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')
      setError(denied ? 'Microphone access is blocked. Allow it for this site in your browser settings, then try again.'
        : err instanceof DOMException && err.name === 'NotFoundError' ? 'No microphone was found.' : 'The microphone could not be started.')
      return
    }
    streamsRef.current = [mic]
    let stream = mic

    if (opts.includeTabAudio) {
      try {
        const display = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })
        display.getVideoTracks().forEach(t => t.stop()) // only the sound is wanted
        streamsRef.current.push(display)
        if (display.getAudioTracks().length === 0) {
          setError('No tab audio was shared. Choose a browser tab and tick "Also share tab audio". Recording your microphone only.')
        } else {
          const ctx = new AudioContext()
          const dest = ctx.createMediaStreamDestination()
          ctx.createMediaStreamSource(mic).connect(dest)
          ctx.createMediaStreamSource(new MediaStream(display.getAudioTracks())).connect(dest)
          ctxRef.current = ctx
          stream = dest.stream
        }
      } catch {
        setError('Tab audio was not shared. Recording your microphone only.')
      }
    }

    activeRef.current = true
    nextIndex.current = 0
    emitted.current = 0
    results.current.clear()
    setFailed([])
    setSeconds(0)
    setStatus('recording')
    clockTimer.current = setInterval(() => setSeconds(s => s + 1), 1000)
    startSegment(stream, pickMimeType())
  }, [startSegment])

  const stop = useCallback(() => {
    if (!activeRef.current) return
    activeRef.current = false
    setStatus('finishing')
    if (segmentTimer.current) clearTimeout(segmentTimer.current)
    if (clockTimer.current) clearInterval(clockTimer.current)
    const rec = recorderRef.current
    if (rec && rec.state === 'recording') rec.stop() // its onstop sends the last piece, goes idle and frees the devices
    else { setStatus('idle'); releaseDevices() }
  }, [releaseDevices])

  useEffect(() => { if (status === 'recording' && seconds >= MAX_SECONDS) stop() }, [seconds, status, stop])

  const retryFailed = useCallback(() => {
    setError(null)
    failed.forEach(p => void send(p))
  }, [failed, send])

  useEffect(() => () => {
    activeRef.current = false
    const rec = recorderRef.current
    if (rec && rec.state === 'recording') { rec.onstop = null; rec.stop() }
    streamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()))
    ctxRef.current?.close().catch(() => {})
    if (segmentTimer.current) clearTimeout(segmentTimer.current)
    if (clockTimer.current) clearInterval(clockTimer.current)
  }, [])

  return { supported, status, seconds, inFlight, failedCount: failed.length, error, start, stop, retryFailed }
}
