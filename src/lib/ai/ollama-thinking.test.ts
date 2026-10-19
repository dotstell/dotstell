import { describe, it, expect, vi, afterEach } from 'vitest'
import { complete } from './client'
import { ollamaChatBody, streamOllamaBrowser, completeOllamaBrowser } from './ollama-browser'
import type { AIConfig, AIMessage } from './types'

const messages: AIMessage[] = [{ role: 'user', content: 'Hello' }]
const cfg = (o: Partial<AIConfig>) => ({ provider: 'ollama', model: 'gemma4:e4b', baseUrl: 'http://localhost:11434', embeddingProvider: 'ollama', embeddingModel: 'e', ...o }) as AIConfig

afterEach(() => vi.unstubAllGlobals())

describe('ollamaChatBody', () => {
  it('switches thinking off and uses a bigger context window by default', () => {
    const body = ollamaChatBody(cfg({}), messages)
    expect(body.think).toBe(false)
    expect(body.options.num_ctx).toBe(8192)
    expect(body.options).not.toHaveProperty('num_predict')
  })
  it('keeps the explicit context and reply limit that the meeting feature sets', () => {
    const body = ollamaChatBody(cfg({}), messages, { json: true, numCtx: 4096, temperature: 0.1 })
    expect(body.format).toBe('json')
    expect(body.options).toEqual({ num_ctx: 4096, num_predict: 2048, temperature: 0.1 })
  })
  it('leaves the setting out when asked to', () => {
    expect(ollamaChatBody(cfg({}), messages, {}, false)).not.toHaveProperty('think')
  })
})

describe('browser path', () => {
  const ndjson = '{"message":{"content":"Hi"},"done":false}\n{"message":{"content":""},"done":true}\n'

  it('asks again without the setting when Ollama rejects it', async () => {
    const bodies: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)))
      return bodies.length === 1
        ? new Response(JSON.stringify({ error: '"phi3" does not support thinking' }), { status: 400 })
        : new Response(ndjson, { status: 200 })
    }))
    expect(await completeOllamaBrowser(cfg({ model: 'phi3' }), messages)).toBe('Hi')
    expect(bodies).toHaveLength(2)
    expect(bodies[0].think).toBe(false)
    expect(bodies[1]).not.toHaveProperty('think')
  })

  it('does not retry for an unrelated error', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: 'model not found' }), { status: 400 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(streamOllamaBrowser(cfg({}), messages)).rejects.toThrow(/model not found/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('server path', () => {
  const SSE = 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n'
  function mock(statuses: number[], message = 'unknown field reasoning_effort') {
    const calls: Record<string, unknown>[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      calls.push(JSON.parse(String(init.body)))
      const status = statuses[Math.min(calls.length - 1, statuses.length - 1)]
      return status === 200 ? new Response(SSE, { status: 200 }) : new Response(JSON.stringify({ error: { message } }), { status })
    }))
    return calls
  }

  it('Ollama: switches reasoning off', async () => {
    const calls = mock([200])
    expect(await complete(cfg({}), messages)).toBe('ok')
    expect(calls[0].reasoning_effort).toBe('none')
  })
  it('Ollama: asks again without it when rejected', async () => {
    const calls = mock([400, 200])
    expect(await complete(cfg({}), messages)).toBe('ok')
    expect(calls).toHaveLength(2)
    expect(calls[1]).not.toHaveProperty('reasoning_effort')
  })
  it('Ollama: an unrelated 400 is still an error, not a retry', async () => {
    const calls = mock([400], 'model not found')
    await expect(complete(cfg({}), messages)).rejects.toThrow()
    expect(calls).toHaveLength(1)
  })
  it('OpenAI and Groq are not sent the setting', async () => {
    const calls = mock([200])
    await complete(cfg({ provider: 'openai', apiKey: 'k', model: 'gpt-4o-mini', baseUrl: undefined }), messages)
    await complete(cfg({ provider: 'groq', apiKey: 'k', model: 'llama-3.1-8b-instant', baseUrl: undefined }), messages)
    expect(calls[0]).not.toHaveProperty('reasoning_effort')
    expect(calls[1]).not.toHaveProperty('reasoning_effort')
  })
})
