import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync } from 'node:fs'
import type { PGlite } from '@electric-sql/pglite'
import { generateToken } from './token'
import { ALICE, BOB, createTestDatabase } from './test-db'

// Runs the real migration (supabase/migrations/012_mcp.sql) in an in-memory Postgres; see test-db.ts.
let db: PGlite
const alice = generateToken()
const bob = generateToken()
const revoked = generateToken()
const expired = generateToken()

async function rows<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows
}

/** Calls a function the way the endpoint does: as the anon role, with only a token. */
async function asAnon<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec('set role anon')
  try { return await rows<T>(sql, params) } finally { await db.exec('reset role') }
}

async function asUser<T = Record<string, unknown>>(userId: string, sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId}', false); set role authenticated`)
  try { return await rows<T>(sql, params) } finally { await db.exec('reset role') }
}

const expectInvalid = (p: Promise<unknown>) => expect(p).rejects.toThrow(/invalid_token/)

async function addToken(userId: string, t: { hash: string; prefix: string }, extra = '') {
  await db.query(
    `insert into public.mcp_tokens (user_id, name, token_hash, prefix, expires_at ${extra ? ', ' + extra.split('=')[0] : ''})
     values ($1, 'test', $2, $3, now() + interval '30 days' ${extra ? ', ' + extra.split('=')[1] : ''})`,
    [userId, t.hash, t.prefix],
  )
}

beforeAll(async () => {
  db = await createTestDatabase()

  await addToken(ALICE, alice)
  await addToken(BOB, bob)
  await addToken(ALICE, revoked, 'revoked_at=now()')
  await db.query(
    `insert into public.mcp_tokens (user_id, name, token_hash, prefix, expires_at, created_at)
     values ($1, 'old', $2, $3, now() - interval '1 day', now() - interval '31 days')`,
    [ALICE, expired.hash, expired.prefix],
  )

  await db.exec(`
    insert into public.people (id, user_id, name, company, email) values
      ('10000000-0000-4000-8000-000000000001', '${ALICE}', 'Aiko Tanaka', 'Rakuten', 'aiko@example.com'),
      ('10000000-0000-4000-8000-000000000002', '${BOB}', 'Bob Secret', 'Elsewhere', 'bob@example.com');
    insert into public.notes (id, user_id, title, content, tags, person_id, deleted_at) values
      ('20000000-0000-4000-8000-000000000001', '${ALICE}', 'Release plan', '<p>Ship the <strong>migration</strong> on Friday</p>', '{work}', '10000000-0000-4000-8000-000000000001', null),
      ('20000000-0000-4000-8000-000000000002', '${ALICE}', 'Weekly sync', '<p>Decisions: delay the migration</p>', '{meeting,work}', null, null),
      ('20000000-0000-4000-8000-000000000003', '${ALICE}', 'Trashed', '<p>migration secrets in the bin</p>', '{}', null, now()),
      ('20000000-0000-4000-8000-000000000004', '${ALICE}', 'Discount', '<p>Save 50% off, snake_case</p>', '{}', null, null),
      ('20000000-0000-4000-8000-000000000005', '${BOB}', 'Bob private', '<p>migration plan of someone else</p>', '{meeting}', null, null);
    insert into public.tasks (user_id, title, status, due_date, person_id) values
      ('${ALICE}', 'Write release notes', 'todo', now() + interval '2 days', '10000000-0000-4000-8000-000000000001'),
      ('${ALICE}', 'Old finished thing', 'done', null, null),
      ('${BOB}', 'Bob task', 'todo', null, null);
  `)
})

describe('token checks', () => {
  it('rejects missing, short, unknown, revoked and expired tokens the same way', async () => {
    for (const t of [null, '', 'short', 'dst_' + 'x'.repeat(43), revoked.token, expired.token]) {
      await expectInvalid(asAnon('select * from public.mcp_recent_notes($1, 5)', [t]))
    }
    await expectInvalid(asAnon('select public.mcp_check_token($1)', ['dst_' + 'y'.repeat(43)]))
  })

  it('counts a tool call as use but a handshake check as none, and records only the tool name', async () => {
    const before = (await rows<{ use_count: string }>('select use_count from public.mcp_tokens where token_hash = $1', [bob.hash]))[0]
    await asAnon('select public.mcp_check_token($1)', [bob.token])
    await asAnon('select * from public.mcp_recent_notes($1, 5)', [bob.token])
    const after = (await rows<{ use_count: string; last_used_at: string | null }>('select use_count, last_used_at from public.mcp_tokens where token_hash = $1', [bob.hash]))[0]
    expect(Number(after.use_count)).toBe(Number(before.use_count) + 1)
    expect(after.last_used_at).not.toBeNull()
    const events = await rows<{ tool: string }>('select e.tool from public.mcp_token_events e join public.mcp_tokens t on t.id = e.token_id where t.token_hash = $1', [bob.hash])
    expect(events.map(e => e.tool)).toEqual(['recent_notes'])
  })
})

describe('what a token can read', () => {
  it('finds only its own notes, ignores markup and deleted notes, and needs every word', async () => {
    const found = await asAnon<{ title: string }>('select title from public.mcp_search_notes($1, $2, 10)', [alice.token, 'migration'])
    expect(found.map(r => r.title).sort()).toEqual(['Release plan', 'Weekly sync'])
    expect(await asAnon('select * from public.mcp_search_notes($1, $2, 10)', [alice.token, 'migration banana'])).toHaveLength(0)
    expect(await asAnon('select * from public.mcp_search_notes($1, $2, 10)', [alice.token, 'strong'])).toHaveLength(0)
    expect(await asAnon('select * from public.mcp_search_notes($1, $2, 10)', [alice.token, '   '])).toHaveLength(0)
  })

  it('treats % and _ in a query as plain characters', async () => {
    expect(await asAnon('select * from public.mcp_search_notes($1, $2, 10)', [alice.token, '%'])).toHaveLength(1)
    expect(await asAnon('select * from public.mcp_search_notes($1, $2, 10)', [alice.token, 'snake_case'])).toHaveLength(1)
    expect(await asAnon('select * from public.mcp_search_notes($1, $2, 10)', [alice.token, 'snakeXcase'])).toHaveLength(0)
  })

  it('never returns another user note, by search, recent list or id', async () => {
    const bobNote = '20000000-0000-4000-8000-000000000005'
    expect((await asAnon<{ title: string }>('select title from public.mcp_search_notes($1, $2, 10)', [bob.token, 'migration'])).map(r => r.title)).toEqual(['Bob private'])
    expect(await asAnon('select * from public.mcp_get_note($1, $2)', [alice.token, bobNote])).toHaveLength(0)
    expect((await asAnon<{ title: string }>('select title from public.mcp_recent_notes($1, 25)', [alice.token])).map(r => r.title)).not.toContain('Bob private')
  })

  it('does not return deleted notes by id', async () => {
    expect(await asAnon('select * from public.mcp_get_note($1, $2)', [alice.token, '20000000-0000-4000-8000-000000000003'])).toHaveLength(0)
    expect(await asAnon('select * from public.mcp_get_note($1, $2)', [alice.token, '20000000-0000-4000-8000-000000000001'])).toHaveLength(1)
  })

  it('caps the number of results whatever is asked', async () => {
    await db.exec(`insert into public.notes (user_id, title, content) select '${ALICE}', 'bulk ' || g, 'bulk text' from generate_series(1, 40) g`)
    expect(await asAnon('select * from public.mcp_search_notes($1, $2, 1000)', [alice.token, 'bulk'])).toHaveLength(25)
    expect(await asAnon('select * from public.mcp_recent_notes($1, 1000)', [alice.token])).toHaveLength(25)
    expect(await asAnon('select * from public.mcp_recent_notes($1, -5)', [alice.token])).toHaveLength(1)
  })

  it('lists only notes tagged meeting, and only the token owner ones', async () => {
    expect((await asAnon<{ title: string }>('select title from public.mcp_list_meetings($1, 10)', [alice.token])).map(r => r.title)).toEqual(['Weekly sync'])
  })

  it('lists tasks with filters, rejects an unknown status, and hides other users', async () => {
    expect((await asAnon<{ title: string }>('select title from public.mcp_list_tasks($1)', [alice.token])).map(r => r.title)).toEqual(['Write release notes', 'Old finished thing'])
    expect(await asAnon('select * from public.mcp_list_tasks($1, $2)', [alice.token, 'done'])).toHaveLength(1)
    expect(await asAnon('select * from public.mcp_list_tasks($1, null, now() + interval \'1 day\')', [alice.token])).toHaveLength(0)
    await expect(asAnon('select * from public.mcp_list_tasks($1, $2)', [alice.token, 'bogus'])).rejects.toThrow(/invalid_status/)
  })

  it('finds people and their linked notes and tasks, never another user person', async () => {
    expect((await asAnon<{ name: string }>('select name from public.mcp_list_people($1, $2)', [alice.token, 'aiko'])).map(r => r.name)).toEqual(['Aiko Tanaka'])
    expect(await asAnon('select * from public.mcp_list_people($1, $2)', [alice.token, 'bob'])).toHaveLength(0)
    const person = (await asAnon<{ p: { notes: { title: string }[]; tasks: { title: string }[] } }>('select public.mcp_get_person($1, $2) as p', [alice.token, '10000000-0000-4000-8000-000000000001']))[0].p
    expect(person.notes.map(n => n.title)).toEqual(['Release plan'])
    expect(person.tasks.map(t => t.title)).toEqual(['Write release notes'])
    expect((await asAnon<{ p: unknown }>('select public.mcp_get_person($1, $2) as p', [alice.token, '10000000-0000-4000-8000-000000000002']))[0].p).toBeNull()
  })
})

describe('what the public role and a signed-in user can do', () => {
  it('lets the anon role call the tools but not read tables or the internal check', async () => {
    await expect(asAnon('select * from public.notes')).rejects.toThrow(/permission denied/)
    await expect(asAnon('select * from public.mcp_tokens')).rejects.toThrow(/permission denied/)
    await expect(asAnon('select * from public.mcp_token_events')).rejects.toThrow(/permission denied/)
    await expect(asAnon('select public.mcp_resolve($1, $2)', [alice.token, 'x'])).rejects.toThrow(/permission denied/)
  })

  it('lets a user see and revoke their own tokens but not change expiry or counters, or touch another user token', async () => {
    expect((await asUser(ALICE, 'select id from public.mcp_tokens')).length).toBe(3)
    expect((await asUser(BOB, 'select id from public.mcp_tokens')).length).toBe(1)
    await expect(asUser(ALICE, "update public.mcp_tokens set expires_at = now() + interval '300 days'")).rejects.toThrow(/permission denied/)
    await expect(asUser(ALICE, 'update public.mcp_tokens set use_count = 0')).rejects.toThrow(/permission denied/)
    await asUser(BOB, 'update public.mcp_tokens set revoked_at = now() where token_hash = $1', [alice.hash])
    expect((await rows<{ revoked_at: string | null }>('select revoked_at from public.mcp_tokens where token_hash = $1', [alice.hash]))[0].revoked_at).toBeNull()
  })

  it('refuses a token for someone else, a lifetime over a year, or a malformed hash', async () => {
    const t = generateToken()
    await expect(asUser(ALICE, `insert into public.mcp_tokens (user_id, name, token_hash, prefix, expires_at) values ('${BOB}', 'x', $1, 'dst_abcd', now() + interval '10 days')`, [t.hash])).rejects.toThrow(/row-level security/)
    await expect(asUser(ALICE, `insert into public.mcp_tokens (user_id, name, token_hash, prefix, expires_at) values ('${ALICE}', 'x', $1, 'dst_abcd', now() + interval '400 days')`, [t.hash])).rejects.toThrow(/check/)
    await expect(asUser(ALICE, `insert into public.mcp_tokens (user_id, name, token_hash, prefix, expires_at) values ('${ALICE}', 'x', 'not-a-hash', 'dst_abcd', now() + interval '10 days')`)).rejects.toThrow(/check/)
    await asUser(ALICE, `insert into public.mcp_tokens (user_id, name, token_hash, prefix, expires_at) values ('${ALICE}', 'fine', $1, 'dst_abcd', now() + interval '10 days')`, [t.hash])
  })

  it('shows a user the activity of their own tokens only', async () => {
    await asAnon('select * from public.mcp_recent_notes($1, 1)', [alice.token])
    const own = await asUser(ALICE, 'select tool from public.mcp_token_events')
    expect(own.length).toBeGreaterThan(0)
    const owners = await rows<{ user_id: string }>(
      'select distinct t.user_id from public.mcp_token_events e join public.mcp_tokens t on t.id = e.token_id where e.id = any ($1)',
      [(await asUser<{ id: number }>(BOB, 'select id from public.mcp_token_events')).map(r => r.id)],
    )
    expect(owners.map(o => o.user_id)).toEqual([BOB])
  })
})

describe('applying and undoing the migration', () => {
  const migration = readFileSync(new URL('../../../supabase/migrations/012_mcp.sql', import.meta.url), 'utf8')
  const rollback = readFileSync(new URL('../../../supabase/rollback/012_mcp_down.sql', import.meta.url), 'utf8')
  const objects = `select (select count(*) from pg_proc where proname like 'mcp\_%')::int as functions,
                          (select count(*) from pg_tables where schemaname = 'public' and tablename like 'mcp\_%')::int as tables`

  it('can be run again after it has been applied, without errors or losing tokens', async () => {
    const fresh = await createTestDatabase()
    const t = generateToken()
    await fresh.query(`insert into public.mcp_tokens (user_id, name, token_hash, prefix, expires_at) values ($1, 'keep', $2, $3, now() + interval '5 days')`, [ALICE, t.hash, t.prefix])
    await fresh.exec(migration)
    expect((await fresh.query('select name from public.mcp_tokens')).rows).toEqual([{ name: 'keep' }])
  })

  it('rolls back only the MCP objects, leaves notes and tasks alone, and can be applied again', async () => {
    const fresh = await createTestDatabase()
    await fresh.exec(`insert into public.notes (user_id, title) values ('${ALICE}', 'Mine'); insert into public.tasks (user_id, title) values ('${ALICE}', 'Do it')`)
    expect((await fresh.query<{ functions: number; tables: number }>(objects)).rows[0]).toEqual({ functions: 15, tables: 2 })

    await fresh.exec(rollback)
    await fresh.exec(rollback)
    expect((await fresh.query<{ functions: number; tables: number }>(objects)).rows[0]).toEqual({ functions: 0, tables: 0 })
    expect((await fresh.query('select title from public.notes')).rows).toEqual([{ title: 'Mine' }])
    expect((await fresh.query('select title from public.tasks')).rows).toEqual([{ title: 'Do it' }])

    await fresh.exec(migration)
    expect((await fresh.query<{ functions: number; tables: number }>(objects)).rows[0]).toEqual({ functions: 15, tables: 2 })
  })
})
