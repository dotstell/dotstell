'use client'
import { AIConfig } from '@/lib/ai/types'

const STORAGE_KEY = 'dotstell-ai-config'

/**
 * Fire-and-forget embedding after a save. Runs only for cloud providers —
 * Ollama needs browser-local Agent access which the server can't reach.
 * Never throws; failures are silently discarded.
 */
export function triggerEmbedBackground(
  entityType: 'note' | 'task' | 'bookmark',
  entityId: string,
): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const config = JSON.parse(raw)
    if (!config.embeddingProvider || config.embeddingProvider === 'ollama') return

    fetch('/api/ai/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config, entityType, entityId }),
    }).catch(() => {})
  } catch {}
}

/**
 * Silently re-index ALL un-embedded items after a provider switch.
 * Call this when the user saves new AI settings with a different embedding
 * provider so items created under the old provider get picked up automatically.
 */
export function triggerBulkEmbedBackground(config: AIConfig): void {
  if (!config.embeddingProvider || config.embeddingProvider === 'ollama') return
  fetch('/api/ai/embed', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config }),
  }).catch(() => {})
}
