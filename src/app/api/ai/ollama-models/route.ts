import { NextRequest, NextResponse } from 'next/server'

// GET /api/ai/ollama-models?baseUrl=http://localhost:11434
// Proxies the Ollama /api/tags call server-side so the browser never hits
// localhost directly — avoiding corporate proxy interference.
export async function GET(req: NextRequest) {
  const baseUrl = (req.nextUrl.searchParams.get('baseUrl') || 'http://localhost:11434')
    .replace(/\/v1\/?$/, '').replace(/\/$/, '')

  // Validate URL and enforce localhost-only — prevent SSRF to internal network
  let hostname: string
  try {
    hostname = new URL(baseUrl).hostname
  } catch {
    return NextResponse.json({ error: 'Invalid Ollama URL' }, { status: 400 })
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname)) {
    return NextResponse.json({ error: 'Only localhost Ollama instances are supported' }, { status: 400 })
  }

  try {
    const res = await fetch(`${baseUrl}/api/tags`, {
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return NextResponse.json({ error: `Ollama returned ${res.status}` }, { status: res.status })
    const data: { models: Array<{ name: string; capabilities?: string[] }> } = await res.json()
    const models = (data.models ?? []).map(m => ({
      name:         m.name,
      capabilities: m.capabilities ?? [],
    }))
    return NextResponse.json({ models })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Cannot reach Ollama'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
