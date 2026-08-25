-- ============================================================
-- AI Match Functions — Postgres functions for pgvector cosine similarity
-- Called by /api/ai/semantic-search via supabase.rpc()
--
-- match_threshold: 0.0–1.0; higher = stricter match
-- match_count: max results to return
-- ============================================================

-- Match notes by vector similarity
create or replace function match_notes(
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

-- Match bookmarks by vector similarity
create or replace function match_bookmarks(
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
