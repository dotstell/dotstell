import { describe, it, expect } from 'vitest'
import { MAX_AUDIO_BYTES, transcribeAudio, transcriptionTarget } from './transcribe'
import { encodeWav } from './wav'
import type { AIConfig } from '../ai/types'

const base = { model: 'm', embeddingProvider: 'ollama', embeddingModel: 'e' } as const
const cfg = (o: Partial<AIConfig>) => ({ provider: 'ollama', ...base, ...o }) as AIConfig

describe('transcriptionTarget', () => {
  it('uses the chat provider when it is OpenAI or Groq', () => {
    expect(transcriptionTarget(cfg({ provider: 'openai', apiKey: ' sk-1 ' }))).toMatchObject({ provider: 'openai', apiKey: 'sk-1', model: 'whisper-1' })
    expect(transcriptionTarget(cfg({ provider: 'groq', apiKey: 'gsk' }))).toMatchObject({ provider: 'groq', model: 'whisper-large-v3-turbo' })
  })
  it('falls back to an OpenAI embeddings key', () => {
    expect(transcriptionTarget(cfg({ provider: 'anthropic', apiKey: 'a', embeddingProvider: 'openai', embeddingApiKey: 'sk-e' }))).toMatchObject({ provider: 'openai', apiKey: 'sk-e' })
  })
  it('is null when no usable key exists', () => {
    expect(transcriptionTarget(cfg({ provider: 'openai', apiKey: '  ' }))).toBeNull()
    expect(transcriptionTarget(cfg({ provider: 'anthropic', apiKey: 'a' }))).toBeNull()
    expect(transcriptionTarget(cfg({}))).toBeNull()
    expect(transcriptionTarget(null)).toBeNull()
  })
})

describe('transcribeAudio', () => {
  const target = transcriptionTarget(cfg({ provider: 'openai', apiKey: 'sk-1' }))!
  const audio = (type = 'audio/webm', size = 10) => new Blob([new Uint8Array(size)], { type })
  const reply = (body: object, status = 200) => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch

  it('posts the file with the key and returns the trimmed text', async () => {
    let seen: { url: string; init: RequestInit } | undefined
    const fetchImpl = (async (url: string, init: RequestInit) => { seen = { url, init }; return new Response('{"text":"  Hello team. "}') }) as unknown as typeof fetch
    expect(await transcribeAudio(audio('audio/mp4;codecs=opus'), target, { fetchImpl })).toBe('Hello team.')
    expect(seen?.url).toBe('https://api.openai.com/v1/audio/transcriptions')
    expect((seen?.init.headers as Record<string, string>).Authorization).toBe('Bearer sk-1')
    const form = seen?.init.body as FormData
    expect(form.get('model')).toBe('whisper-1')
    expect((form.get('file') as File).name).toBe('audio.mp4')
  })
  it('turns service errors into messages a person can act on', async () => {
    await expect(transcribeAudio(audio(), target, { fetchImpl: reply({}, 401) })).rejects.toThrow('key was rejected')
    await expect(transcribeAudio(audio(), target, { fetchImpl: reply({}, 429) })).rejects.toThrow('rate limiting')
    await expect(transcribeAudio(audio(), target, { fetchImpl: reply({ error: { message: 'Bad audio' } }, 400) })).rejects.toThrow('Bad audio')
    const offline = (async () => { throw new TypeError('failed') }) as unknown as typeof fetch
    await expect(transcribeAudio(audio(), target, { fetchImpl: offline })).rejects.toThrow('Could not reach OpenAI')
  })
  it('skips empty audio and refuses oversized audio without calling the service', async () => {
    let called = 0
    const fetchImpl = (async () => { called++; return new Response('{}') }) as unknown as typeof fetch
    expect(await transcribeAudio(audio('audio/webm', 0), target, { fetchImpl })).toBe('')
    await expect(transcribeAudio({ size: MAX_AUDIO_BYTES + 1, type: 'audio/webm' } as Blob, target, { fetchImpl })).rejects.toThrow('too large')
    expect(called).toBe(0)
  })
})

describe('speech service choice', () => {
  it('prefers a key chosen on its own over the chat provider', () => {
    const t = transcriptionTarget(cfg({ provider: 'openai', apiKey: 'sk-chat' }), { provider: 'groq', apiKey: ' gsk-own ' })
    expect(t).toMatchObject({ provider: 'groq', apiKey: 'gsk-own' })
  })
  it('lets Anthropic and Ollama users record by adding their own key', () => {
    expect(transcriptionTarget(cfg({ provider: 'anthropic', apiKey: 'a' }))).toBeNull()
    expect(transcriptionTarget(cfg({ provider: 'anthropic', apiKey: 'a' }), { provider: 'openai', apiKey: 'sk' })).toMatchObject({ provider: 'openai' })
    expect(transcriptionTarget(cfg({}), { provider: 'groq', apiKey: 'g' })).toMatchObject({ provider: 'groq' })
  })
  it('lets Gemini users record with the key they already have, on their chosen model', () => {
    expect(transcriptionTarget(cfg({ provider: 'gemini', apiKey: 'g', model: 'gemini-flash' }))).toMatchObject({
      provider: 'gemini', model: 'gemini-flash', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash:generateContent',
    })
  })
})

describe('Gemini transcription', () => {
  const target = transcriptionTarget(cfg({ provider: 'gemini', apiKey: 'g-key', model: 'gemini-flash' }))!
  const toWav = async () => new Blob([new Uint8Array([82, 73, 70, 70])], { type: 'audio/wav' })

  it('sends the audio inline as WAV with the key in a header, and joins the reply parts', async () => {
    let seen: { url: string; init: RequestInit } | undefined
    const fetchImpl = (async (url: string, init: RequestInit) => {
      seen = { url, init }
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: ' Hello ' }, { text: 'team. ' }] } }] }))
    }) as unknown as typeof fetch
    expect(await transcribeAudio(new Blob([new Uint8Array(10)], { type: 'audio/webm' }), target, { fetchImpl, toWav })).toBe('Hello team.')
    expect((seen?.init.headers as Record<string, string>)['x-goog-api-key']).toBe('g-key')
    const part = JSON.parse(String(seen?.init.body)).contents[0].parts[1].inline_data
    expect(part.mime_type).toBe('audio/wav')
    expect(part.data).toBe('UklGRg==') // "RIFF" in base64
    expect(seen?.url).not.toContain('g-key')
  })
  it('returns nothing when the reply has no text, and explains a rejected key', async () => {
    const empty = (async () => new Response('{"candidates":[]}')) as unknown as typeof fetch
    expect(await transcribeAudio(new Blob([new Uint8Array(10)]), target, { fetchImpl: empty, toWav })).toBe('')
    const denied = (async () => new Response('{}', { status: 403 })) as unknown as typeof fetch
    await expect(transcribeAudio(new Blob([new Uint8Array(10)]), target, { fetchImpl: denied, toWav })).rejects.toThrow('key was rejected')
  })
})

describe('encodeWav', () => {
  it('writes a valid 16-bit mono header and clamps samples', () => {
    const bytes = encodeWav(new Float32Array([0, 1, -1, 2, -2]), 16000)
    const view = new DataView(bytes.buffer)
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF')
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE')
    expect(view.getUint16(22, true)).toBe(1)       // mono
    expect(view.getUint32(24, true)).toBe(16000)   // sample rate
    expect(view.getUint16(34, true)).toBe(16)      // bits per sample
    expect(view.getUint32(40, true)).toBe(10)      // data bytes
    expect(bytes.length).toBe(54)
    expect([view.getInt16(44, true), view.getInt16(46, true), view.getInt16(48, true), view.getInt16(50, true), view.getInt16(52, true)]).toEqual([0, 32767, -32768, 32767, -32768])
  })
})
