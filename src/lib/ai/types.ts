// ── AI provider types ────────────────────────────────────────────────────────
// All AI features route through a single AIConfig. The config is stored in
// localStorage (never persisted server-side) and sent with every API request.

export type AIProvider = 'ollama' | 'openai' | 'anthropic' | 'gemini' | 'groq'

// Embedding is a separate concern — Anthropic and Groq have no embedding API,
// so users must configure a fallback embedding provider independently.
export type EmbeddingProvider = 'ollama' | 'openai' | 'gemini'

export interface AIConfig {
  provider:          AIProvider
  apiKey?:           string   // not required for Ollama (local)
  baseUrl?:          string   // Ollama default: http://localhost:11434
  model:             string
  embeddingProvider: EmbeddingProvider
  embeddingModel:    string
  embeddingApiKey?:  string   // only needed when embeddingProvider ≠ chat provider
  embeddingBaseUrl?: string   // Ollama embedding endpoint if different
}

export interface AIMessage {
  role:    'system' | 'user' | 'assistant'
  content: string
}

// Normalised SSE chunk emitted by all /api/ai/* streaming routes
export interface AIStreamChunk {
  delta: string
  done:  boolean
  error?: string
}

export interface EmbeddingResult {
  embedding: number[]
  model:     string
}

// ── Default models per provider ──────────────────────────────────────────────
export const DEFAULT_CHAT_MODELS: Record<AIProvider, string> = {
  ollama:    'llama3.2',
  openai:    'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5-20251001',
  gemini:    'gemini-1.5-flash',
  groq:      'llama-3.1-8b-instant',
}

export const DEFAULT_EMBEDDING_MODELS: Record<EmbeddingProvider, string> = {
  ollama: 'nomic-embed-text',
  openai: 'text-embedding-3-small',
  gemini: 'text-embedding-004',
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

// Groq and Anthropic have no embedding API — users must pick a separate provider
export const PROVIDERS_WITHOUT_EMBEDDINGS: AIProvider[] = ['anthropic', 'groq']

// Default config used when nothing is configured yet
export const DEFAULT_AI_CONFIG: AIConfig = {
  provider:          'ollama',
  baseUrl:           'http://localhost:11434',
  model:             DEFAULT_CHAT_MODELS.ollama,
  embeddingProvider: 'ollama',
  embeddingModel:    DEFAULT_EMBEDDING_MODELS.ollama,
  embeddingBaseUrl:  'http://localhost:11434',
}

// ── Assist operation types ────────────────────────────────────────────────────
export type AssistOperation =
  | 'rewrite'    // rephrase for clarity
  | 'expand'     // add more detail
  | 'shorten'    // make more concise
  | 'fix'        // fix grammar and spelling
  | 'outline'    // turn prose into a structured outline
  | 'checklist'  // extract action items as a checklist
  | 'explain'    // explain with context from knowledge base

export const ASSIST_LABELS: Record<AssistOperation, string> = {
  rewrite:   'Rewrite',
  expand:    'Expand',
  shorten:   'Shorten',
  fix:       'Fix grammar',
  outline:   'Make outline',
  checklist: 'Extract tasks',
  explain:   'Explain',
}
