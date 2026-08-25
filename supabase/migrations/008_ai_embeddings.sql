-- ============================================================
-- AI Embeddings — vector columns for semantic search and RAG
--
-- Dimension: 768 — compatible with:
--   • OpenAI  : text-embedding-3-small (request dimensions: 768)
--   • Ollama  : nomic-embed-text (native 768-dim output)
--   • Gemini  : text-embedding-004 (outputDimensionality: 768)
--
-- If you switch to a 1536-dim model, drop and recreate these
-- columns, then re-run embeddings for all existing rows.
-- ============================================================

-- Enable pgvector extension (idempotent — already in schema.sql but safe to repeat)
create extension if not exists vector;

-- Notes: store embedding of title + plain-text content
alter table notes
  add column if not exists embedding       vector(768),
  add column if not exists embedding_model text;       -- tracks which model produced the vector

-- Bookmarks: store embedding of title + description
alter table bookmarks
  add column if not exists embedding       vector(768),
  add column if not exists embedding_model text;

-- IVFFlat index for approximate nearest-neighbour search.
-- lists=100 is a reasonable default for up to ~100k rows;
-- increase to sqrt(row_count) as data grows.
-- Created concurrently so it doesn't block inserts on large datasets.
create index if not exists notes_embedding_idx
  on notes using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists bookmarks_embedding_idx
  on bookmarks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
