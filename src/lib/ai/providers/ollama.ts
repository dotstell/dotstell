import { AIConfig, AIMessage } from '../types'
import { openaiStream } from './openai'
import { providerError, extractMessage } from '../error'

function assertLocalhost(rawUrl: string) {
  let hostname: string
  try { hostname = new URL(rawUrl).hostname }
  catch { throw new Error('Ollama base URL is not a valid URL') }
  // Prevent SSRF — Ollama is always local; reject any non-localhost target
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    throw new Error('Ollama base URL must point to localhost')
  }
}

/**
 * Stream a chat response from a local Ollama instance.
 * Ollama exposes an OpenAI-compatible API, so this delegates to `openaiStream`
 * after normalising the base URL to always include `/v1`.
 */
export async function ollamaStream(
  config: AIConfig,
  messages: AIMessage[],
): Promise<ReadableStream<Uint8Array>> {
  const rawBase = config.baseUrl || 'http://localhost:11434'
  assertLocalhost(rawBase)
  // Strip any trailing /v1 then re-append — normalises both
  // "http://localhost:11434" and "http://localhost:11434/v1" inputs
  const base = rawBase.replace(/\/v1\/?$/, '').replace(/\/$/, '')
  return openaiStream(
    { ...config, baseUrl: `${base}/v1`, apiKey: config.apiKey || 'ollama' },
    messages,
  )
}

/**
 * Generate an embedding vector using Ollama's native `/api/embeddings` endpoint.
 * Note: this is NOT the OpenAI-compatible endpoint — Ollama uses a different path and schema.
 */
export async function ollamaEmbed(config: AIConfig, text: string): Promise<number[]> {
  const rawBase = config.embeddingBaseUrl || config.baseUrl || 'http://localhost:11434'
  assertLocalhost(rawBase)
  const base = rawBase.replace(/\/v1\/?$/, '').replace(/\/$/, '')
  const res  = await fetch(`${base}/api/embeddings`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ model: config.embeddingModel, prompt: text }),
  })
  if (!res.ok) {
    const raw = await res.text().catch(() => res.statusText)
    throw providerError('Ollama', res.status, extractMessage(raw))
  }
  const data      = await res.json()
  const embedding = data.embedding
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error(`Ollama: model '${config.embeddingModel}' returned no embedding — is it an embedding model? Try: ollama pull nomic-embed-text`)
  }
  return embedding as number[]
}
