import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const embedMock = vi.fn(async () => ({ embedding: Array(768).fill(0.1) }))
const rpcMock = vi.fn(async () => ({ data: [{ id: 'n1', title: 'Plan', content: '<p>Hello</p>', similarity: 0.9 }] }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) }, rpc: rpcMock }),
}))
vi.mock('@/lib/ai/client', () => ({ embed: embedMock, validateConfig: (c: { provider?: string }) => (c?.provider ? null : 'Invalid AI config') }))

const config = { provider: 'ollama', model: 'm' }
const vector = Array(768).fill(0.5)
const post = (body: unknown) => new NextRequest('http://localhost/api/ai/semantic-search', { method: 'POST', body: JSON.stringify(body) })

describe('POST /api/ai/semantic-search', () => {
  beforeEach(() => { vi.resetModules(); embedMock.mockClear(); rpcMock.mockClear() })

  it('embeds the question on the server by default', async () => {
    const { POST } = await import('./route')
    const res = await POST(post({ config, query: 'plan', types: ['note'] }))
    expect(res.status).toBe(200)
    expect(embedMock).toHaveBeenCalledOnce()
    expect((await res.json())[0].title).toBe('Plan')
  })

  it('uses a vector from the browser without calling the provider, and needs no config for it', async () => {
    const { POST } = await import('./route')
    const res = await POST(post({ query: 'plan', types: ['note'], queryEmbedding: vector }))
    expect(res.status).toBe(200)
    expect(embedMock).not.toHaveBeenCalled()
    expect(rpcMock).toHaveBeenCalledWith('match_notes', expect.objectContaining({ query_embedding: vector }))
  })

  it('ignores a vector of the wrong size or content and falls back to the config', async () => {
    const { POST } = await import('./route')
    expect((await POST(post({ query: 'plan', queryEmbedding: [1, 2, 3] }))).status).toBe(400)
    expect((await POST(post({ query: 'plan', queryEmbedding: Array(768).fill('x') }))).status).toBe(400)
    const res = await POST(post({ config, query: 'plan', types: ['note'], queryEmbedding: [1, 2, 3] }))
    expect(res.status).toBe(200)
    expect(embedMock).toHaveBeenCalledOnce()
  })
})
