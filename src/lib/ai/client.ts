// ── AI Client — routes requests to the configured provider ───────────────────
// This is the single entry point for all AI operations. Callers never import
// provider-specific modules directly.
import { AIConfig, AIMessage, EmbeddingResult } from './types'
import { openaiStream, openaiEmbed, groqStream } from './providers/openai'
import { anthropicStream, anthropicEmbed }       from './providers/anthropic'
import { geminiStream, geminiEmbed }             from './providers/gemini'
import { ollamaStream, ollamaEmbed }             from './providers/ollama'

// Returns a streaming ReadableStream that emits normalised SSE chunks:
//   data: {"delta":"text","done":false}\n\n
//   data: {"delta":"","done":true}\n\n
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

// Returns an embedding vector for the given text using the configured embedding provider.
export async function embed(config: AIConfig, text: string): Promise<EmbeddingResult> {
  let embedding: number[]
  switch (config.embeddingProvider) {
    case 'ollama': embedding = await ollamaEmbed(config, text); break
    case 'openai': embedding = await openaiEmbed(config, text); break
    case 'gemini': embedding = await geminiEmbed(config, text); break
    default:       throw new Error(`Unknown embedding provider: ${config.embeddingProvider}`)
  }
  // Anthropic and Groq have no embedding API — anthropicEmbed() always throws,
  // so this path only triggers if the caller set an invalid embeddingProvider.
  if (!embedding || embedding.length === 0) throw new Error('Empty embedding returned')
  return { embedding, model: config.embeddingModel }
}

// Non-streaming convenience: collect the full streamed response into a string.
// Use for short tasks (summarize, title generation, auto-tag) where streaming
// isn't needed in the UI.
export async function complete(config: AIConfig, messages: AIMessage[]): Promise<string> {
  const stream  = await streamChat(config, messages)
  const reader  = stream.getReader()
  const decoder = new TextDecoder()
  let   result  = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ')) continue
      try {
        const chunk = JSON.parse(line.slice(6))
        if (chunk.delta) result += chunk.delta
        if (chunk.done)  break
      } catch { /* skip malformed */ }
    }
  }
  return result.trim()
}

// Validate config before making any requests — returns an error string or null.
export function validateConfig(config: Partial<AIConfig> | null): string | null {
  if (!config?.provider) return 'No AI provider configured'
  if (config.provider !== 'ollama' && !config.apiKey) return `API key required for ${config.provider}`
  if (!config.model)   return 'No model selected'
  return null
}
