-- ============================================================
-- MCP access (v0.9.0): read-only tokens and the functions behind /api/mcp.
-- Design and threat model: docs/MCP.md
--
-- There is deliberately no service-role key anywhere in this feature. An AI tool presents a token, not a session,
-- so the endpoint calls the security-definer functions below with the public anon key. Each function resolves the
-- user from the token inside the database and returns only that user's rows; none accepts a user id.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------
-- Tokens. Only a SHA-256 hash is stored; the token itself has 256 bits of randomness and is shown once.
-- ------------------------------------------------------------
create table if not exists public.mcp_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  prefix       text not null check (char_length(prefix) between 4 and 16),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  last_used_at timestamptz,
  use_count    bigint not null default 0,
  created_at   timestamptz not null default now(),
  check (expires_at > created_at and expires_at <= created_at + interval '366 days')
);

create index if not exists mcp_tokens_user_idx on public.mcp_tokens (user_id, created_at desc);

alter table public.mcp_tokens enable row level security;
drop policy if exists "Users read own mcp tokens" on public.mcp_tokens;
create policy "Users read own mcp tokens"   on public.mcp_tokens for select using (auth.uid() = user_id);
drop policy if exists "Users create own mcp tokens" on public.mcp_tokens;
create policy "Users create own mcp tokens" on public.mcp_tokens for insert with check (auth.uid() = user_id);
drop policy if exists "Users revoke own mcp tokens" on public.mcp_tokens;
create policy "Users revoke own mcp tokens" on public.mcp_tokens for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete own mcp tokens" on public.mcp_tokens;
create policy "Users delete own mcp tokens" on public.mcp_tokens for delete using (auth.uid() = user_id);

-- Row policies alone would let a user edit expiry or counters; limit the columns they can change.
revoke all on public.mcp_tokens from anon, authenticated;
grant select on public.mcp_tokens to authenticated;
grant insert (user_id, name, token_hash, prefix, expires_at) on public.mcp_tokens to authenticated;
grant update (revoked_at) on public.mcp_tokens to authenticated;
grant delete on public.mcp_tokens to authenticated;

-- ------------------------------------------------------------
-- Activity: which tool a token called and when. Never the note contents. Kept for 30 days.
-- ------------------------------------------------------------
create table if not exists public.mcp_token_events (
  id       bigint generated always as identity primary key,
  token_id uuid not null references public.mcp_tokens(id) on delete cascade,
  tool     text not null check (char_length(tool) <= 40),
  at       timestamptz not null default now()
);

create index if not exists mcp_token_events_token_idx on public.mcp_token_events (token_id, at desc);
create index if not exists mcp_token_events_at_idx    on public.mcp_token_events (at);

alter table public.mcp_token_events enable row level security;
drop policy if exists "Users read events of own mcp tokens" on public.mcp_token_events;
create policy "Users read events of own mcp tokens" on public.mcp_token_events for select
  using (exists (select 1 from public.mcp_tokens t where t.id = token_id and t.user_id = auth.uid()));

revoke all on public.mcp_token_events from anon, authenticated;
grant select on public.mcp_token_events to authenticated;

-- ------------------------------------------------------------
-- Token check, shared by every function. Not callable from outside.
-- ------------------------------------------------------------
create or replace function public.mcp_resolve(p_token text, p_tool text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id   uuid;
  v_user uuid;
begin
  if p_token is null or char_length(p_token) not between 20 and 200 then
    raise exception 'invalid_token' using errcode = '28000';
  end if;

  select t.id, t.user_id into v_id, v_user
  from public.mcp_tokens t
  where t.token_hash = encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex')
    and t.revoked_at is null
    and t.expires_at > now();

  if v_id is null then
    raise exception 'invalid_token' using errcode = '28000';
  end if;

  update public.mcp_tokens set last_used_at = now(), use_count = use_count + 1 where id = v_id;
  insert into public.mcp_token_events (token_id, tool) values (v_id, left(coalesce(p_tool, 'unknown'), 40));
  if random() < 0.02 then
    delete from public.mcp_token_events where at < now() - interval '30 days';
  end if;

  return v_user;
end;
$$;

revoke all on function public.mcp_resolve(text, text) from public, anon, authenticated;

-- Validates a token without counting it as use (connection handshakes, tool listing).
create or replace function public.mcp_check_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token is null or char_length(p_token) not between 20 and 200 then
    raise exception 'invalid_token' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.mcp_tokens t
    where t.token_hash = encode(extensions.digest(convert_to(p_token, 'UTF8'), 'sha256'), 'hex')
      and t.revoked_at is null and t.expires_at > now()
  ) then
    raise exception 'invalid_token' using errcode = '28000';
  end if;
  return true;
end;
$$;

-- ------------------------------------------------------------
-- Read-only tools. Limits are capped here as well as in the route.
-- ------------------------------------------------------------

-- Notes containing every word of the query (title or text, markup ignored). Title matches first.
create or replace function public.mcp_search_notes(p_token text, p_query text, p_limit int default 10)
returns table (id uuid, title text, excerpt text, tags text[], updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
set statement_timeout = '5s'
as $$
declare
  v_user  uuid := public.mcp_resolve(p_token, 'search_notes');
  v_limit int  := least(greatest(coalesce(p_limit, 10), 1), 25);
  v_terms text[];
begin
  select coalesce(array_agg(s.term), '{}') into v_terms
  from (
    select x as term from unnest(string_to_array(left(coalesce(p_query, ''), 200), ' ')) as x where x <> '' limit 8
  ) s;

  if cardinality(v_terms) = 0 then
    return;
  end if;

  return query
  select n.id, n.title, left(b.plain, 240), n.tags, n.updated_at
  from public.notes n
  cross join lateral (
    select btrim(regexp_replace(regexp_replace(left(n.content, 500000), '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g')) as plain
  ) b
  where n.user_id = v_user
    and n.deleted_at is null
    and not exists (
      select 1 from unnest(v_terms) as q(term)
      where (n.title || ' ' || b.plain) not ilike '%' || replace(replace(replace(q.term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    )
  order by
    not exists (
      select 1 from unnest(v_terms) as q(term)
      where n.title not ilike '%' || replace(replace(replace(q.term, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    ) desc,
    n.updated_at desc
  limit v_limit;
end;
$$;

create or replace function public.mcp_get_note(p_token text, p_id uuid)
returns table (id uuid, title text, content text, tags text[], created_at timestamptz, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.mcp_resolve(p_token, 'get_note');
begin
  return query
  select n.id, n.title, left(n.content, 200000), n.tags, n.created_at, n.updated_at
  from public.notes n
  where n.id = p_id and n.user_id = v_user and n.deleted_at is null;
end;
$$;

create or replace function public.mcp_recent_notes(p_token text, p_limit int default 10)
returns table (id uuid, title text, excerpt text, tags text[], updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := public.mcp_resolve(p_token, 'recent_notes');
  v_limit int  := least(greatest(coalesce(p_limit, 10), 1), 25);
begin
  return query
  select n.id, n.title,
         left(btrim(regexp_replace(regexp_replace(left(n.content, 5000), '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g')), 240),
         n.tags, n.updated_at
  from public.notes n
  where n.user_id = v_user and n.deleted_at is null
  order by n.updated_at desc
  limit v_limit;
end;
$$;

create or replace function public.mcp_list_tasks(
  p_token text, p_status text default null, p_due_before timestamptz default null, p_limit int default 20
)
returns table (
  id uuid, title text, description text, status text, priority text,
  due_date timestamptz, tags text[], person_name text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := public.mcp_resolve(p_token, 'list_tasks');
  v_limit int  := least(greatest(coalesce(p_limit, 20), 1), 50);
begin
  if p_status is not null and p_status not in ('todo', 'in_progress', 'done') then
    raise exception 'invalid_status' using errcode = '22023';
  end if;

  return query
  select t.id, t.title, left(t.description, 500), t.status, t.priority, t.due_date, t.tags, p.name
  from public.tasks t
  left join public.people p on p.id = t.person_id and p.user_id = v_user
  where t.user_id = v_user
    and (p_status is null or t.status = p_status)
    and (p_due_before is null or (t.due_date is not null and t.due_date <= p_due_before))
  order by (t.status = 'done'), t.due_date nulls last, t.created_at desc
  limit v_limit;
end;
$$;

-- Notes tagged "meeting", which the meeting assistant adds when it inserts a summary.
create or replace function public.mcp_list_meetings(p_token text, p_limit int default 10)
returns table (id uuid, title text, excerpt text, tags text[], updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := public.mcp_resolve(p_token, 'list_meetings');
  v_limit int  := least(greatest(coalesce(p_limit, 10), 1), 25);
begin
  return query
  select n.id, n.title,
         left(btrim(regexp_replace(regexp_replace(left(n.content, 20000), '<[^>]*>', ' ', 'g'), '\s+', ' ', 'g')), 600),
         n.tags, n.updated_at
  from public.notes n
  where n.user_id = v_user and n.deleted_at is null and 'meeting' = any (n.tags)
  order by n.updated_at desc
  limit v_limit;
end;
$$;

create or replace function public.mcp_list_people(p_token text, p_query text default null, p_limit int default 20)
returns table (id uuid, name text, role text, company text, email text, tags text[], last_interaction timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user    uuid := public.mcp_resolve(p_token, 'list_people');
  v_limit   int  := least(greatest(coalesce(p_limit, 20), 1), 50);
  v_pattern text := '%' || replace(replace(replace(left(coalesce(p_query, ''), 100), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  return query
  select p.id, p.name, p.role, p.company, p.email, p.tags, p.last_interaction
  from public.people p
  where p.user_id = v_user
    and (coalesce(p_query, '') = '' or p.name ilike v_pattern or coalesce(p.company, '') ilike v_pattern or coalesce(p.role, '') ilike v_pattern)
  order by p.last_interaction desc nulls last, p.name
  limit v_limit;
end;
$$;

-- One person with the notes and open tasks linked to them.
create or replace function public.mcp_get_person(p_token text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := public.mcp_resolve(p_token, 'get_person');
begin
  return (
    select jsonb_build_object(
      'id', p.id, 'name', p.name, 'role', p.role, 'company', p.company, 'email', p.email, 'tags', p.tags,
      'notes', coalesce((
        select jsonb_agg(jsonb_build_object('id', x.id, 'title', x.title, 'updated_at', x.updated_at))
        from (
          select n.id, n.title, n.updated_at from public.notes n
          where n.person_id = p.id and n.user_id = v_user and n.deleted_at is null
          order by n.updated_at desc limit 25
        ) x
      ), '[]'::jsonb),
      'tasks', coalesce((
        select jsonb_agg(jsonb_build_object('id', y.id, 'title', y.title, 'status', y.status, 'due_date', y.due_date))
        from (
          select t.id, t.title, t.status, t.due_date from public.tasks t
          where t.person_id = p.id and t.user_id = v_user and t.status <> 'done'
          order by t.due_date nulls last limit 25
        ) y
      ), '[]'::jsonb)
    )
    from public.people p
    where p.id = p_id and p.user_id = v_user
  );
end;
$$;

-- The endpoint uses the public anon key; execution is the only thing granted.
revoke all on function public.mcp_check_token(text)                                          from public;
revoke all on function public.mcp_search_notes(text, text, int)                              from public;
revoke all on function public.mcp_get_note(text, uuid)                                       from public;
revoke all on function public.mcp_recent_notes(text, int)                                    from public;
revoke all on function public.mcp_list_tasks(text, text, timestamptz, int)                   from public;
revoke all on function public.mcp_list_meetings(text, int)                                   from public;
revoke all on function public.mcp_list_people(text, text, int)                               from public;
revoke all on function public.mcp_get_person(text, uuid)                                     from public;

grant execute on function public.mcp_check_token(text)                                       to anon, authenticated;
grant execute on function public.mcp_search_notes(text, text, int)                           to anon, authenticated;
grant execute on function public.mcp_get_note(text, uuid)                                    to anon, authenticated;
grant execute on function public.mcp_recent_notes(text, int)                                 to anon, authenticated;
grant execute on function public.mcp_list_tasks(text, text, timestamptz, int)                to anon, authenticated;
grant execute on function public.mcp_list_meetings(text, int)                                to anon, authenticated;
grant execute on function public.mcp_list_people(text, text, int)                            to anon, authenticated;
grant execute on function public.mcp_get_person(text, uuid)                                  to anon, authenticated;
