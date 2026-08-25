// Google Gemini — uses the Generative Language REST API (not OpenAI-compatible)
// Chat: POST /v1beta/models/{model}:streamGenerateContent
// Embed: POST /v1beta/models/{model}:embedContent
import { AIConfig, AIMessage } from '../types'

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'

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
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }

  return transformGeminiStream(res.body!)
}

export async function geminiEmbed(config: AIConfig, text: string): Promise<number[]> {
  const url = `${GEMINI_BASE}/models/${config.embeddingModel}:embedContent?key=${config.embeddingApiKey ?? config.apiKey ?? ''}`

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
  if (!res.ok) throw new Error(`Gemini embed error ${res.status}`)
  const data = await res.json()
  return data.embedding.values as number[]
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
