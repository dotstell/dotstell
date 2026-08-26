'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  AIConfig, AIProvider, EmbeddingProvider,
  DEFAULT_CHAT_MODELS, DEFAULT_EMBEDDING_MODELS,
  DEFAULT_AI_CONFIG, PROVIDERS_WITHOUT_EMBEDDINGS,
} from '@/lib/ai/types'
import { validateConfig } from '@/lib/ai/client'

const STORAGE_KEY         = 'dotstell-ai-config'
const CONFIG_UPDATED_EVENT = 'dotstell:ai-config-updated'

function readFromStorage(): { config: AIConfig; hasStored: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { config: { ...DEFAULT_AI_CONFIG, ...JSON.parse(raw) }, hasStored: true }
  } catch { /* use default */ }
  return { config: DEFAULT_AI_CONFIG, hasStored: false }
}

/**
 * Read and persist AI provider configuration from/to localStorage.
 * API keys never leave the browser except as request bodies to Next.js API routes
 * (TLS-encrypted, never logged or stored server-side).
 *
 * `loaded` is false on the first render (before localStorage is read); consumers
 * should defer rendering provider-specific UI until `loaded` is true.
 *
 * `isConfigured` requires the user to have explicitly saved a config — the default
 * Ollama/llama3.2 config intentionally does NOT count as configured so that
 * first-time users don't see AI features attempting requests before any setup.
 *
 * `saveConfig` dispatches a custom DOM event so that every other useAISettings
 * instance on the same page (e.g., note page while modal is open) re-syncs
 * immediately without requiring a navigation or page reload.
 */
export function useAISettings() {
  const [config,         setConfigState]     = useState<AIConfig>(DEFAULT_AI_CONFIG)
  const [loaded,         setLoaded]          = useState(false)
  const [hasStoredConfig, setHasStoredConfig] = useState(false)

  const syncFromStorage = useCallback(() => {
    const { config: stored, hasStored } = readFromStorage()
    setConfigState(stored)
    setHasStoredConfig(hasStored)
    setLoaded(true)
  }, [])

  useEffect(() => {
    syncFromStorage()
    window.addEventListener(CONFIG_UPDATED_EVENT, syncFromStorage)
    return () => window.removeEventListener(CONFIG_UPDATED_EVENT, syncFromStorage)
  }, [syncFromStorage])

  const saveConfig = useCallback((next: AIConfig) => {
    setConfigState(next)
    setHasStoredConfig(true)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      // Notify all other useAISettings instances on this page (e.g. note page
      // stays mounted while the modal is open — it won't re-read otherwise)
      window.dispatchEvent(new CustomEvent(CONFIG_UPDATED_EVENT))
    } catch {}
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
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        window.dispatchEvent(new CustomEvent(CONFIG_UPDATED_EVENT))
      } catch {}
      return next
    })
    setHasStoredConfig(true)
  }, [])

  // isConfigured requires: settings loaded + user has explicitly saved a config + config passes validation
  const isConfigured = loaded && hasStoredConfig && validateConfig(config) === null
  const configError  = loaded ? validateConfig(config) : null

  return { config, saveConfig, updateProvider, isConfigured, configError, loaded }
}
