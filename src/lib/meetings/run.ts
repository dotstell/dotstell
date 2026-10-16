import type { AIConfig, AIMessage } from '../ai/types'
import { chunkTranscript } from './transcript'
import { mergeDigests, parseDigest, type MeetingDigest } from './digest'
import { buildChunkMessages, buildCombineMessages, CHUNK_CHARS, COMBINE_GROUP } from './prompts'

export interface SummariseOptions {
  config: AIConfig
  title?: string
  attendees?: string[]
  /** Called as each step finishes: `done` of `total` steps (the last step combines the parts). */
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
  /**
   * Runs a prompt directly from the browser, for Ollama on the live site (the server cannot reach the user's computer).
   * When set, no request is made to the dotstell server. It should ask for a JSON reply.
   */
  completeLocal?: (messages: AIMessage[]) => Promise<string>
  /** For tests; defaults to the global fetch. */
  fetchImpl?: typeof fetch
}

type MeetingRequest =
  | { mode: 'chunk'; text: string; index: number; total: number; title?: string; attendees?: string[] }
  | { mode: 'combine'; parts: MeetingDigest[] }

async function callMeeting(body: MeetingRequest, opts: SummariseOptions): Promise<MeetingDigest> {
  if (opts.completeLocal) {
    const messages = body.mode === 'chunk' ? buildChunkMessages(body) : buildCombineMessages(body.parts)
    if (!messages) throw new Error('No usable parts to combine.')
    const digest = parseDigest(await opts.completeLocal(messages))
    if (!digest) throw new Error('The model did not return usable notes. Try again, or choose a larger model in AI Settings.')
    return digest
  }
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

/** How many combine requests merging `n` parts takes, merging up to COMBINE_GROUP at a time (a lone part needs none). */
function combineCalls(n: number): number {
  let calls = 0
  while (n > 1) {
    const full = Math.floor(n / COMBINE_GROUP)
    const rest = n % COMBINE_GROUP
    calls += full + (rest > 1 ? 1 : 0)
    n = full + (rest > 0 ? 1 : 0)
  }
  return calls
}

/**
 * Turns a cleaned transcript into meeting notes. A long transcript is summarised piece by piece, then the pieces
 * are combined; if the combining step fails the pieces are merged locally so the work is not lost.
 */
export async function summariseMeeting(transcript: string, opts: SummariseOptions): Promise<MeetingDigest> {
  // Local models have small context windows and generate slowly, so they get smaller pieces.
  const chunks = chunkTranscript(transcript, opts.config.provider === 'ollama' ? CHUNK_CHARS.local : CHUNK_CHARS.hosted)
  if (chunks.length === 0) throw new Error('The transcript is empty.')
  const steps = chunks.length + combineCalls(chunks.length)

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
    // Many small pieces are merged in groups, then the groups are merged, until one remains.
    let done = chunks.length
    let level = parts
    while (level.length > 1) {
      const next: MeetingDigest[] = []
      for (let i = 0; i < level.length; i += COMBINE_GROUP) {
        const group = level.slice(i, i + COMBINE_GROUP)
        if (group.length === 1) { next.push(group[0]); continue }
        if (opts.signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
        next.push(await withRetry(() => callMeeting({ mode: 'combine', parts: group }, opts), opts.signal))
        opts.onProgress?.(++done, steps)
      }
      level = next
    }
    const combined = level[0]
    opts.onProgress?.(steps, steps)
    // The model writes the overall summary, but merging may quietly drop a task. A lost task is worse than a repeated
    // one the reader can delete, so the action items are always the union of the parts.
    return { ...combined, actionItems: mergeDigests(parts).actionItems }
  } catch (err) {
    if (opts.signal?.aborted) throw err
    opts.onProgress?.(steps, steps)
    return mergeDigests(parts)
  }
}
