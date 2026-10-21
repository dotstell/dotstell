// From 30 Oct 2026 Supabase no longer grants Data API access to new tables in "public" automatically. This runs the real
// supabase/schema.sql in an in-memory Postgres that grants nothing by default (like a new Supabase project from then on)
// and checks the app's own role can still use every table, and that nothing is open to anonymous visitors.
import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const ALICE = '00000000-0000-4000-8000-00000000000a'
const BOB = '00000000-0000-4000-8000-00000000000b'
const read = (path: string) => readFileSync(new URL(`../../../supabase/${path}`, import.meta.url), 'utf8')

/** Every table the app creates in "public", and a row that is valid for it. */
const TABLES: Record<string, (id: string, owner: string) => string> = {
  notes: (id, owner) => `insert into public.notes (id, user_id, title) values ('${id}', '${owner}', 't')`,
  people: (id, owner) => `insert into public.people (id, user_id, name) values ('${id}', '${owner}', 'p')`,
  bookmarks: (id, owner) => `insert into public.bookmarks (id, user_id, title, url) values ('${id}', '${owner}', 't', 'https://example.com')`,
  tasks: (id, owner) => `insert into public.tasks (id, user_id, title) values ('${id}', '${owner}', 't')`,
  notebooks: (id, owner) => `insert into public.notebooks (id, user_id, name) values ('${id}', '${owner}', 'n')`,
  knowledge_links: (id, owner) =>
    `insert into public.knowledge_links (id, user_id, source_id, source_type, target_id, target_type) values ('${id}', '${owner}', '${id}', 'note', '${id}', 'note')`,
}

let db: PGlite

async function as<T = Record<string, unknown>>(role: 'anon' | 'authenticated', userId: string | null, sql: string): Promise<T[]> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId ?? ''}', false); set role ${role}`)
  try { return (await db.query<T>(sql)).rows } finally { await db.exec('reset role') }
}

/**
 * This in-memory Postgres has no pgvector. The vector column type becomes an array of floats and a stand-in operator
 * replaces cosine distance, so every table, policy and function in schema.sql is still created; only the similarity
 * maths is not exercised here.
 */
function withoutPgvector(sql: string): string {
  return sql
    .replace('create extension if not exists vector;', 'create operator <=> (leftarg = float8[], rightarg = float8[], function = public.stub_distance);')
    .replace(/vector\(768\)/g, 'float8[]')
    .replace(/create index[^;]*ivfflat[^;]*;/gi, '')
}

async function fresh(extraSql = ''): Promise<PGlite> {
  const d = await PGlite.create({ extensions: { pgcrypto } })
  await d.exec(`
    create function public.stub_distance(a float8[], b float8[]) returns float8 language sql immutable as 'select 0.0::float8';
    create schema if not exists extensions;
    create schema auth;
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    grant usage on schema public, extensions to anon, authenticated, service_role;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    insert into auth.users (id) values ('${ALICE}'), ('${BOB}');
  `)
  await d.exec(withoutPgvector(read('schema.sql')))
  if (extraSql) await d.exec(extraSql)
  return d
}

beforeAll(async () => { db = await fresh() }, 120_000)

describe('a fresh install under the new Supabase default (no automatic grants)', () => {
  for (const [table, insert] of Object.entries(TABLES)) {
    it(`${table}: the signed-in user can add, read, change and delete their own rows`, async () => {
      const id = crypto.randomUUID()
      await as('authenticated', ALICE, insert(id, ALICE))
      expect(await as('authenticated', ALICE, `select id from public.${table} where id = '${id}'`)).toHaveLength(1)
      await as('authenticated', ALICE, `update public.${table} set user_id = user_id where id = '${id}'`)
      await as('authenticated', ALICE, `delete from public.${table} where id = '${id}'`)
      expect(await as('authenticated', ALICE, `select id from public.${table} where id = '${id}'`)).toHaveLength(0)
    })

    it(`${table}: another user cannot see them, and a visitor with no account is refused`, async () => {
      const id = crypto.randomUUID()
      await as('authenticated', ALICE, insert(id, ALICE))
      expect(await as('authenticated', BOB, `select id from public.${table} where id = '${id}'`)).toHaveLength(0)
      await expect(as('anon', null, `select id from public.${table}`)).rejects.toThrow(/permission denied/)
    })
  }

  it('the service role can read every table (Supabase tooling and a self-hoster\'s own scripts)', async () => {
    for (const table of Object.keys(TABLES)) {
      await db.exec('set role service_role')
      try { await db.query(`select 1 from public.${table} limit 1`) } finally { await db.exec('reset role') }
    }
  })

  it('the AI search functions can be called by the signed-in user', async () => {
    for (const fn of ['match_notes', 'match_bookmarks', 'match_tasks']) {
      await as('authenticated', ALICE, `select * from public.${fn}('{0}'::float8[], '${ALICE}'::uuid, 3, 0.1)`)
    }
  })

  it('MCP tokens still work end to end', async () => {
    await as('authenticated', ALICE, `insert into public.mcp_tokens (user_id, name, token_hash, prefix, expires_at) values ('${ALICE}', 'x', '${'a'.repeat(64)}', 'dst_abcd', now() + interval '1 day')`)
    expect(await as('authenticated', ALICE, 'select name from public.mcp_tokens')).toHaveLength(1)
    expect(await as('authenticated', BOB, 'select name from public.mcp_tokens')).toHaveLength(0)
  })
})

describe('migration 013 on its own', () => {
  const tables = Object.keys(TABLES).map(t => `public.${t}`).join(', ')

  it('gives a project that has no grants the access it needs, and can be run again', async () => {
    const d = await fresh(`revoke all on ${tables} from authenticated, service_role;`)
    const id = crypto.randomUUID()
    await d.exec(`select set_config('request.jwt.claim.sub', '${ALICE}', false); set role authenticated`)
    await expect(d.exec(TABLES.notes(id, ALICE))).rejects.toThrow(/permission denied/)
    await d.exec('reset role')

    const migration = read('migrations/013_data_api_grants.sql')
    await d.exec(migration)
    await d.exec(migration)

    await d.exec(`select set_config('request.jwt.claim.sub', '${ALICE}', false); set role authenticated`)
    await d.exec(TABLES.notes(id, ALICE))
    expect((await d.query(`select id from public.notes where id = '${id}'`)).rows).toHaveLength(1)
    await d.exec('reset role')
  }, 120_000)

  it('does not widen access: anonymous visitors still get nothing', async () => {
    await db.exec('set role anon')
    try { await expect(db.query('select 1 from public.notes')).rejects.toThrow(/permission denied/) } finally { await db.exec('reset role') }
  })
})

describe('every table is granted where it is created', () => {
  const sql = (file: string) => read(file).toLowerCase()
  const created = (text: string) => [...text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/g)].map(m => m[1])
  const granted = (text: string, table: string) =>
    new RegExp(`grant\\s+[^;]*\\bon\\s+(?:table\\s+)?(?:[a-z0-9_.,\\s]*,\\s*)?(?:public\\.)?${table}\\b[^;]*\\bto\\s+[^;]*authenticated`).test(text)

  it('the check itself notices a table with no grant', () => {
    const text = 'create table if not exists public.things (id uuid); grant select on public.other to authenticated;'
    expect(created(text).filter(t => !granted(text, t))).toEqual(['things'])
    expect(created(text + ' grant select on public.things to authenticated;').filter(t => !granted(text + ' grant select on public.things to authenticated;', t))).toEqual([])
  })

  it('schema.sql grants every table to the signed-in role', () => {
    const text = sql('schema.sql')
    const missing = created(text).filter(t => !granted(text, t))
    expect(missing).toEqual([])
  })

  // Migrations 012 onward must carry their own grants, because a project that applies them after the change gets none.
  const migrations = readdirSync(new URL('../../../supabase/migrations/', import.meta.url))
    .filter(f => f.endsWith('.sql') && Number(f.slice(0, 3)) >= 12)
  for (const file of migrations) {
    it(`migration ${file} grants the tables it creates`, () => {
      const text = sql(`migrations/${file}`)
      expect(created(text).filter(t => !granted(text, t))).toEqual([])
    })
  }
})
