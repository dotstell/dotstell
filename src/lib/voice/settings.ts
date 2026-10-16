import type { SpeechProvider, SpeechSettings } from './transcribe'

const KEY = 'dotstell-stt-config'
const PROVIDERS: SpeechProvider[] = ['openai', 'groq', 'gemini']

/**
 * The speech-to-text key chosen on its own, for people whose chat provider cannot transcribe audio (Anthropic,
 * Ollama) or who prefer another service. Stored in this browser only, like the other AI keys.
 */
export function loadSpeechSettings(): SpeechSettings | null {
  if (typeof window === 'undefined') return null
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (data && PROVIDERS.includes(data.provider) && typeof data.apiKey === 'string' && data.apiKey.trim()) {
      return { provider: data.provider, apiKey: data.apiKey.trim() }
    }
  } catch { /* unreadable: treat as not set */ }
  return null
}

export function saveSpeechSettings(settings: SpeechSettings | null): void {
  if (settings) localStorage.setItem(KEY, JSON.stringify({ provider: settings.provider, apiKey: settings.apiKey.trim() }))
  else localStorage.removeItem(KEY)
}
