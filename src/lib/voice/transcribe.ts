import { DEFAULT_CHAT_MODELS, type AIConfig } from '../ai/types'
import { blobToBase64, blobToWav } from './wav'

export type SpeechProvider = 'openai' | 'groq' | 'gemini'

/** A speech-to-text key chosen on its own, separate from the chat provider. */
export interface SpeechSettings {
  provider: SpeechProvider
  apiKey: string
}

/** Where audio is sent to be turned into text. All services are called from the browser with the user's own key. */
export interface TranscriptionTarget {
  provider: SpeechProvider
  apiKey: string
  model: string
  url: string
}

/** OpenAI's limit is 25 MB per file; stay well under it. */
export const MAX_AUDIO_BYTES = 24 * 1024 * 1024

export const SPEECH_PROVIDER_NAMES: Record<SpeechProvider, string> = { openai: 'OpenAI', groq: 'Groq', gemini: 'Google Gemini' }

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

const TRANSCRIBE_PROMPT = 'Transcribe this audio exactly as spoken, in the language spoken. Reply with the transcript text only, with no introduction or commentary. If there is no speech, reply with nothing.'

function target(provider: SpeechProvider, apiKey: string, geminiModel?: string): TranscriptionTarget {
  const key = apiKey.trim()
  if (provider === 'openai') return { provider, apiKey: key, model: 'whisper-1', url: 'https://api.openai.com/v1/audio/transcriptions' }
  if (provider === 'groq') return { provider, apiKey: key, model: 'whisper-large-v3-turbo', url: 'https://api.groq.com/openai/v1/audio/transcriptions' }
  const model = geminiModel || DEFAULT_CHAT_MODELS.gemini
  return { provider, apiKey: key, model, url: `${GEMINI_BASE}/models/${model}:generateContent` }
}

/**
 * The service to use for speech-to-text, in order of preference: a key chosen on its own for this purpose; the chat
 * provider when it can transcribe (OpenAI, Groq, Gemini); an OpenAI key set up for embeddings. Null when none
 * applies, which is the case for Anthropic and Ollama users who have not added a separate key.
 */
export function transcriptionTarget(config: AIConfig | null | undefined, own?: SpeechSettings | null): TranscriptionTarget | null {
  if (own?.apiKey.trim()) return target(own.provider, own.apiKey, config?.provider === 'gemini' ? config.model : undefined)
  if (!config) return null
  if ((config.provider === 'openai' || config.provider === 'groq' || config.provider === 'gemini') && config.apiKey?.trim()) {
    return target(config.provider, config.apiKey, config.provider === 'gemini' ? config.model : undefined)
  }
  if (config.embeddingProvider === 'openai' && config.embeddingApiKey?.trim()) return target('openai', config.embeddingApiKey)
  return null
}

function extensionFor(mime: string): string {
  if (mime.includes('mp4') || mime.includes('aac')) return 'mp4'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('wav')) return 'wav'
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3'
  return 'webm'
}

interface Options {
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  /** For tests: replaces the browser's audio conversion. */
  toWav?: (audio: Blob) => Promise<Blob>
  /** Two-letter language of the speech (OpenAI and Groq). Saying it avoids a wrong guess on short pieces. */
  language?: string
  /** What came just before, so names, spelling and style carry on across pieces (OpenAI and Groq). */
  prompt?: string
}

async function post(url: string, init: RequestInit, provider: SpeechProvider, opts: Options): Promise<Response> {
  try {
    return await (opts.fetchImpl ?? fetch)(url, { ...init, signal: opts.signal })
  } catch (err) {
    if (opts.signal?.aborted) throw err
    throw new Error(`Could not reach ${SPEECH_PROVIDER_NAMES[provider]}. Check your connection.`)
  }
}

async function failure(res: Response): Promise<Error> {
  const data = await res.json().catch(() => ({}))
  const detail = typeof data?.error?.message === 'string' ? data.error.message : ''
  if (res.status === 401 || res.status === 403) return new Error('The API key was rejected. Check it in AI Settings or in the recording box.')
  if (res.status === 413) return new Error('That recording piece is too large to send.')
  if (res.status === 429) return new Error('The speech service is rate limiting requests. Wait a moment and try again.')
  return new Error(detail || `Speech-to-text failed (${res.status}).`)
}

async function transcribeWithGemini(audio: Blob, t: TranscriptionTarget, opts: Options): Promise<string> {
  // Gemini accepts WAV, MP3, AAC, OGG and FLAC, but the browser records WebM or MP4, so convert first.
  const wav = await (opts.toWav ?? blobToWav)(audio)
  const res = await post(t.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': t.apiKey },
    body: JSON.stringify({ contents: [{ parts: [{ text: TRANSCRIBE_PROMPT }, { inline_data: { mime_type: 'audio/wav', data: await blobToBase64(wav) } }] }] }),
  }, 'gemini', opts)
  if (!res.ok) throw await failure(res)
  const data = await res.json().catch(() => ({}))
  const parts: { text?: string }[] = data?.candidates?.[0]?.content?.parts ?? []
  return parts.map(p => p.text ?? '').join('').trim()
}

/** Sends one piece of audio and returns its text. Throws an Error whose message can be shown to the user. */
export async function transcribeAudio(audio: Blob, t: TranscriptionTarget, opts: Options = {}): Promise<string> {
  if (audio.size === 0) return ''
  if (audio.size > MAX_AUDIO_BYTES) throw new Error('That recording piece is too large to send. Stop and start the recording again.')
  if (t.provider === 'gemini') return transcribeWithGemini(audio, t, opts)

  const form = new FormData()
  form.append('file', audio, `audio.${extensionFor(audio.type)}`)
  form.append('model', t.model)
  form.append('response_format', 'json')
  if (opts.language) form.append('language', opts.language)
  if (opts.prompt?.trim()) form.append('prompt', opts.prompt.trim().slice(-200))
  const res = await post(t.url, { method: 'POST', headers: { Authorization: `Bearer ${t.apiKey}` }, body: form }, t.provider, opts)
  if (!res.ok) throw await failure(res)
  const data = await res.json().catch(() => ({}))
  return typeof data.text === 'string' ? data.text.trim() : ''
}
