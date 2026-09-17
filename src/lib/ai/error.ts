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
  400: 'Provider rejected the request',
  401: 'Invalid API key — double-check what you pasted',
  403: 'Invalid API key or insufficient permissions',
  429: 'Rate limit or quota exceeded',
  404: 'Model not found — update the model name in AI Settings',
  500: 'Provider server error — try again later',
  502: 'Provider unreachable — try again later',
  503: 'Provider unavailable — try again later',
}

/**
 * Carries the upstream provider's HTTP status alongside the message so API routes can
 * return the real status instead of flattening everything to a generic 502 — a 502 tells
 * the user "provider unreachable" when the actual cause was a bad key or empty balance.
 */
export class ProviderError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name   = 'ProviderError'
    this.status = status
  }
}

/**
 * Prepaid providers signal "this account has no money left" in ways that are otherwise
 * indistinguishable from ordinary, transient failures — and the advice is opposite, since
 * retrying never refills a balance. They do not even agree on a status code:
 *   OpenAI    → 429, `insufficient_quota`      (looks like rate limiting)
 *   Anthropic → 400, "credit balance is too low" (looks like a malformed request)
 * So this is matched on body text regardless of status. The patterns are deliberately
 * specific: Gemini's free-tier 429 ("Quota exceeded for quota metric …") must NOT match,
 * because it genuinely does clear on its own and has its own message below.
 */
function isOutOfCredits(rawMsg: string): boolean {
  return /insufficient_quota|exceeded your current quota|check your plan and billing|credit balance is too low|billing_not_active/i.test(rawMsg)
}

// Provider-specific overrides for specific status codes
const PROVIDER_STATUS_MESSAGES: Partial<Record<ProviderName, Partial<Record<number, string>>>> = {
  Gemini: {
    429: 'Free tier daily limit reached (1M tokens/day) — quota resets at midnight PST. Try a different model or wait for the reset.',
  },
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
export function providerError(label: string, status: number, rawMsg: string): ProviderError {
  const creditsGone = isOutOfCredits(rawMsg)
  const fixedMsg    = PROVIDER_STATUS_MESSAGES[label as ProviderName]?.[status] ?? STATUS_MESSAGES[status]
  // Out of credits is a billing problem whatever status the provider chose to report it
  // with, so point at the billing link (the 429 entry) rather than this status's link,
  // which for Anthropic's 400 would otherwise be no link at all.
  const help        = creditsGone
    ? HELP[label as ProviderName]?.[429] ?? HELP[label as ProviderName]?.[status]
    : HELP[label as ProviderName]?.[status]

  let msg: string
  if (creditsGone) {
    // Distinct from ordinary rate limiting: this only clears by topping up the account.
    msg = 'Out of API credits — this key has no remaining balance, so retrying will not help'
  } else if (status === 404 || status === 400) {
    // Include the raw provider text — it names the offending model/param, which is the
    // whole diagnostic value for these two (e.g. a model that rejects system messages).
    msg = `${STATUS_MESSAGES[status]} (${cleanRawMessage(rawMsg)})`
  } else {
    msg = fixedMsg ?? `HTTP ${status}: ${cleanRawMessage(rawMsg)}`
  }

  const full = help
    ? `${label} — ${msg}|||${help.url}|||${help.label}`
    : `${label} — ${msg}`
  return new ProviderError(full, status)
}

/**
 * Status to return for a caught AI error: the provider's own status when we know it,
 * otherwise 502 (a genuine "couldn't reach the provider" — network failure, DNS, timeout).
 * Routes previously hardcoded 502 for everything, which made a bad key, an empty balance
 * and a wrong model name all indistinguishable from the provider being down.
 */
export function errorStatus(err: unknown): number {
  return err instanceof ProviderError ? err.status : 502
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
