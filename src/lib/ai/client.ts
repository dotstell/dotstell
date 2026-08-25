import { AIConfig, AIMessage, EmbeddingResult } from './types'
import { openaiStream, openaiEmbed, groqStream } from './providers/openai'
import { anthropicStream }                        from './providers/anthropic'
import { geminiStream, geminiEmbed }             from './providers/gemini'
import { ollamaStream, ollamaEmbed }             from './providers/ollama'

/**
 * Stream a chat response from the configured provider.
 * Returns a ReadableStream of normalised SSE chunks:
 *   `data: {"delta":"text","done":false}`  …  `data: {"delta":"","done":true}`
 */
export async function streamChat(
  config: AIConfig,
  messages: AIMessage[],
): Promise<ReadableStream<Uint8Array>> {
  switch (config.provider) {
    case 'ollama':    return ollamaStream(config, messages)
    case 'openai':    return openaiStream(config, messages)
    case 'anthropic': return anthropicStream(config, messages)
    case 'gemini':    return geminiStream(config, messages)
    case 'groq':      return groqStream(config, messages)
    default:          throw new Error(`Unknown provider: ${(config as AIConfig).provider}`)
  }
}

/** Generate an embedding vector for `text` using the configured embedding provider. */
export async function embed(config: AIConfig, text: string): Promise<EmbeddingResult> {
  let embedding: number[]
  switch (config.embeddingProvider) {
    case 'ollama': embedding = await ollamaEmbed(config, text); break
    case 'openai': embedding = await openaiEmbed(config, text); break
    case 'gemini': embedding = await geminiEmbed(config, text); break
    default:       throw new Error(`Unknown embedding provider: ${config.embeddingProvider}`)
  }
  if (!embedding || embedding.length === 0) throw new Error('Empty embedding returned')
  return { embedding, model: config.embeddingModel }
}

/**
 * Collect a full streamed response into a single string.
 * Use for short non-UI tasks (summarise, title generation, auto-tag).
 */
export async function complete(config: AIConfig, messages: AIMessage[]): Promise<string> {
  const stream   = await streamChat(config, messages)
  const reader   = stream.getReader()
  const decoder  = new TextDecoder()
  let   result   = ''
  let   finished = false
  while (!finished) {
    const { done, value } = await reader.read()
    if (done) break
    for (const line of decoder.decode(value).split('\n')) {
      if (!line.startsWith('data: ')) continue
      try {
        const chunk = JSON.parse(line.slice(6))
        if (chunk.delta)  result += chunk.delta
        if (chunk.done) { finished = true; break }
      } catch { /* skip malformed */ }
    }
  }
  return result.trim()
}

/** Validate an AIConfig before making requests. Returns an error string, or null if valid. */
export function validateConfig(config: Partial<AIConfig> | null): string | null {
  if (!config?.provider) return 'No AI provider configured'
  if (config.provider !== 'ollama' && !config.apiKey) return `API key required for ${config.provider}`
  if (!config.model)   return 'No model selected'
  return null
}

/**
 * Server-side config validation — extends validateConfig with a check that blocks
 * Ollama localhost requests from hosted API routes (Vercel can't reach the user's machine).
 */
export function validateServerConfig(config: Partial<AIConfig> | null): string | null {
  const base = validateConfig(config)
  if (base) return base
  if (config?.provider === 'ollama') {
    const url = config.baseUrl ?? 'http://localhost:11434'
    if (/localhost|127\.0\.0\.1|::1/.test(url)) {
      return 'Ollama (localhost) is only available from the desktop app. Switch to OpenAI, Gemini or Groq to use AI in the browser.'
    }
  }
  return null
}
