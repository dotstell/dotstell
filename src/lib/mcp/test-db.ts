// Test helper: an in-memory Postgres with the real migration (supabase/migrations/012_mcp.sql) applied.
// The tables are cut-down copies of supabase/schema.sql with only the columns the MCP functions read; keep them in
// step when those change.
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

export const ALICE = '00000000-0000-4000-8000-00000000000a'
export const BOB = '00000000-0000-4000-8000-00000000000b'

const migration = readFileSync(new URL('../../../supabase/migrations/012_mcp.sql', import.meta.url), 'utf8')

export async function createTestDatabase(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { pgcrypto } })
  await db.exec(`
    create schema extensions;
    create schema auth;
    create role anon nologin;
    create role authenticated nologin;
    grant usage on schema public to anon, authenticated;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create table public.people (
      id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
      name text not null, role text, company text, email text, tags text[] default '{}', last_interaction timestamptz
    );
    create table public.notes (
      id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
      title text not null default '', content text not null default '', tags text[] default '{}',
      person_id uuid references public.people(id), deleted_at timestamptz,
      created_at timestamptz default now(), updated_at timestamptz default now()
    );
    create table public.tasks (
      id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
      title text not null, description text, status text not null default 'todo', priority text not null default 'medium',
      due_date timestamptz, tags text[] default '{}', person_id uuid references public.people(id), created_at timestamptz default now()
    );
    alter table public.notes enable row level security;
    alter table public.people enable row level security;
    alter table public.tasks enable row level security;
    create policy own_notes on public.notes for all using (auth.uid() = user_id);
    create policy own_people on public.people for all using (auth.uid() = user_id);
    create policy own_tasks on public.tasks for all using (auth.uid() = user_id);
    grant select, insert, update, delete on public.notes, public.people, public.tasks to authenticated;
    insert into auth.users (id) values ('${ALICE}'), ('${BOB}');
  `)
  await db.exec(migration)
  return db
}
