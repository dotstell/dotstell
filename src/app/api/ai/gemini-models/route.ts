import { NextRequest, NextResponse } from 'next/server'
import { providerError, extractMessage } from '@/lib/ai/error'

// POST /api/ai/gemini-models
// Body: { apiKey: string }
// API key is sent in the POST body (not a query param) to keep it out of server logs.
export async function POST(req: NextRequest) {
  const body: { apiKey?: string } = await req.json().catch(() => ({}))
  const apiKey = body.apiKey ?? ''
  if (!apiKey) return NextResponse.json({ error: 'apiKey is required' }, { status: 400 })

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=100`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) {
      const raw = await res.text().catch(() => res.statusText)
      const err = providerError('Gemini', res.status, extractMessage(raw))
      return NextResponse.json({ error: err.message }, { status: res.status })
    }
    const data: { models: Array<{ name: string; supportedGenerationMethods: string[] }> } = await res.json()
    const all = data.models ?? []
    const chatModels  = all
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => m.name.replace('models/', ''))
      .filter(Boolean)
    const embedModels = all
      .filter(m => m.supportedGenerationMethods?.includes('embedContent'))
      .map(m => m.name.replace('models/', ''))
      .filter(Boolean)
    return NextResponse.json({ models: chatModels, embedModels })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch Gemini models'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
