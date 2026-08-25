'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  AIConfig, AIProvider, EmbeddingProvider,
  DEFAULT_CHAT_MODELS, DEFAULT_EMBEDDING_MODELS,
  DEFAULT_AI_CONFIG, PROVIDERS_WITHOUT_EMBEDDINGS,
} from '@/lib/ai/types'
import { validateConfig } from '@/lib/ai/client'

const STORAGE_KEY = 'dotstell-ai-config'

/**
 * Read and persist AI provider configuration from/to localStorage.
 * API keys never leave the browser except as request bodies to Next.js API routes
 * (TLS-encrypted, never logged or stored server-side).
 * Returns `loaded: false` on first render (before localStorage is read); consumers
 * should defer rendering provider-specific UI until `loaded` is true.
 */
export function useAISettings() {
  const [config, setConfigState] = useState<AIConfig>(DEFAULT_AI_CONFIG)
  const [loaded, setLoaded]      = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setConfigState({ ...DEFAULT_AI_CONFIG, ...JSON.parse(raw) })
    } catch { /* use default */ }
    setLoaded(true)
  }, [])

  const saveConfig = useCallback((next: AIConfig) => {
    setConfigState(next)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
  }, [])

  const updateProvider = useCallback((provider: AIProvider) => {
    setConfigState(prev => {
      // When switching providers, auto-fill the default model for that provider.
      // If the new provider has no embedding API (Anthropic, Groq), keep the existing
      // embedding config or fall back to Ollama.
      const needsEmbedFallback = PROVIDERS_WITHOUT_EMBEDDINGS.includes(provider)
      const next: AIConfig = {
        ...prev,
        provider,
        model:             DEFAULT_CHAT_MODELS[provider],
        embeddingProvider: needsEmbedFallback ? (prev.embeddingProvider === 'ollama' || prev.embeddingProvider === 'openai' || prev.embeddingProvider === 'gemini' ? prev.embeddingProvider : 'ollama') : provider as EmbeddingProvider,
        embeddingModel:    needsEmbedFallback ? prev.embeddingModel : DEFAULT_EMBEDDING_MODELS[provider as EmbeddingProvider] ?? prev.embeddingModel,
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  const isConfigured = loaded && validateConfig(config) === null
  const configError  = loaded ? validateConfig(config) : null

  return { config, saveConfig, updateProvider, isConfigured, configError, loaded }
}
