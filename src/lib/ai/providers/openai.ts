import { AIConfig, AIMessage } from '../types'
import { providerError, extractMessage } from '../error'

const ALLOWED_BASE_URL_HOSTS = [
  'openai.com', 'groq.com', 'anthropic.com', 'openrouter.ai',
  'mistral.ai', 'together.xyz', 'api.together.xyz',
  'localhost', '127.0.0.1', '::1',
]

/** Guard against SSRF: reject baseUrls whose hostname is not in the known-provider allowlist. */
function sanitizeBaseUrl(url: string): void {
  let hostname: string
  try { hostname = new URL(url).hostname } catch { throw new Error('Invalid baseUrl') }
  const allowed = ALLOWED_BASE_URL_HOSTS.some(h => hostname === h || hostname.endsWith(`.${h}`))
  if (!allowed) throw new Error('Unsupported baseUrl host')
}

/**
 * Stream a chat completion from the OpenAI API (or any OpenAI-compatible endpoint).
 * Used directly for OpenAI, and as the delegate for Ollama and Groq which share the same wire format.
 * `config.baseUrl` overrides the default endpoint — used by Ollama and Groq.
 */
export async function openaiStream(
  config: AIConfig,
  messages: AIMessage[],
): Promise<ReadableStream<Uint8Array>> {
  const baseUrl = config.baseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1'
  // Validate the baseUrl hostname when a custom one is provided (skip Ollama — it uses assertLocalhost)
  if (config.baseUrl && config.provider !== 'ollama') sanitizeBaseUrl(baseUrl)
  const url = `${baseUrl}/chat/completions`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey ?? ''}`,
    },
    body:   JSON.stringify({ model: config.model, messages, stream: true }),
    signal: AbortSignal.timeout(30_000),
  })

  if (!res.ok) {
    const raw   = await res.text().catch(() => res.statusText)
    const label = config.provider === 'ollama' ? 'Ollama'
                : config.provider === 'groq'   ? 'Groq'
                : 'OpenAI'
    throw providerError(label, res.status, extractMessage(raw))
  }

  if (!res.body) throw new Error('OpenAI: empty response body')
  return transformOpenAIStream(res.body)
}

/** Stream from Groq — identical to OpenAI wire format, different base URL. */
export async function groqStream(
  config: AIConfig,
  messages: AIMessage[],
): Promise<ReadableStream<Uint8Array>> {
  return openaiStream(
    { ...config, baseUrl: 'https://api.groq.com/openai/v1' },
    messages,
  )
}

/**
 * Generate an embedding vector using the OpenAI Embeddings API.
 * Requests 768 dimensions via the `dimensions` param (supported by text-embedding-3-* models)
 * to match the pgvector column size used in the database.
 */
export async function openaiEmbed(config: AIConfig, text: string): Promise<number[]> {
  const baseUrl = config.embeddingBaseUrl?.replace(/\/$/, '') || 'https://api.openai.com/v1'
  // Validate the embeddingBaseUrl hostname when a custom one is provided (skip Ollama — it uses assertLocalhost)
  if (config.embeddingBaseUrl && config.embeddingProvider !== 'ollama') sanitizeBaseUrl(baseUrl)
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
  if (!res.ok) {
    const raw   = await res.text().catch(() => res.statusText)
    const label = config.embeddingProvider === 'ollama' ? 'Ollama' : 'OpenAI'
    throw providerError(label, res.status, extractMessage(raw))
  }
  const data = await res.json()
  const embedding = data?.data?.[0]?.embedding
  if (!Array.isArray(embedding) || embedding.length === 0) throw new Error('OpenAI embed: empty or missing embedding in response')
  // ada-002 ignores the `dimensions` param and always returns 1536-dim vectors, which
  // mismatches the pgvector(768) column — surface a clear error instead of a silent DB failure.
  if (embedding.length !== 768) {
    throw new Error(
      `OpenAI model '${config.embeddingModel}' returned ${embedding.length} dimensions but the database expects 768. ` +
      `Use 'text-embedding-3-small' or 'text-embedding-3-large' (both support 768-dim output).`
    )
  }
  return embedding as number[]
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
