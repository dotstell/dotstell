// Ollama — exposes an OpenAI-compatible API at a local base URL.
// Re-uses the openai provider with the local endpoint so there's no duplication.
import { AIConfig, AIMessage } from '../types'
import { openaiStream } from './openai'

export async function ollamaStream(
  config: AIConfig,
  messages: AIMessage[],
): Promise<ReadableStream<Uint8Array>> {
  // Strip any trailing /v1 or / from the stored base URL, then always append /v1.
  // This normalises both http://localhost:11434 and http://localhost:11434/v1
  // to the same resolved endpoint (http://localhost:11434/v1/chat/completions).
  const base = (config.baseUrl || 'http://localhost:11434')
    .replace(/\/v1\/?$/, '')
    .replace(/\/$/, '')
  return openaiStream(
    { ...config, baseUrl: `${base}/v1`, apiKey: config.apiKey || 'ollama' },
    messages,
  )
}

// Ollama embedding — uses the /api/embeddings endpoint (not OpenAI-compatible)
export async function ollamaEmbed(config: AIConfig, text: string): Promise<number[]> {
  const base = (config.embeddingBaseUrl || config.baseUrl || 'http://localhost:11434')
    .replace(/\/v1\/?$/, '').replace(/\/$/, '')
  const res  = await fetch(`${base}/api/embeddings`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ model: config.embeddingModel, prompt: text }),
  })
  if (!res.ok) throw new Error(`Ollama embed error ${res.status}`)
  const data = await res.json()
  return data.embedding as number[]
}
