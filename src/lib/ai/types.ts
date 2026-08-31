export type AIProvider = 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'groq'

/** Anthropic and Groq have no embedding API — users configure a separate embedding provider. */
export type EmbeddingProvider = 'ollama' | 'openai' | 'gemini'

/** Single config object for all AI operations. Stored in localStorage; sent per-request, never persisted server-side. */
export interface AIConfig {
  provider:          AIProvider
  apiKey?:           string   // not required for Ollama (local)
  baseUrl?:          string   // Ollama default: http://localhost:11434
  model:             string
  embeddingProvider: EmbeddingProvider
  embeddingModel:    string
  embeddingApiKey?:  string   // only needed when embeddingProvider ≠ chat provider
  embeddingBaseUrl?: string   // Ollama embedding endpoint if different from baseUrl
}

export interface AIMessage {
  role:    'system' | 'user' | 'assistant'
  content: string
}

/** Normalised SSE chunk emitted by all /api/ai/* streaming routes. */
export interface AIStreamChunk {
  delta:  string
  done:   boolean
  error?: string
}

export interface EmbeddingResult {
  embedding: number[]
  model:     string
}

export const DEFAULT_CHAT_MODELS: Record<AIProvider, string> = {
  ollama:    'llama3.2',
  openai:    'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5-20251001',
  gemini:    'gemini-3.6-flash',
  groq:      'llama-3.1-8b-instant',
}

export const DEFAULT_EMBEDDING_MODELS: Record<EmbeddingProvider, string> = {
  ollama: 'nomic-embed-text',
  openai: 'text-embedding-3-small',
  gemini: 'gemini-embedding-001',
}

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  ollama:    'Ollama (Local)',
  openai:    'OpenAI',
  anthropic: 'Anthropic',
  gemini:    'Google Gemini',
  groq:      'Groq',
}

export const EMBEDDING_PROVIDER_LABELS: Record<EmbeddingProvider, string> = {
  ollama: 'Ollama (Local)',
  openai: 'OpenAI',
  gemini: 'Google Gemini',
}

/** Providers that have no embedding API — users must pick a separate embedding provider. */
export const PROVIDERS_WITHOUT_EMBEDDINGS: AIProvider[] = ['anthropic', 'groq']

export const DEFAULT_AI_CONFIG: AIConfig = {
  provider:          'ollama',
  baseUrl:           'http://localhost:11434',
  model:             DEFAULT_CHAT_MODELS.ollama,
  embeddingProvider: 'ollama',
  embeddingModel:    DEFAULT_EMBEDDING_MODELS.ollama,
  embeddingBaseUrl:  'http://localhost:11434',
}

export type AssistOperation =
  | 'rewrite'
  | 'expand'
  | 'shorten'
  | 'fix'
  | 'outline'
  | 'checklist'
  | 'explain'
  | 'continue'

export const ASSIST_LABELS: Record<AssistOperation, string> = {
  rewrite:   'Rewrite',
  expand:    'Expand',
  shorten:   'Shorten',
  fix:       'Fix grammar',
  outline:   'Make outline',
  checklist: 'Extract tasks',
  explain:   'Explain',
  continue:  'Continue writing',
}
