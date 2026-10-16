import { describe, it, expect } from 'vitest'
import { buildWriteMessages } from './write-prompts'

describe('buildWriteMessages', () => {
  it('builds a draft request with the title and intent', () => {
    const r = buildWriteMessages({ mode: 'draft', format: 'meeting', intent: 'Q4 sync', title: 'Weekly' })
    if ('error' in r) throw new Error(r.error)
    expect(r.messages[0].content).toContain('Agenda')
    expect(r.messages[0].content).toContain('The note title is: "Weekly"')
    expect(r.messages[1].content).toBe('Write this: Q4 sync (titled "Weekly")')
  })
  it('builds an improve request and clamps long content', () => {
    const r = buildWriteMessages({ mode: 'improve', format: 'concise', content: 'x'.repeat(20_000) })
    if ('error' in r) throw new Error(r.error)
    expect(r.messages[1].content).toHaveLength(12_000)
  })
  it('rejects unknown formats and empty content', () => {
    expect(buildWriteMessages({ mode: 'draft', format: 'nope' })).toEqual({ error: 'Unknown draft format: nope' })
    expect(buildWriteMessages({ mode: 'improve', format: 'nope', content: 'x' })).toEqual({ error: 'Unknown improve format: nope' })
    expect(buildWriteMessages({ mode: 'improve', content: '  ' })).toEqual({ error: 'content is required for improve mode' })
  })
})
