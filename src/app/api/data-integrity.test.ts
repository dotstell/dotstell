import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { firstIndex, makeDb, ops, stepArgs, type Call, type Responder } from '@/test/fake-db'
import { wouldCreateCycle, detachActiveChildren } from '@/lib/notes/hierarchy'

let current: ReturnType<typeof makeDb>
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => current.db }))

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'
const SRC = '99999999-9999-4999-8999-999999999999'

const post = (url: string, body: unknown) => new NextRequest(`http://localhost${url}`, { method: 'POST', body: JSON.stringify(body) })

describe('POST /api/wikilinks', () => {
  const owning = (owned: string[], failUpsert = false): Responder => (call: Call) => {
    if (call.table === 'notes' && ops(call).includes('single')) return { data: { id: SRC } }
    if (call.table === 'notes') return { data: owned.map(id => ({ id })) }
    if (call.table === 'knowledge_links' && ops(call).includes('upsert') && failUpsert) return { error: { message: 'duplicate' } }
    return undefined
  }

  beforeEach(() => { vi.resetModules() })

  it('saves the new links first and removes stale ones afterwards', async () => {
    current = makeDb(owning([A, B]))
    const { POST } = await import('./wikilinks/route')
    const res = await POST(post('/api/wikilinks', { sourceNoteId: SRC, targetNoteIds: [A, B, A, 'not-a-uuid', SRC, C] }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, count: 2 })

    const upsert = firstIndex(current.calls, 'knowledge_links', 'upsert')
    const del = firstIndex(current.calls, 'knowledge_links', 'delete')
    expect(upsert).toBeGreaterThan(-1)
    expect(del).toBeGreaterThan(upsert)

    // Duplicates, a non-UUID, a link to itself and a note the user does not own are all dropped.
    const rows = stepArgs(current.calls[upsert], 'upsert')![0] as { target_id: string }[]
    expect(rows.map(r => r.target_id)).toEqual([A, B])
    const notIn = stepArgs(current.calls[del], 'not')!
    expect(notIn).toEqual(['target_id', 'in', `(${A},${B})`])
  })

  it('leaves the existing links alone when saving the new ones fails', async () => {
    current = makeDb(owning([A], true))
    const { POST } = await import('./wikilinks/route')
    const res = await POST(post('/api/wikilinks', { sourceNoteId: SRC, targetNoteIds: [A] }))
    expect(res.status).toBe(500)
    expect(firstIndex(current.calls, 'knowledge_links', 'delete')).toBe(-1)
  })

  it('removes every wikilink edge when the note no longer links anywhere', async () => {
    current = makeDb(owning([]))
    const { POST } = await import('./wikilinks/route')
    const res = await POST(post('/api/wikilinks', { sourceNoteId: SRC, targetNoteIds: [] }))
    expect(res.status).toBe(200)
    expect(firstIndex(current.calls, 'knowledge_links', 'upsert')).toBe(-1)
    const del = current.calls[firstIndex(current.calls, 'knowledge_links', 'delete')]
    expect(ops(del)).not.toContain('not')
  })
})

describe('permanent delete keeps active sub-notes', () => {
  beforeEach(() => { vi.resetModules() })

  it('detaches active children before the parent row is deleted', async () => {
    current = makeDb(call => (call.table === 'notes' && ops(call).includes('single') ? { data: { deleted_at: '2026-01-01' } } : undefined))
    const { DELETE } = await import('./notes/[id]/permanent/route')
    const res = await DELETE(new NextRequest(`http://localhost/api/notes/${A}/permanent`, { method: 'DELETE' }), { params: Promise.resolve({ id: A }) })
    expect(res.status).toBe(204)

    const detach = current.calls.findIndex(c => ops(c).includes('update'))
    const remove = current.calls.findIndex(c => ops(c).includes('delete'))
    expect(detach).toBeGreaterThan(-1)
    expect(remove).toBeGreaterThan(detach)
    expect(stepArgs(current.calls[detach], 'update')![0]).toEqual({ parent_id: null })
    expect(stepArgs(current.calls[detach], 'in')).toEqual(['parent_id', [A]])
    // Only children that are still active: trashed ones go with their parent.
    expect(stepArgs(current.calls[detach], 'is')).toEqual(['deleted_at', null])
  })

  it('detachActiveChildren works in chunks for large lists', async () => {
    current = makeDb()
    await detachActiveChildren(current.db as never, 'u1', Array.from({ length: 250 }, (_, i) => `id${i}`))
    expect(current.calls).toHaveLength(3)
  })
})

describe('wouldCreateCycle', () => {
  // a is the top note, b sits inside a, c inside b.
  const parents: Record<string, string | null> = { a: null, b: 'a', c: 'b' }
  const respond: Responder = call => {
    const id = stepArgs(call, 'eq')?.[1] as string
    return { data: id in parents ? { parent_id: parents[id] } : null }
  }

  it('refuses a note inside itself or inside its own descendants', async () => {
    current = makeDb(respond)
    expect(await wouldCreateCycle(current.db as never, 'u1', 'a', 'a')).toBe(true)
    expect(await wouldCreateCycle(current.db as never, 'u1', 'a', 'c')).toBe(true)
    expect(await wouldCreateCycle(current.db as never, 'u1', 'b', 'c')).toBe(true)
  })

  it('allows ordinary moves', async () => {
    current = makeDb(respond)
    expect(await wouldCreateCycle(current.db as never, 'u1', 'c', 'a')).toBe(false)
    expect(await wouldCreateCycle(current.db as never, 'u1', 'c', 'b')).toBe(false)
  })

  it('treats an endless chain as a loop', async () => {
    current = makeDb(() => ({ data: { parent_id: 'x' } }))
    expect(await wouldCreateCycle(current.db as never, 'u1', 'n', 'x')).toBe(true)
  })
})
