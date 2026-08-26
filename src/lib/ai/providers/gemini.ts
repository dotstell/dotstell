import { AIConfig, AIMessage } from '../types'
import { providerError, extractMessage } from '../error'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

/**
 * Stream a chat response from the Google Gemini API.
 * Uses the Generative Language REST API (not OpenAI-compatible):
 * - Endpoint: POST /v1beta/models/{model}:streamGenerateContent?alt=sse
 * - System prompt is a separate `systemInstruction` field
 * - Role name for assistant turns is `'model'`, not `'assistant'`
 */
export async function geminiStream(
  config: AIConfig,
  messages: AIMessage[],
): Promise<ReadableStream<Uint8Array>> {
  // Gemini separates system instruction from the conversation
  const systemMsg = messages.find(m => m.role === 'system')?.content ?? ''
  const chatMsgs  = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      // Gemini uses 'model' instead of 'assistant'
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const body: Record<string, unknown> = { contents: chatMsgs }
  if (systemMsg) body.systemInstruction = { parts: [{ text: systemMsg }] }

  const url = `${GEMINI_BASE}/models/${config.model}:streamGenerateContent?alt=sse&key=${config.apiKey ?? ''}`

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    const raw = await res.text().catch(() => res.statusText)
    throw providerError('Gemini', res.status, extractMessage(raw))
  }

  return transformGeminiStream(res.body!)
}

/**
 * Generate an embedding vector using the Gemini Embedding API.
 * Requests 768 dimensions via `outputDimensionality` to match the pgvector column size.
 */
export async function geminiEmbed(config: AIConfig, text: string): Promise<number[]> {
  // text-embedding-004 is available on v1 (stable), not v1beta
  const embedBase = 'https://generativelanguage.googleapis.com/v1'
  const url = `${embedBase}/models/${config.embeddingModel}:embedContent?key=${config.embeddingApiKey ?? config.apiKey ?? ''}`

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      model:   `models/${config.embeddingModel}`,
      content: { parts: [{ text }] },
      // Request 768-dim output for compatibility with the pgvector column
      outputDimensionality: 768,
    }),
  })
  if (!res.ok) {
    const raw = await res.text().catch(() => res.statusText)
    throw providerError('Gemini', res.status, extractMessage(raw))
  }
  const data   = await res.json()
  const values = data?.embedding?.values
  if (!Array.isArray(values) || values.length === 0) throw new Error('Gemini embed: empty or missing embedding in response')
  return values as number[]
}

// ── SSE parser ────────────────────────────────────────────────────────────────
// Gemini SSE emits JSON objects with `candidates[0].content.parts[0].text`.
function transformGeminiStream(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
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
          try {
            const parsed = JSON.parse(trimmed.slice(6))
            const delta  = parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
            if (delta) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta, done: false })}\n\n`))
          } catch { /* malformed chunk — skip */ }
        }
      }
    },
    cancel() { reader.cancel() },
  })
}
