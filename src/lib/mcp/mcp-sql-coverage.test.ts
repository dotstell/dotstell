// Bookmarks, notebooks, tags, links and checklist notes through the real migration; see test-db.ts.
import { describe, it, expect, beforeAll } from 'vitest'
import type { PGlite } from '@electric-sql/pglite'
import { generateToken } from './token'
import { ALICE, BOB, createTestDatabase } from './test-db'

let db: PGlite
const alice = generateToken()
const bob = generateToken()
const revoked = generateToken()

const NOTE_RELEASE = '20000000-0000-4000-8000-000000000001'
const NOTE_TRASHED = '20000000-0000-4000-8000-000000000003'
const BOB_NOTE = '20000000-0000-4000-8000-000000000005'
const PERSON_AIKO = '10000000-0000-4000-8000-000000000001'
const CHECKLIST = '30000000-0000-4000-8000-000000000001'

/** Calls a function the way the endpoint does: as the anon role, with only a token. */
async function asAnon<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  await db.exec('set role anon')
  try { return (await db.query<T>(sql, params)).rows } finally { await db.exec('reset role') }
}

beforeAll(async () => {
  db = await createTestDatabase()
  for (const [user, t, extra] of [[ALICE, alice, ''], [BOB, bob, ''], [ALICE, revoked, ', revoked_at']] as const) {
    await db.query(
      `insert into public.mcp_tokens (user_id, name, token_hash, prefix, expires_at ${extra}) values ($1, 'test', $2, $3, now() + interval '30 days' ${extra ? ', now()' : ''})`,
      [user, t.hash, t.prefix],
    )
  }
  await db.exec(`
    insert into public.people (id, user_id, name) values ('${PERSON_AIKO}', '${ALICE}', 'Aiko Tanaka');
    insert into public.notes (id, user_id, title, content, tags, deleted_at) values
      ('${NOTE_RELEASE}', '${ALICE}', 'Release plan', '<p>Ship it</p>', '{work}', null),
      ('20000000-0000-4000-8000-000000000002', '${ALICE}', 'Weekly sync', '<p>Decisions</p>', '{meeting,work}', null),
      ('${NOTE_TRASHED}', '${ALICE}', 'Trashed', '<p>gone</p>', '{}', now()),
      ('${BOB_NOTE}', '${BOB}', 'Bob private', '<p>secret</p>', '{meeting}', null);
    insert into public.notes (id, user_id, title, content, type, checklist_items, tags) values
      ('${CHECKLIST}', '${ALICE}', 'Reading list', '', 'checklist', '[{"text":"Designing Data-Intensive Applications","checked":true},{"text":"Refactoring UI","checked":false}]', '{nb:work-stuff}'),
      (gen_random_uuid(), '${ALICE}', 'Stuffed', '<p>in the notebook</p>', 'plain', '[]', '{nb:work-stuff,project-x}'),
      (gen_random_uuid(), '${ALICE}', 'Odd checklist', '', 'checklist', '{"not":"an array"}', '{}');
    insert into public.notebooks (user_id, name, icon, sort_order) values
      ('${ALICE}', ' Work  Stuff ', 'x', 1), ('${ALICE}', 'Empty', 'x', 2), ('${BOB}', 'Bob Private', 'x', 1);
    insert into public.bookmarks (user_id, title, url, description) values
      ('${ALICE}', 'Postgres docs', 'https://postgresql.org/docs', 'The official manual'),
      ('${ALICE}', 'Mind the gap', 'https://example.com/gap', 'about postgres indexes'),
      ('${BOB}', 'Bob postgres', 'https://bob.example/postgres', 'secret');
    insert into public.knowledge_links (user_id, source_id, source_type, target_id, target_type) values
      ('${ALICE}', '${NOTE_RELEASE}', 'note', '${PERSON_AIKO}', 'person'),
      ('${ALICE}', '${CHECKLIST}', 'note', '${NOTE_RELEASE}', 'note'),
      ('${ALICE}', '${NOTE_RELEASE}', 'note', '${NOTE_TRASHED}', 'note'),
      ('${ALICE}', '${NOTE_RELEASE}', 'note', '${BOB_NOTE}', 'note'),
      ('${BOB}', '${BOB_NOTE}', 'note', '${NOTE_RELEASE}', 'note');
  `)
})

describe('checklist notes', () => {
  it('are searched by their items, and returned with them', async () => {
    const found = await asAnon<{ title: string; excerpt: string }>('select title, excerpt from public.mcp_search_notes($1, $2, 10)', [alice.token, 'refactoring ui'])
    expect(found.map(r => r.title)).toEqual(['Reading list'])
    expect(found[0].excerpt).toContain('Designing Data-Intensive Applications')
    const note = (await asAnon<{ note_type: string; checklist_items: { text: string; checked: boolean }[] }>('select note_type, checklist_items from public.mcp_get_note($1, $2)', [alice.token, CHECKLIST]))[0]
    expect(note.note_type).toBe('checklist')
    expect(note.checklist_items).toEqual([{ text: 'Designing Data-Intensive Applications', checked: true }, { text: 'Refactoring UI', checked: false }])
  })

  it('do not break searching when the items field is not a list', async () => {
    expect(await asAnon('select * from public.mcp_search_notes($1, $2, 10)', [alice.token, 'odd'])).toHaveLength(1)
    expect(await asAnon('select * from public.mcp_recent_notes($1, 25)', [alice.token])).not.toHaveLength(0)
    const odd = await asAnon<{ id: string }>("select id from public.mcp_search_notes($1, 'odd', 1)", [alice.token])
    expect((await asAnon<{ checklist_items: unknown[] }>('select checklist_items from public.mcp_get_note($1, $2)', [alice.token, odd[0].id]))[0].checklist_items).toEqual([])
  })
})

describe('bookmarks', () => {
  it('finds only the token owner bookmarks, needing every word', async () => {
    const found = await asAnon<{ title: string }>('select title from public.mcp_search_bookmarks($1, $2, 10)', [alice.token, 'postgres'])
    expect(found.map(r => r.title).sort()).toEqual(['Mind the gap', 'Postgres docs'])
    expect(await asAnon('select * from public.mcp_search_bookmarks($1, $2, 10)', [alice.token, 'postgres manual'])).toHaveLength(1)
    expect((await asAnon<{ title: string }>('select title from public.mcp_search_bookmarks($1, $2, 10)', [bob.token, 'postgres'])).map(r => r.title)).toEqual(['Bob postgres'])
    expect(await asAnon('select * from public.mcp_search_bookmarks($1, $2, 10)', [alice.token, '  '])).toHaveLength(0)
  })
})

describe('notebooks and tags', () => {
  it('lists notebooks with their note counts and tag, for the token owner only', async () => {
    const books = await asAnon<{ name: string; note_count: number; tag: string }>('select name, note_count, tag from public.mcp_list_notebooks($1)', [alice.token])
    expect(books.map(b => [b.name.trim(), b.note_count, b.tag])).toEqual([['Work  Stuff', 2, 'nb:work-stuff'], ['Empty', 0, 'nb:empty']])
    expect((await asAnon<{ name: string }>('select name from public.mcp_list_notebooks($1)', [bob.token])).map(b => b.name)).toEqual(['Bob Private'])
  })

  it('lists tags without notebook tags, counted per note, for the token owner only', async () => {
    const tags = await asAnon<{ tag: string; note_count: number }>('select tag, note_count from public.mcp_list_tags($1)', [alice.token])
    expect(tags.find(t => t.tag === 'work')?.note_count).toBe(2)
    expect(tags.some(t => t.tag.startsWith('nb:'))).toBe(false)
    expect((await asAnon<{ tag: string }>('select tag from public.mcp_list_tags($1)', [bob.token])).map(t => t.tag)).toEqual(['meeting'])
  })

  it('finds notes by tag or notebook tag, ignoring case, and never another user notes', async () => {
    expect((await asAnon<{ title: string }>('select title from public.mcp_notes_by_tag($1, $2, 10)', [alice.token, 'WORK'])).map(r => r.title).sort()).toEqual(['Release plan', 'Weekly sync'])
    expect((await asAnon<{ title: string }>('select title from public.mcp_notes_by_tag($1, $2, 10)', [alice.token, 'nb:work-stuff'])).map(r => r.title).sort()).toEqual(['Reading list', 'Stuffed'])
    expect(await asAnon('select * from public.mcp_notes_by_tag($1, $2, 10)', [alice.token, 'meeting'])).toHaveLength(1)
    expect(await asAnon('select * from public.mcp_notes_by_tag($1, $2, 10)', [alice.token, '   '])).toHaveLength(0)
  })
})

describe('links', () => {
  it('shows links in both directions with titles, and leaves out deleted or foreign targets', async () => {
    const links = await asAnon<{ direction: string; kind: string; item_title: string }>('select direction, kind, item_title from public.mcp_get_links($1, $2)', [alice.token, NOTE_RELEASE])
    expect(links.map(l => `${l.direction} ${l.kind} ${l.item_title}`).sort()).toEqual(['from note Reading list', 'to person Aiko Tanaka'])
  })

  it('only ever shows the token owner own links and titles, even for an id that belongs to someone else', async () => {
    // Alice linked her note to Bob's note id. She sees her own link and her own note, never anything of Bob's.
    const alices = await asAnon<{ direction: string; item_title: string }>('select direction, item_title from public.mcp_get_links($1, $2)', [alice.token, BOB_NOTE])
    expect(alices).toEqual([{ direction: 'from', item_title: 'Release plan' }])
    // Bob's link points at Alice's note, which is not his, so its title is never resolved.
    expect(await asAnon('select * from public.mcp_get_links($1, $2)', [bob.token, BOB_NOTE])).toHaveLength(0)
  })
})

describe('access', () => {
  it('refuses every new function without a valid token, and keeps the helper private', async () => {
    const calls: [string, unknown[]][] = [
      ['select * from public.mcp_search_bookmarks($1, $2, 5)', [revoked.token, 'x']],
      ['select * from public.mcp_list_notebooks($1)', [revoked.token]],
      ['select * from public.mcp_list_tags($1)', [revoked.token]],
      ['select * from public.mcp_notes_by_tag($1, $2, 5)', [revoked.token, 'x']],
      ['select * from public.mcp_get_links($1, $2)', [revoked.token, NOTE_RELEASE]],
    ]
    for (const [sql, params] of calls) await expect(asAnon(sql, params)).rejects.toThrow(/invalid_token/)
    await expect(asAnon("select public.mcp_plain('x', null)")).rejects.toThrow(/permission denied/)
  })
})
