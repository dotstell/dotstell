import { describe, it, expect, vi, afterEach } from 'vitest'
import { complete } from './client'
import type { AIConfig, AIMessage } from './types'

const messages: AIMessage[] = [{ role: 'system', content: 'Reply with JSON.' }, { role: 'user', content: 'Hello' }]
const cfg = (o: Partial<AIConfig>) => ({ provider: 'openai', apiKey: 'key', model: 'gpt-4o-mini', embeddingProvider: 'openai', embeddingModel: 'e', ...o }) as AIConfig

const SSE = {
  openai: 'data: {"choices":[{"delta":{"content":"{\\"ok\\":true}"}}]}\n\ndata: [DONE]\n\n',
  gemini: 'data: {"candidates":[{"content":{"parts":[{"text":"{\\"ok\\":true}"}]}}]}\n\n',
  anthropic: 'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"{\\"ok\\":true}"}}\n\nevent: message_stop\ndata: {"type":"message_stop"}\n\n',
}

/** Replaces fetch, records each request, and answers with a short stream in the provider's own format. */
function mockFetch(kind: keyof typeof SSE, statuses: number[] = [200]) {
  const calls: { url: string; headers: Record<string, string>; body: Record<string, unknown> }[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) })
    const status = statuses[Math.min(calls.length - 1, statuses.length - 1)]
    return status === 200
      ? new Response(SSE[kind], { status: 200 })
      : new Response(JSON.stringify({ error: { message: 'response_format is not supported' } }), { status })
  }))
  return calls
}

afterEach(() => vi.unstubAllGlobals())

describe('JSON mode per provider', () => {
  it('OpenAI: sends response_format when asked, and not otherwise', async () => {
    const calls = mockFetch('openai')
    expect(await complete(cfg({}), messages, { json: true })).toBe('{"ok":true}')
    await complete(cfg({}), messages)
    expect(calls[0].body.response_format).toEqual({ type: 'json_object' })
    expect(calls[1].body.response_format).toBeUndefined()
    expect(calls[0].url).toBe('https://api.openai.com/v1/chat/completions')
  })

  it('OpenAI: leaves response_format out for the first-generation o1 models, which reject it', async () => {
    const calls = mockFetch('openai')
    await complete(cfg({ model: 'o1-mini' }), messages, { json: true })
    expect(calls[0].body.response_format).toBeUndefined()
  })

  it('Groq: same wire format on the Groq endpoint', async () => {
    const calls = mockFetch('openai')
    await complete(cfg({ provider: 'groq', model: 'llama-3.1-8b-instant' }), messages, { json: true })
    expect(calls[0].url).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect(calls[0].body.response_format).toEqual({ type: 'json_object' })
  })

  it('Gemini: asks for a JSON mime type and keeps the system prompt separate', async () => {
    const calls = mockFetch('gemini')
    expect(await complete(cfg({ provider: 'gemini', model: 'gemini-flash' }), messages, { json: true })).toBe('{"ok":true}')
    expect(calls[0].body.generationConfig).toEqual({ responseMimeType: 'application/json' })
    expect(calls[0].body.systemInstruction).toBeDefined()
    expect(calls[0].headers['x-goog-api-key']).toBe('key')
  })

  it('Anthropic: has no JSON mode, so the request is unchanged', async () => {
    const calls = mockFetch('anthropic')
    expect(await complete(cfg({ provider: 'anthropic', model: 'claude' }), messages, { json: true })).toBe('{"ok":true}')
    expect(calls[0].body.response_format).toBeUndefined()
    expect(calls[0].body.generationConfig).toBeUndefined()
    expect(calls[0].body.system).toBe('Reply with JSON.')
    expect(calls[0].body.max_tokens).toBeGreaterThan(1000)
  })

  it('Ollama on the server (local development): OpenAI-compatible endpoint with response_format', async () => {
    const calls = mockFetch('openai')
    await complete(cfg({ provider: 'ollama', apiKey: undefined, model: 'phi4-mini', baseUrl: 'http://localhost:11434' }), messages, { json: true })
    expect(calls[0].url).toBe('http://localhost:11434/v1/chat/completions')
    expect(calls[0].body.response_format).toEqual({ type: 'json_object' })
  })
})
