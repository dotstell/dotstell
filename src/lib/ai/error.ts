type ProviderName = 'OpenAI' | 'Anthropic' | 'Gemini' | 'Groq' | 'Ollama'

interface HelpAction { url: string; label: string }

const HELP: Partial<Record<ProviderName, Partial<Record<number, HelpAction>>>> = {
  OpenAI: {
    401: { url: 'https://platform.openai.com/account/api-keys',  label: 'Check your OpenAI API key' },
    403: { url: 'https://platform.openai.com/account/api-keys',  label: 'Check your OpenAI API key' },
    429: { url: 'https://platform.openai.com/account/billing',   label: 'Add billing credits to your OpenAI account' },
  },
  Anthropic: {
    401: { url: 'https://console.anthropic.com/settings/keys',    label: 'Check your Anthropic API key' },
    403: { url: 'https://console.anthropic.com/settings/keys',    label: 'Check your Anthropic API key' },
    429: { url: 'https://console.anthropic.com/settings/billing', label: 'View your Anthropic usage & billing' },
  },
  Gemini: {
    401: { url: 'https://aistudio.google.com/app/apikey', label: 'Check your Google AI Studio API key' },
    403: { url: 'https://aistudio.google.com/app/apikey', label: 'Check your Google AI Studio API key' },
    429: { url: 'https://ai.google.dev/pricing',           label: 'View Gemini API quotas & pricing' },
  },
  Groq: {
    401: { url: 'https://console.groq.com/keys',            label: 'Check your Groq API key' },
    403: { url: 'https://console.groq.com/keys',            label: 'Check your Groq API key' },
    429: { url: 'https://console.groq.com/settings/limits', label: 'View your Groq rate limits' },
  },
}

const STATUS_MESSAGES: Record<number, string> = {
  401: 'Invalid API key — double-check what you pasted',
  403: 'Invalid API key or insufficient permissions',
  429: 'Rate limit exceeded — your account is out of quota',
  404: 'Model not found — update the model name in AI Settings',
  500: 'Provider server error — try again later',
  502: 'Provider unreachable — try again later',
  503: 'Provider unavailable — try again later',
}

function cleanRawMessage(raw: string): string {
  return raw
    .replace(/\s*Expected OAuth 2[^.]+\./gi, '')
    .replace(/\s*login cookie or[^.]+\./gi, '')
    .replace(/\s*Please pass a valid API key\./gi, '')
    .replace(/\s*For more information[^.]+\./gi, '')
    .replace(/\s*read the docs[^.]+\./gi, '')
    .trim()
}

/**
 * Build a normalised, user-friendly Error from a raw provider HTTP error.
 * The message is encoded as `"label — human message|||url|||link label"` so the
 * UI can render the help link as a clickable anchor without parsing raw URLs.
 */
export function providerError(label: string, status: number, rawMsg: string): Error {
  const help     = HELP[label as ProviderName]?.[status]
  const fixedMsg = STATUS_MESSAGES[status]
  const msg      = fixedMsg ?? `error ${status}: ${cleanRawMessage(rawMsg)}`
  const full     = help
    ? `${label} — ${msg}|||${help.url}|||${help.label}`
    : `${label} — ${msg}`
  return new Error(full)
}

/** Extract the human-readable message from a raw JSON or plain-text error response body. */
export function extractMessage(raw: string): string {
  try {
    const p = JSON.parse(raw)
    return p?.error?.message ?? p?.error ?? p?.message ?? raw
  } catch {
    return raw
  }
}
