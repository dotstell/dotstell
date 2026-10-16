import { describe, it, expect } from 'vitest'
import { MAX_AUDIO_BYTES, transcribeAudio, transcriptionTarget } from './transcribe'
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
    expect(transcriptionTarget(cfg({ provider: 'gemini', apiKey: 'g' }))).toBeNull()
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
