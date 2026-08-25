import { NextRequest, NextResponse } from 'next/server'
import { providerError, extractMessage } from '@/lib/ai/error'

// POST /api/ai/cloud-models
// Body: { provider: "openai"|"anthropic"|"groq", apiKey: string }
// API key is sent in the POST body (not a query param) to keep it out of server logs.

const ENDPOINTS: Record<string, { url: string; headers: (key: string) => Record<string, string> }> = {
  openai: {
    url:     'https://api.openai.com/v1/models',
    headers: key => ({ Authorization: `Bearer ${key}` }),
  },
  groq: {
    url:     'https://api.groq.com/openai/v1/models',
    headers: key => ({ Authorization: `Bearer ${key}` }),
  },
  anthropic: {
    url:     'https://api.anthropic.com/v1/models',
    headers: key => ({ 'x-api-key': key, 'anthropic-version': '2023-06-01' }),
  },
}

const CHAT_PREFIXES: Record<string, string[]> = {
  openai:    ['gpt-'],
  groq:      ['llama', 'mixtral', 'gemma', 'mistral', 'qwen', 'deepseek'],
  anthropic: ['claude-'],
}

export async function POST(req: NextRequest) {
  const body: { provider?: string; apiKey?: string } = await req.json().catch(() => ({}))
  const provider = body.provider ?? ''
  const apiKey   = body.apiKey   ?? ''

  if (!ENDPOINTS[provider]) {
    return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
  }
  if (!apiKey) {
    return NextResponse.json({ error: 'apiKey is required' }, { status: 400 })
  }

  const { url, headers } = ENDPOINTS[provider]
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...headers(apiKey) },
      signal:  AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      const raw   = await res.text().catch(() => res.statusText)
      const label = provider.charAt(0).toUpperCase() + provider.slice(1)
      const err   = providerError(label, res.status, extractMessage(raw))
      return NextResponse.json({ error: err.message }, { status: res.status })
    }

    const data  = await res.json()
    const allIds: string[] = (data.data ?? []).map((m: { id: string }) => m.id).filter(Boolean)
    const prefixes = CHAT_PREFIXES[provider] ?? []
    const models   = allIds.filter(id => prefixes.some(p => id.toLowerCase().startsWith(p)))
    return NextResponse.json({ models })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch models'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
