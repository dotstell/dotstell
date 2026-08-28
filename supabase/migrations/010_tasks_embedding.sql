-- 010_tasks_embedding.sql
-- Adds vector embedding support to the tasks table, enabling tasks to appear
-- in semantic search results, AI Chat RAG context, and future cross-entity search.

alter table tasks
  add column if not exists embedding       vector(768),
  add column if not exists embedding_model text;

-- IVFFlat index for fast approximate cosine similarity search
create index if not exists tasks_embedding_idx
  on tasks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Semantic match function — same signature pattern as match_notes / match_bookmarks
create or replace function match_tasks(
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
language sql stable as $$
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
