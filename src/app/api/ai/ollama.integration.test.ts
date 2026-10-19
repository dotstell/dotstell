// Runs the real AI routes against a real local Ollama. Skipped unless OLLAMA_INTEGRATION=1, because it needs Ollama
// running with a chat model (default phi4-mini; set OLLAMA_MODEL to use another) and takes a little while.
//   OLLAMA_INTEGRATION=1 npx vitest run src/app/api/ai/ollama.integration.test.ts
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { NextRequest } from 'next/server'
import { summariseMeeting } from '@/lib/meetings/run'
import { ollamaChatBody } from '@/lib/ai/ollama-browser'
import type { AIConfig, AIMessage } from '@/lib/ai/types'

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}))

const transcript = readFileSync(new URL('../../../test/meeting-transcript.txt', import.meta.url), 'utf8').trim()
const config = { provider: 'ollama', model: process.env.OLLAMA_MODEL ?? 'phi4-mini', baseUrl: 'http://localhost:11434', embeddingProvider: 'ollama', embeddingModel: 'nomic-embed-text' }
const post = (path: string, body: unknown) => new NextRequest(`http://localhost${path}`, { method: 'POST', body: JSON.stringify(body) })

describe.skipIf(!process.env.OLLAMA_INTEGRATION)('real Ollama through the server routes', () => {
  it('summarises a meeting piece into usable notes', async () => {
    const { POST } = await import('./meeting/route')
    const res = await POST(post('/api/ai/meeting', { config, mode: 'chunk', text: transcript, index: 0, total: 1, attendees: ['Aiko Tanaka', 'Sam Lee', 'Carlos Mendoza', 'Priya Nair'] }))
    expect(res.status).toBe(200)
    const { digest } = await res.json()
    expect(digest.summary.length).toBeGreaterThan(40)
    expect(digest.actionItems.length).toBeGreaterThanOrEqual(1)
    expect(JSON.stringify(digest.actionItems)).toMatch(/Sam|Carlos|Priya/)
    // The model must not invent a year for "Monday the 26th".
    expect(JSON.stringify(digest.actionItems)).not.toMatch(/20\d\d-\d\d-\d\d/)
  }, 180_000)

  it('combines parts', async () => {
    const { POST } = await import('./meeting/route')
    const part = { summary: 'Part one.', keyPoints: ['Release on Friday'], decisions: ['Ship Friday'], actionItems: [{ text: 'Write the release notes', owner: 'Sam Lee', due: 'Friday' }], openQuestions: [] }
    const other = { summary: 'Part two.', keyPoints: ['Migration timing'], decisions: [], actionItems: [{ text: 'Ask finance about month end', owner: 'Carlos Mendoza', due: null }], openQuestions: ['Weekend window?'] }
    const res = await POST(post('/api/ai/meeting', { config, mode: 'combine', parts: [part, other] }))
    expect(res.status).toBe(200)
    expect((await res.json()).digest.actionItems.length).toBeGreaterThanOrEqual(1)
  }, 180_000)

  it('drafts a note with AI Write', async () => {
    const { POST } = await import('./write/route')
    const res = await POST(post('/api/ai/write', { config, mode: 'draft', format: 'meeting', title: 'Weekly sync' }))
    expect(res.status).toBe(200)
    expect((await res.json()).result).toMatch(/action items/i)
  }, 180_000)

  it('summarises a long meeting end to end the way the browser does: small pieces, grouped combine, native Ollama API', async () => {
    const long = Array.from({ length: 4 }, (_, i) => transcript.replace(/4\.2/g, `4.${2 + i}`)).join('\n')
    // The same request body the browser sends to /api/chat.
    const completeLocal = async (messages: AIMessage[]) => {
      const res = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        body: JSON.stringify({ ...ollamaChatBody(config as AIConfig, messages, { json: true, numCtx: 8192, temperature: 0.1 }), stream: false }),
      })
      return (await res.json()).message?.content ?? ''
    }
    const steps: number[] = []
    const digest = await summariseMeeting(long, { config: config as AIConfig, completeLocal, onProgress: (done, total) => steps.push(done / total) })
    expect(digest.summary.length).toBeGreaterThan(40)
    expect(digest.actionItems.length).toBeGreaterThanOrEqual(3)
    expect(steps.at(-1)).toBe(1)
  }, 600_000)
})
