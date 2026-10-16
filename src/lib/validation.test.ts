import { describe, it, expect } from 'vitest'
import { ilikeContains } from './postgrest'
import { taskFieldError } from './tasks/validate'
import { notebookFieldError, notebookTag, retagNotes, tagCollides } from './notebooks'
import { makeDb, stepArgs, type Responder } from '../test/fake-db'

describe('ilikeContains', () => {
  it('quotes the value so commas and parentheses cannot add filter conditions', () => {
    const p = ilikeContains('x),user_id.neq.abc,(y')
    expect(p.startsWith('"%')).toBe(true)
    expect(p.endsWith('%"')).toBe(true)
    expect(p).toContain('x),user')
    expect(p).not.toMatch(/[^\\"]"[^%]/)  // no unescaped quote inside the value
  })
  it('escapes wildcards, backslashes and quotes', () => {
    // Inside the quoted value a backslash is itself escaped, so each LIKE escape is written twice.
    expect(ilikeContains('100%_done')).toBe('"%100\\\\%\\\\_done%"')
    expect(ilikeContains('say "hi"')).toBe('"%say \\"hi\\"%"')
  })
  it('limits the length', () => {
    expect(ilikeContains('a'.repeat(500)).length).toBe(200 + 4)
  })
})

describe('taskFieldError', () => {
  it('accepts values the database allows', () => {
    expect(taskFieldError({ title: 'x', status: 'in_progress', priority: 'high', tags: ['a'], due_date: '2026-10-16T09:00:00.000Z' })).toBeNull()
    expect(taskFieldError({ status: null, due_date: null })).toBeNull()
  })
  it('rejects values the database would refuse', () => {
    expect(taskFieldError({ status: 'cancelled' })).toBe('Invalid status')
    expect(taskFieldError({ priority: 'urgent' })).toBe('Invalid priority')
    expect(taskFieldError({ title: '   ' })).toBe('Invalid title')
    expect(taskFieldError({ tags: 'a' })).toBe('Invalid tags')
    expect(taskFieldError({ due_date: 'soon' })).toBe('Invalid due date')
  })
})

describe('notebooks', () => {
  it('derives the tag from the name', () => {
    expect(notebookTag('Work Stuff')).toBe('nb:work-stuff')
    expect(notebookTag('  work   stuff ')).toBe('nb:work-stuff')
  })
  it('validates fields', () => {
    expect(notebookFieldError({ name: ' ' })).toBe('Name required')
    expect(notebookFieldError({ name: 'a'.repeat(101) })).toMatch(/100/)
    expect(notebookFieldError({ name: 'ok', color: 5 })).toBe('Invalid color')
    expect(notebookFieldError({ sort_order: 'x' })).toBe('Invalid sort order')
    expect(notebookFieldError({ name: 'ok', color: null, icon: '📓', sort_order: 2 })).toBeNull()
  })
  it('spots names that would share a tag', async () => {
    const { db } = makeDb(() => ({ data: [{ id: '1', name: 'Work Stuff' }] }))
    expect(await tagCollides(db as never, 'u', 'work  stuff')).toBe(true)
    expect(await tagCollides(db as never, 'u', 'work  stuff', '1')).toBe(false)
    expect(await tagCollides(db as never, 'u', 'Home')).toBe(false)
  })
  it('moves notes to the new tag without duplicating it', async () => {
    const respond: Responder = call => (call.steps.some(([n]) => n === 'select') ? { data: [{ id: 'n1', tags: ['nb:old', 'nb:new', 'x'] }] } : undefined)
    const { db, calls } = makeDb(respond)
    await retagNotes(db as never, 'u', 'nb:old', 'nb:new')
    expect(stepArgs(calls[1], 'update')![0]).toEqual({ tags: ['nb:new', 'x'] })
    const none = makeDb()
    await retagNotes(none.db as never, 'u', 'nb:a', 'nb:a')
    expect(none.calls).toHaveLength(0)
  })
})
