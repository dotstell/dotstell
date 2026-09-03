-- Fix: lock search_path on all functions to prevent schema injection.
-- Supabase Security Advisor flags functions with a mutable search_path because
-- an attacker who can create schemas could shadow objects the function resolves
-- by name. Setting search_path = public ensures every name resolves in the
-- correct schema regardless of the caller's session search_path.
-- No functional changes — signatures and bodies are identical.

-- 1. update_updated_at (trigger)
create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. match_notes
create or replace function public.match_notes(
  query_embedding  vector(768),
  user_id_param    uuid,
  match_count      int     default 10,
  match_threshold  float   default 0.3
)
returns table (
  id         uuid,
  title      text,
  content    text,
  similarity float
)
language sql stable
set search_path = public
as $$
  select
    id,
    title,
    content,
    1 - (embedding <=> query_embedding) as similarity
  from notes
  where
    user_id    = user_id_param
    and deleted_at is null
    and embedding is not null
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- 3. match_bookmarks
create or replace function public.match_bookmarks(
  query_embedding  vector(768),
  user_id_param    uuid,
  match_count      int     default 10,
  match_threshold  float   default 0.3
)
returns table (
  id          uuid,
  title       text,
  description text,
  url         text,
  similarity  float
)
language sql stable
set search_path = public
as $$
  select
    id,
    title,
    description,
    url,
    1 - (embedding <=> query_embedding) as similarity
  from bookmarks
  where
    user_id   = user_id_param
    and embedding is not null
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- 4. match_tasks
create or replace function public.match_tasks(
  query_embedding  vector(768),
  user_id_param    uuid,
  match_count      int   default 10,
  match_threshold  float default 0.3
)
returns table (
  id          uuid,
  title       text,
  description text,
  status      text,
  priority    text,
  due_date    timestamptz,
  tags        text[],
  similarity  float
)
language sql stable
set search_path = public
as $$
  select
    id,
    title,
    description,
    status,
    priority,
    due_date,
    tags,
    1 - (embedding <=> query_embedding) as similarity
  from tasks
  where user_id = user_id_param
    and embedding is not null
    and 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;
