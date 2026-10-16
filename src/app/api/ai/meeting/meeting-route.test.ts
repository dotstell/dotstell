import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

let signedIn = true
let reply = ''
const completeMock = vi.fn<(config: unknown, messages: { content: string }[]) => Promise<string>>(async () => reply)

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'u1' } : null } }) } }),
}))
vi.mock('@/lib/ai/client', () => ({ complete: completeMock, validateConfig: (c: { provider?: string }) => (c?.provider ? null : 'Invalid AI config') }))

const config = { provider: 'ollama', model: 'm' }
const post = (body: unknown) => new NextRequest('http://localhost/api/ai/meeting', { method: 'POST', body: JSON.stringify(body) })
const good = JSON.stringify({ summary: 'Done.', keyPoints: [], decisions: [], actionItems: [{ text: 'Ship', owner: 'Sam', due: null }], openQuestions: [] })

describe('POST /api/ai/meeting', () => {
  beforeEach(() => { vi.resetModules(); signedIn = true; reply = good; completeMock.mockClear() })

  it('requires a signed-in user and valid input', async () => {
    const { POST } = await import('./route')
    signedIn = false
    expect((await POST(post({ config, mode: 'chunk', text: 'x' }))).status).toBe(401)
    signedIn = true
    expect((await POST(post({ mode: 'chunk', text: 'x' }))).status).toBe(400)
    expect((await POST(post({ config, mode: 'other' }))).status).toBe(400)
    expect((await POST(post({ config, mode: 'chunk', text: '  ' }))).status).toBe(400)
    expect((await POST(post({ config, mode: 'combine', parts: [] }))).status).toBe(400)
    expect((await POST(post({ config, mode: 'combine', parts: Array(41).fill({}) }))).status).toBe(400)
    expect(completeMock).not.toHaveBeenCalled()
  })

  it('returns a parsed digest and caps what it sends to the model', async () => {
    const { POST } = await import('./route')
    const res = await POST(post({ config, mode: 'chunk', text: 'a'.repeat(50_000), index: 99, total: 3, attendees: ['Sam', 5, 'x'.repeat(500)] }))
    expect(res.status).toBe(200)
    expect((await res.json()).digest.actionItems[0]).toEqual({ text: 'Ship', owner: 'Sam', due: null })
    const messages = completeMock.mock.calls[0][1]
    expect(messages[1].content.length).toBeLessThan(15_500)
    expect(messages[0].content).toContain('part 1 of 3')
  })

  it('re-reads parts before combining, so oversized or malformed data never reaches the model as-is', async () => {
    const { POST } = await import('./route')
    const huge = { summary: 'x'.repeat(100_000), keyPoints: Array(500).fill('p'), decisions: [], actionItems: [], openQuestions: [] }
    const res = await POST(post({ config, mode: 'combine', parts: [huge, 'garbage', null] }))
    expect(res.status).toBe(200)
    const sent = completeMock.mock.calls[0][1][1].content
    expect(sent.length).toBeLessThan(10_000)
  })

  it('reports an unusable model reply as a 502 with advice', async () => {
    reply = 'Sorry, I cannot help with that.'
    const { POST } = await import('./route')
    const res = await POST(post({ config, mode: 'chunk', text: 'hello' }))
    expect(res.status).toBe(502)
    expect((await res.json()).error).toMatch(/Try again/)
  })
})
