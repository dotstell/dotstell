// OpenAI-compatible streaming chat — also used for Groq (same API format)
import { AIConfig, AIMessage } from '../types'

export async function openaiStream(
  config: AIConfig,
  messages: AIMessage[],
): Promise<ReadableStream<Uint8Array>> {
  const baseUrl = config.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1'
  const url = `${baseUrl}/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey ?? ''}`,
    },
    body: JSON.stringify({ model: config.model, messages, stream: true }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`OpenAI error ${res.status}: ${err}`)
  }

  // Transform OpenAI SSE → normalised `delta` chunks
  return transformOpenAIStream(res.body!)
}

// Groq uses the OpenAI-compatible endpoint at a different base URL
export async function groqStream(
  config: AIConfig,
  messages: AIMessage[],
): Promise<ReadableStream<Uint8Array>> {
  return openaiStream(
    { ...config, baseUrl: 'https://api.groq.com/openai/v1' },
    messages,
  )
}

// OpenAI embeddings — supports `dimensions` param (text-embedding-3-* models)
export async function openaiEmbed(config: AIConfig, text: string): Promise<number[]> {
  const baseUrl = config.embeddingBaseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1'
  const res = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.embeddingApiKey ?? config.apiKey ?? ''}`,
    },
    body: JSON.stringify({
      model:      config.embeddingModel,
      input:      text,
      dimensions: 768, // request 768-dim output (text-embedding-3-* supports this natively)
    }),
  })
  if (!res.ok) throw new Error(`OpenAI embed error ${res.status}`)
  const data = await res.json()
  return data.data[0].embedding as number[]
}

// ── SSE parser ───────────────────────────────────────────────────────────────
// Reads OpenAI's `data: {...}` SSE format and re-emits normalised delta chunks.
function transformOpenAIStream(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader  = source.getReader()
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let   buffer  = ''

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          controller.enqueue(encoder.encode('data: {"delta":"","done":true}\n\n'))
          controller.close()
          return
        }
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const payload = trimmed.slice(6)
          if (payload === '[DONE]') continue
          try {
            const parsed = JSON.parse(payload)
            const delta  = parsed.choices?.[0]?.delta?.content ?? ''
            if (delta) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta, done: false })}\n\n`))
          } catch { /* malformed chunk — skip */ }
        }
      }
    },
    cancel() { reader.cancel() },
  })
}
