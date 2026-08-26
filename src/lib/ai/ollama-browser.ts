'use client'

import { AIConfig, AIMessage } from './types'

const DEFAULT_BASE_URL = 'http://127.0.0.1:11434'

// On Windows, browsers resolve `localhost` as ::1 (IPv6) but Ollama only listens
// on 127.0.0.1 (IPv4), causing silent fetch failures. Normalise before every call.
function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/^(https?:\/\/)localhost(:\d+)?/, (_, proto, port) => `${proto}127.0.0.1${port ?? ''}`)
}

// Probe reachability using no-cors mode (bypasses CORS headers, returns opaque response).
// If Ollama is running but CORS is blocked, this still resolves.
// If Ollama is not running (connection refused), this rejects.
async function checkConnectivity(baseUrl: string): Promise<boolean> {
  try {
    await fetch(`${baseUrl}/api/tags`, { mode: 'no-cors' })
    return true
  } catch {
    return false
  }
}

/**
 * Fetch available Ollama models directly from the browser.
 * Throws a descriptive error distinguishing "not running" from "CORS blocked".
 */
export async function fetchOllamaModelsBrowser(
  baseUrl = DEFAULT_BASE_URL,
): Promise<Array<{ name: string; capabilities: string[] }>> {
  baseUrl = normalizeBaseUrl(baseUrl)
  let res: Response
  try {
    res = await fetch(`${baseUrl}/api/tags`)
  } catch {
    // TypeError from fetch can be connection refused OR CORS block — probe to tell them apart
    const reachable = await checkConnectivity(baseUrl)
    if (reachable) {
      throw new Error(
        `CORS not configured — Ollama is running but needs browser access enabled. ` +
        `Set OLLAMA_ORIGINS=* and restart Ollama.|||` +
        `https://github.com/ollama/ollama/blob/main/docs/faq.md#how-do-i-configure-ollama-server|||` +
        `Ollama CORS setup guide ↗`,
      )
    }
    throw new Error(`Cannot reach Ollama at ${baseUrl} — is it running?`)
  }
  if (!res.ok) throw new Error(`Ollama returned ${res.status}`)
  const data = await res.json()
  return (data.models ?? []).map((m: { name: string }) => ({
    name: m.name,
    capabilities: ['completion'],
  }))
}

/**
 * Stream an Ollama chat response directly from the browser.
 * Returns a ReadableStream emitting normalised SSE lines:
 *   `data: {"delta":"text","done":false}`  …  `data: {"delta":"","done":true}`
 */
export async function streamOllamaBrowser(
  config: AIConfig,
  messages: AIMessage[],
): Promise<ReadableStream<Uint8Array>> {
  const baseUrl = normalizeBaseUrl(config.baseUrl ?? DEFAULT_BASE_URL)
  let res: Response
  try {
    res = await fetch(`${baseUrl}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        model:    config.model,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        stream:   true,
      }),
    })
  } catch {
    const reachable = await checkConnectivity(baseUrl)
    if (reachable) {
      throw new Error(
        `Ollama is running but CORS is not configured for browser access. ` +
        `Set OLLAMA_ORIGINS=* and restart Ollama, then try again.`,
      )
    }
    throw new Error(`Cannot reach Ollama at ${baseUrl} — is it running?`)
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error ?? `Ollama error ${res.status}`)
  }
  if (!res.body) throw new Error('No response body from Ollama')

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()

  // Transform Ollama NDJSON stream → normalised SSE format
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc  = new TextEncoder()
      const emit = (obj: object) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`))
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          for (const line of decoder.decode(value, { stream: true }).split('\n').filter(Boolean)) {
            try {
              const chunk = JSON.parse(line)
              if (chunk.message?.content) emit({ delta: chunk.message.content, done: false })
              if (chunk.done) emit({ delta: '', done: true })
            } catch { /* skip malformed line */ }
          }
        }
      } catch (err) {
        emit({ error: err instanceof Error ? err.message : 'Stream error' })
      } finally {
        controller.close()
      }
    },
  })
}

/** Collect a full Ollama streaming response into a single string. */
export async function completeOllamaBrowser(
  config: AIConfig,
  messages: AIMessage[],
): Promise<string> {
  const readable = await streamOllamaBrowser(config, messages)
  const reader   = readable.getReader()
  const decoder  = new TextDecoder()
  let   result   = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    for (const line of decoder.decode(value).split('\n')) {
      if (!line.startsWith('data: ')) continue
      try {
        const chunk = JSON.parse(line.slice(6))
        if (chunk.error) throw new Error(chunk.error)
        if (chunk.delta) result += chunk.delta
        if (chunk.done)  return result.trim()
      } catch (e) {
        if (e instanceof Error && !e.message.includes('JSON')) throw e
      }
    }
  }
  return result.trim()
}
