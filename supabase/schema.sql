-- Enable pgvector for future semantic search
create extension if not exists vector;

-- ============================================================
-- NOTES
-- Tags are stored as text[] (e.g. ['nb:my-notebook', 'work']) rather than a
-- join table to keep queries simple at the cost of no FK enforcement on tags.
-- Notebook membership is encoded as 'nb:<slug>' tags — see useNotebooks.ts.
-- ============================================================
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null default '',
  content text not null default '',
  type text not null default 'plain' check (type in ('plain', 'markdown', 'checklist')),
  checklist_items jsonb default '[]',
  tags text[] default '{}',
  person_id uuid,
  -- Sub-notes: a note may nest under another (004)
  parent_id uuid references notes(id) on delete cascade,
  -- Manual ordering and pinning in the notes list (005)
  sort_order integer not null default 0,
  pinned     boolean not null default false,
  -- Optional per-note accent colour (006)
  color varchar(20),
  -- Soft delete: rows stay for the trash view, so nearly every query filters on this
  deleted_at timestamptz default null,
  -- Semantic search vector and the model that produced it (008)
  embedding       vector(768),
  embedding_model text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table notes enable row level security;
-- FOR ALL without WITH CHECK is fine here: Supabase applies USING as implicit WITH CHECK
create policy "Users manage own notes" on notes for all using (auth.uid() = user_id);

-- ============================================================
-- PEOPLE
-- ============================================================
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  role text,
  company text,
  email text,
  phone text,
  avatar_url text,
  tags text[] default '{}',
  last_interaction timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table people enable row level security;
create policy "Users manage own people" on people for all using (auth.uid() = user_id);

-- FK added after both tables exist
alter table notes add constraint notes_person_id_fkey
  foreign key (person_id) references people(id) on delete set null;

-- ============================================================
-- BOOKMARKS
-- ============================================================
create table if not exists bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  url text not null,
  description text,
  favicon_url text,
  tags text[] default '{}',
  -- Metadata scraped when a link is captured (002); the POST route writes both
  reading_time integer,
  hostname     text,
  -- Visit tracking (003)
  last_visited_at timestamptz,
  visit_count     integer default 0,
  -- Semantic search vector and the model that produced it (008)
  embedding       vector(768),
  embedding_model text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- One saved copy of a URL per user (002). Bulk import relies on this to dedup, and the
-- POST route turns the resulting unique_violation into a clear "already saved" message
-- rather than a generic failure.
alter table bookmarks drop constraint if exists bookmarks_user_url_unique;
alter table bookmarks add constraint bookmarks_user_url_unique unique (user_id, url);

alter table bookmarks enable row level security;
create policy "Users manage own bookmarks" on bookmarks for all using (auth.uid() = user_id);

-- ============================================================
-- TASKS
-- ============================================================
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date timestamptz,
  person_id uuid references people(id) on delete set null,
  tags text[] default '{}',
  -- Semantic search vector and the model that produced it (010), so tasks can be
  -- retrieved as context in AI Chat alongside notes and bookmarks
  embedding       vector(768),
  embedding_model text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table tasks enable row level security;
create policy "Users manage own tasks" on tasks for all using (auth.uid() = user_id);

-- ============================================================
-- KNOWLEDGE LINKS
-- source_id / target_id are intentionally untyped UUIDs (no FK) because they
-- can reference any linkable type (note, person, bookmark, task). The app
-- enforces referential integrity; the DB enforces uniqueness and ownership only.
-- ============================================================
create table if not exists knowledge_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  source_id uuid not null,
  source_type text not null check (source_type in ('note', 'person', 'bookmark', 'task')),
  target_id uuid not null,
  target_type text not null check (target_type in ('note', 'person', 'bookmark', 'task')),
  label text,
  created_at timestamptz default now(),
  unique(user_id, source_id, target_id)
);

alter table knowledge_links enable row level security;
create policy "Users manage own links" on knowledge_links for all using (auth.uid() = user_id);

-- ============================================================
-- NOTEBOOKS
-- Notebooks are named containers whose membership is tracked via note tags
-- (e.g. tag 'nb:my-notebook' on a note means it belongs to "My Notebook").
-- sort_order is INTEGER — never write Date.now() here, it overflows INT4.
-- ============================================================
create table if not exists notebooks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  color      text,
  icon       text default '📓',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table notebooks enable row level security;
-- Explicit WITH CHECK ensures INSERT/UPDATE ownership is enforced at policy level,
-- not only via the .eq('user_id') filter in application code.
create policy "Users manage own notebooks" on notebooks
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);
-- Prevents slug collisions: two notebooks with the same name produce the same nb: tag
create unique index if not exists notebooks_user_name_unique on notebooks (user_id, name);
create index if not exists idx_notebooks_user_id on notebooks (user_id, sort_order);

-- ============================================================
-- INDEXES
-- Sub-notes, manual ordering, the trash view, and the pgvector similarity
-- indexes that the match_* functions below rely on to stay fast.
-- ============================================================
create index if not exists notes_parent_id_idx  on notes(parent_id);
create index if not exists notes_sort_order_idx on notes (user_id, pinned desc, sort_order asc);
create index if not exists idx_notes_deleted_at on notes (user_id, deleted_at)
  where deleted_at is not null;

create index if not exists notes_embedding_idx
  on notes using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists bookmarks_embedding_idx
  on bookmarks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists tasks_embedding_idx
  on tasks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ============================================================
-- SEMANTIC SEARCH (pgvector cosine similarity)
-- Called by rpc() from /api/ai/semantic-search, /api/ai/related and
-- /api/ai/graph-links. Without these three, AI search and RAG chat fail at
-- runtime with "function does not exist".
-- search_path is pinned on each (see migration 011): a mutable search_path
-- would let anyone able to create a schema shadow the objects these resolve
-- by name.
-- ============================================================
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

-- ============================================================
-- UPDATED_AT TRIGGER
-- Single shared function; each table gets its own trigger below.
-- Must be defined after all tables it references.
-- ============================================================
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

create trigger notes_updated_at     before update on notes     for each row execute function update_updated_at();
create trigger people_updated_at    before update on people    for each row execute function update_updated_at();
create trigger bookmarks_updated_at before update on bookmarks for each row execute function update_updated_at();
create trigger tasks_updated_at     before update on tasks     for each row execute function update_updated_at();
create trigger notebooks_updated_at before update on notebooks for each row execute function update_updated_at();
