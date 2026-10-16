import type { AIConfig } from '../ai/types'
import { chunkTranscript } from './transcript'
import { mergeDigests, parseDigest, type MeetingDigest } from './digest'

export interface SummariseOptions {
  config: AIConfig
  title?: string
  attendees?: string[]
  /** Called as each step finishes: `done` of `total` steps (the last step combines the parts). */
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
  /** For tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

async function callMeeting(body: object, opts: SummariseOptions): Promise<MeetingDigest> {
  const res = await (opts.fetchImpl ?? fetch)('/api/ai/meeting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: opts.config, ...body }),
    signal: opts.signal,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Meeting summary failed')
  const digest = parseDigest(JSON.stringify(data.digest))
  if (!digest) throw new Error('The model did not return usable notes.')
  return digest
}

/** One retry: small models often fail to produce valid JSON the first time. Cancelling is never retried. */
async function withRetry<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  try { return await run() } catch (err) {
    if (signal?.aborted) throw err
    return run()
  }
}

/**
 * Turns a cleaned transcript into meeting notes. A long transcript is summarised piece by piece, then the pieces
 * are combined; if the combining step fails the pieces are merged locally so the work is not lost.
 */
export async function summariseMeeting(transcript: string, opts: SummariseOptions): Promise<MeetingDigest> {
  const chunks = chunkTranscript(transcript)
  if (chunks.length === 0) throw new Error('The transcript is empty.')
  const steps = chunks.length === 1 ? 1 : chunks.length + 1

  const parts: MeetingDigest[] = []
  for (let i = 0; i < chunks.length; i++) {
    if (opts.signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
    parts.push(await withRetry(
      () => callMeeting({ mode: 'chunk', text: chunks[i], index: i, total: chunks.length, title: opts.title, attendees: opts.attendees }, opts),
      opts.signal,
    ))
    opts.onProgress?.(i + 1, steps)
  }
  if (parts.length === 1) return parts[0]

  try {
    const combined = await withRetry(() => callMeeting({ mode: 'combine', parts }, opts), opts.signal)
    opts.onProgress?.(steps, steps)
    return combined
  } catch (err) {
    if (opts.signal?.aborted) throw err
    opts.onProgress?.(steps, steps)
    return mergeDigests(parts)
  }
}
