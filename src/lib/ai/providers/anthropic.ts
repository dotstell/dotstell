import { AIConfig, AIMessage } from '../types'
import { providerError, extractMessage } from '../error'

/**
 * Stream a chat response from the Anthropic Messages API.
 * Key differences from the OpenAI format:
 * - System message is a top-level field, not an element of the messages array
 * - `max_tokens` is required
 * - Streaming SSE uses `content_block_delta` events (not `choices[0].delta.content`)
 */
export async function anthropicStream(
  config: AIConfig,
  messages: AIMessage[],
): Promise<ReadableStream<Uint8Array>> {
  // Anthropic separates system prompt from the messages array
  const systemMsg = messages.find(m => m.role === 'system')?.content ?? ''
  const chatMsgs  = messages.filter(m => m.role !== 'system').map(m => ({
    role:    m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         config.apiKey ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      config.model,
      system:     systemMsg || undefined,
      messages:   chatMsgs,
      max_tokens: 4096,
      stream:     true,
    }),
  })

  if (!res.ok) {
    const raw = await res.text().catch(() => res.statusText)
    throw providerError('Anthropic', res.status, extractMessage(raw))
  }

  return transformAnthropicStream(res.body!)
}

/** Placeholder that throws — Anthropic has no embedding API; callers must configure a separate provider. */
export function anthropicEmbed(): never {
  throw new Error('Anthropic does not provide an embedding API. Configure a separate embedding provider (Ollama or OpenAI) in AI settings.')
}

// ── SSE parser ────────────────────────────────────────────────────────────────
// Anthropic streams `content_block_delta` events with `delta.text` payloads.
function transformAnthropicStream(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
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
            if (parsed.type === 'content_block_delta') {
              const delta = parsed.delta?.text ?? ''
              if (delta) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta, done: false })}\n\n`))
            } else if (parsed.type === 'message_stop') {
              controller.enqueue(encoder.encode('data: {"delta":"","done":true}\n\n'))
              controller.close()
              return
            }
          } catch { /* malformed chunk — skip */ }
        }
      }
    },
    cancel() { reader.cancel() },
  })
}
