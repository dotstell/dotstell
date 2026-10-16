import type { AIConfig } from '../ai/types'

/** Where audio is sent to be turned into text. Both services are called from the browser with the user's own key. */
export interface TranscriptionTarget {
  provider: 'openai' | 'groq'
  apiKey: string
  model: string
  url: string
}

/** OpenAI's limit is 25 MB per file; stay well under it. */
export const MAX_AUDIO_BYTES = 24 * 1024 * 1024

const TARGETS = {
  openai: { model: 'whisper-1', url: 'https://api.openai.com/v1/audio/transcriptions' },
  groq: { model: 'whisper-large-v3-turbo', url: 'https://api.groq.com/openai/v1/audio/transcriptions' },
} as const

/**
 * The service to use for speech-to-text, taken from the AI settings: the chat provider when it is OpenAI or Groq,
 * otherwise an OpenAI key set up for embeddings. Null when the user has neither (Anthropic, Gemini and Ollama
 * have no transcription API).
 */
export function transcriptionTarget(config: AIConfig | null | undefined): TranscriptionTarget | null {
  if (!config) return null
  if ((config.provider === 'openai' || config.provider === 'groq') && config.apiKey?.trim()) {
    return { provider: config.provider, apiKey: config.apiKey.trim(), ...TARGETS[config.provider] }
  }
  if (config.embeddingProvider === 'openai' && config.embeddingApiKey?.trim()) {
    return { provider: 'openai', apiKey: config.embeddingApiKey.trim(), ...TARGETS.openai }
  }
  return null
}

function extensionFor(mime: string): string {
  if (mime.includes('mp4') || mime.includes('aac')) return 'mp4'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  return 'webm'
}

/** Sends one piece of audio and returns its text. Throws an Error whose message can be shown to the user. */
export async function transcribeAudio(
  audio: Blob,
  target: TranscriptionTarget,
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<string> {
  if (audio.size === 0) return ''
  if (audio.size > MAX_AUDIO_BYTES) throw new Error('That recording piece is too large to send. Stop and start the recording again.')

  const form = new FormData()
  form.append('file', audio, `audio.${extensionFor(audio.type)}`)
  form.append('model', target.model)
  form.append('response_format', 'json')

  let res: Response
  try {
    res = await (opts.fetchImpl ?? fetch)(target.url, {
      method: 'POST', headers: { Authorization: `Bearer ${target.apiKey}` }, body: form, signal: opts.signal,
    })
  } catch (err) {
    if (opts.signal?.aborted) throw err
    throw new Error(`Could not reach ${target.provider === 'openai' ? 'OpenAI' : 'Groq'}. Check your connection.`)
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const detail = typeof data?.error?.message === 'string' ? data.error.message : ''
    if (res.status === 401) throw new Error('The API key was rejected. Check it in AI Settings.')
    if (res.status === 413) throw new Error('That recording piece is too large to send.')
    if (res.status === 429) throw new Error('The speech service is rate limiting requests. Wait a moment and try again.')
    throw new Error(detail || `Speech-to-text failed (${res.status}).`)
  }
  const data = await res.json().catch(() => ({}))
  return typeof data.text === 'string' ? data.text.trim() : ''
}
