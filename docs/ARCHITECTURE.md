# Dotstell — Architecture

This document explains how Dotstell is built: the layers, the languages, the data model, and the non-obvious design decisions that aren't obvious from reading the code alone. It is intended for contributors, security reviewers, and anyone evaluating self-hosting.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Languages & Stack](#languages--stack)
3. [Application Layers](#application-layers)
4. [Data Model](#data-model)
5. [Security Model](#security-model)
6. [Key Systems](#key-systems)
   - [Wikilinks & Backlinks](#wikilinks--backlinks)
   - [Knowledge Graph](#knowledge-graph)
   - [Notebook System](#notebook-system)
   - [Theme System](#theme-system)
   - [Task Reminders](#task-reminders)
7. [AI Layer](#ai-layer)
   - [Provider Architecture](#provider-architecture)
   - [Request Routing — Server vs. Browser](#request-routing--server-vs-browser)
   - [Local AI Agent](#local-ai-agent)
   - [Embedding Pipeline](#embedding-pipeline)
   - [AI Security Model](#ai-security-model)
8. [Request Lifecycle](#request-lifecycle)
9. [Desktop vs Web](#desktop-vs-web)
10. [Database Migrations](#database-migrations)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                         │
│                                                             │
│   Browser (dotstell.app)        Desktop (Tauri WebView)     │
│   Next.js · React 19            Tauri v2 · Rust shell       │
│   TypeScript · Tailwind v4      loads dotstell.app via WKWebView / WebView2
└────────────────────┬────────────────────────────────────────┘
                     │  HTTPS  (Supabase JWT in Authorization header)
┌────────────────────▼────────────────────────────────────────┐
│                       API Layer                             │
│                                                             │
│   Next.js App Router API Routes  (TypeScript)               │
│   /api/notes  /api/people  /api/tasks  /api/bookmarks       │
│   /api/links  /api/notebooks  /api/search  /api/fetch-meta  │
└────────────────────┬────────────────────────────────────────┘
                     │  Supabase client  (service role / anon)
┌────────────────────▼────────────────────────────────────────┐
│                     Data Layer                              │
│                                                             │
│   Supabase (PostgreSQL 15 + pgvector extension)             │
│   Row Level Security enforced at DB level                   │
│   Tables: notes · people · bookmarks · tasks                │
│           knowledge_links · notebooks                       │
└─────────────────────────────────────────────────────────────┘
```

The desktop app is a **thin native shell** — it opens a WebView pointed at `dotstell.app` and never talks to the database directly. All data access flows through the same Next.js API routes as the web app.

---

## Languages & Stack

| Language | Role |
|---|---|
| **TypeScript** | Web frontend, API routes, hooks, components — everything in `src/` |
| **Rust** | Tauri v2 desktop shell (`src-tauri/src/lib.rs`) |
| **SQL** | PostgreSQL schema, RLS policies, migrations (`supabase/`) |
| **CSS** | Tailwind v4 utility classes throughout components |

### Full dependency map

| Concern | Technology | Version |
|---|---|---|
| Web framework | Next.js (App Router) | 16 |
| UI library | React | 19 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS | v4 |
| Rich text editor | Tiptap | v3 |
| Graph visualisation | React Flow | v11 |
| State management | Zustand + TanStack Query | 5 |
| Database | Supabase (PostgreSQL 15) | — |
| Auth | Supabase Auth (JWT) | — |
| Desktop shell | Tauri | v2 |
| Drag and drop | dnd-kit | 6 / 10 |
| Icons | Lucide React | 1 |
| Toasts | Sonner | 2 |
| Date utilities | date-fns | 4 |

---

## Application Layers

### `src/app/` — Pages & API Routes

Next.js App Router. Every folder is a route segment.

```
src/app/
├── api/                              # REST API (server-side)
│   ├── notes/                        # Notes list + create
│   ├── notes/[id]/                   # Note CRUD (soft delete via deleted_at)
│   ├── notes/[id]/backlinks/         # Inbound wikilinks for a note
│   ├── notes/[id]/wikilinks/         # Sync wikilink edges on save
│   ├── notes/[id]/unlinked-mentions/ # Detect [[Title]] with no matching note
│   ├── notes/[id]/restore/           # Restore soft-deleted note
│   ├── notes/[id]/permanent/         # Hard delete (bypasses soft delete)
│   ├── notes/trash/                  # List soft-deleted notes
│   ├── notebooks/                    # Notebooks list + create
│   ├── notebooks/[id]/               # Notebook rename / delete
│   ├── people/                       # People list + create
│   ├── people/[id]/                  # Person CRUD
│   ├── bookmarks/                    # Bookmarks list + create
│   ├── bookmarks/[id]/               # Bookmark patch / delete
│   ├── bookmarks/bulk-import/        # Netscape HTML file parser + batch insert
│   ├── bookmarks/bulk-delete/        # Delete multiple bookmarks at once
│   ├── bookmarks/preview-import/     # Parse Netscape file, return preview without saving
│   ├── bookmarks/manage-tags/        # Rename / delete a tag across all bookmarks
│   ├── bookmarks/fetch-meta/         # SSRF-protected URL metadata fetch
│   ├── bookmarks/visit/              # Record visit, update last_visited_at
│   ├── tasks/                        # Tasks list + create
│   ├── tasks/[id]/                   # Task CRUD
│   ├── links/                        # Knowledge links (manual + wikilink edges)
│   ├── wikilinks/                    # Wikilink title → id resolution
│   ├── graph/                        # All graph nodes + edges in one response
│   └── search/                       # Full-text search across all entity types
├── auth/                             # Login, register, OAuth callback
├── dashboard/                        # Home: overdue tasks, recent notes
├── notes/                            # Notes list
├── notes/[id]/                       # Note editor (full page)
├── people/                           # People list
├── people/[id]/                      # Person detail + attached notes/tasks
├── bookmarks/                        # Bookmarks + collections
├── tasks/                            # Kanban board + list view
├── graph/                            # Interactive knowledge graph (React Flow)
├── tags/                             # Tag browser across all entity types
├── search/                           # Global search results
└── help/                             # Help & keyboard shortcuts
```

### `src/components/` — UI Components

```
src/components/
├── editor/       # Tiptap rich text editor + WikiLinkExtension (custom ProseMirror node)
├── layout/       # Sidebar, AppLayout, PageHeader
├── command/      # Ctrl+K command palette
├── links/        # LinkPanel — manual entity-to-entity connection UI
├── graph/        # Graph canvas, node renderers, edge renderers
├── notes/        # NoteCard, NotesSidePane (notebooks UI), BacklinksPanel
├── bookmarks/    # BookmarkCard, BookmarkImport, TagFilter
├── people/       # PersonCard, PersonDetail
├── tasks/        # TaskCard, KanbanBoard, TaskList
├── onboarding/   # First-run onboarding flow
├── brand/        # Logo and brand assets
└── ui/           # Design system: ThemePicker, buttons, dialogs, inputs
```

### `src/hooks/` — Data & Behaviour Hooks

| Hook | Purpose |
|---|---|
| `useNotebooks` | Notebooks state, Supabase sync, one-time localStorage migration |
| `useNoteTabs` | Multi-tab note editor state, persisted to localStorage |
| `useMention` | `@mention` detection and person suggestion dropdown |
| `useTheme` | Theme selection, cookie sync for SSR flash prevention |
| `useTaskReminders` | Browser Notification API, fires once per session |
| `useDebounce` | Generic debounce for search inputs |

### `src/store/` — Global State

Zustand stores for cross-component state that doesn't belong in a single hook.

### `src/lib/` — Utilities

```
src/lib/
├── supabase/
│   ├── client.ts    # Browser-side Supabase client (anon key)
│   └── server.ts    # Server-side client (uses cookies for session)
├── tiptap/
│   └── WikiLinkExtension.ts   # Custom Tiptap node: [[Page Title]] syntax
└── ratelimit.ts               # Simple in-memory rate limiter for API routes
```

---

## Data Model

### Entity Relationship Overview

```
auth.users (Supabase managed)
    │
    ├── notes ──────────────────── people (person_id FK, nullable)
    │     │  tags: text[]          │
    │     │  (includes nb: tags)   ├── tasks (person_id FK, nullable)
    │     │                        │
    ├── bookmarks                  └── (standalone: no further FKs)
    │     │  tags: text[]
    │
    ├── tasks
    │     │  tags: text[]
    │
    ├── notebooks
    │     │  (membership tracked via nb: tags on notes — no FK)
    │
    └── knowledge_links
          source_id (uuid, untyped — can ref any entity)
          target_id (uuid, untyped — can ref any entity)
```

### Design Decisions

#### Tags as `text[]` instead of a join table

Notes, bookmarks, and tasks all store tags as a PostgreSQL `text[]` column. This keeps queries simple (no join needed to filter by tag) and allows a tag to be any arbitrary string — including the `nb:` prefix used for notebook membership.

The trade-off: no FK enforcement on tag values. A renamed notebook does not retroactively update `nb:` tags on existing notes (see [Notebook System](#notebook-system)).

#### Knowledge links use untyped UUIDs

`knowledge_links.source_id` and `target_id` are plain `uuid` columns with no foreign key constraint. This is intentional: a link can connect any two entities regardless of type (note → person, bookmark → task, etc.). The `source_type` and `target_type` columns record what each UUID refers to. Referential integrity is enforced by the application on write; the DB enforces uniqueness and ownership only.

The `label` column is used for wikilink backlinks. When the editor writes a `[[Page Title]]` link, it upserts a knowledge link with `label = '__wikilink__'` so it can be distinguished from manually-created links when rendering the backlinks panel.

#### Soft delete on notes

Notes are not hard-deleted. `DELETE /api/notes/[id]` sets `deleted_at = now()`. A future trash/recovery UI can list notes where `deleted_at IS NOT NULL`. All list queries filter `deleted_at IS NULL`.

#### `sort_order` is `INTEGER`, never `Date.now()`

`notebooks.sort_order` is a PostgreSQL `INTEGER` (max ~2.1 billion). `Date.now()` in 2026 returns ~1.78 trillion — exceeding `INT4` max. Always pass a small sequential index (e.g. `notebooks.length`) rather than a timestamp to this column.

---

## Security Model

### Authentication

Dotstell uses **Supabase Auth** — JWT-based, issued by Supabase on login. The token is stored in a cookie (via `@supabase/ssr`) and sent with every API request. API routes call `supabase.auth.getUser()` server-side to verify the token before any data access.

```
User → POST /auth/signin → Supabase Auth
                         ← JWT cookie
User → GET /api/notes   (cookie sent automatically)
     → supabase.auth.getUser() verifies JWT
     ← notes belonging to user only
```

### Row Level Security

Every table has RLS enabled. The default policy is:

```sql
CREATE POLICY "Users manage own X" ON x
  FOR ALL
  USING      (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

`USING` filters rows on `SELECT`, `UPDATE`, `DELETE`. `WITH CHECK` enforces ownership on `INSERT` and `UPDATE`. Both are needed: `USING`-only policies apply `USING` as the implicit `WITH CHECK`, which works for most cases, but `WITH CHECK` is explicit for the notebooks table where the distinction matters.

### Defense-in-depth: `.eq('user_id')` alongside RLS

API routes always include `.eq('user_id', user.id)` even though RLS would enforce this anyway. This:

1. Makes the intent explicit in the code — a reviewer can audit data access without knowing the RLS policy.
2. Protects against a future misconfiguration where RLS is accidentally disabled on a table.
3. Prevents cross-user data leaks if the Supabase service key is used server-side (which bypasses RLS).

### Input Validation

API routes validate inputs before reaching the database:

| Check | Why |
|---|---|
| Allowlist of updatable fields (PATCH) | Prevents arbitrary column writes (e.g. `user_id` override) |
| `VALID_STATUS` / `VALID_PRIORITY` arrays | DB has `CHECK` constraints too, but API validation returns a clean 400 |
| Color: `/^#[0-9a-f]{6}$/i` | Rejects shorthand, named colors, rgb() — only 6-digit hex allowed |
| UUID: `/^[0-9a-f]{8}-...-12$/i` | Strict 8-4-4-4-12 format; loose regex allowed malformed IDs to reach Postgres |
| ilike escape: `%` → `\%`, `_` → `\_` | Prevents wildcard injection in bookmark search |

### SSRF Protection (`/api/bookmarks/fetch-meta`)

The bookmark metadata fetcher pre-resolves DNS and blocks requests to RFC-1918 addresses (10.x, 172.16.x, 192.168.x, 127.x) to prevent server-side requests reaching internal services.

### Rate Limiting

`src/lib/ratelimit.ts` provides a lightweight in-memory rate limiter. Key routes are limited:

| Route | Limit |
|---|---|
| `POST /api/bookmarks` | 60 / min |
| `POST /api/bookmarks/bulk-import` | 5 / min |
| `PATCH /api/notes/[id]` | 120 / min |
| `POST /api/tasks` | 60 / min |

---

## Key Systems

### Wikilinks & Backlinks

The Tiptap editor has a custom `WikiLinkExtension` (in `src/lib/tiptap/WikiLinkExtension.ts`) that recognises `[[Page Title]]` syntax as a ProseMirror inline node.

**Write path:**
1. User types `[[` — the extension shows an autocomplete dropdown of existing note titles.
2. On selection, a `wikilink` node is inserted with `attrs: { title, id }`.
3. On every note save, the editor serialises wikilink nodes and calls `POST /api/links` for each one, upserting a `knowledge_links` row with `label = '__wikilink__'`.

**Read path (backlinks):**
1. When viewing note X, the BacklinksPanel calls `GET /api/links?target_id=X`.
2. The API returns all `knowledge_links` rows where `target_id = X` and `label = '__wikilink__'`.
3. The panel fetches note titles for the returned `source_id` values and renders the list.

**Why upsert on `(user_id, source_id, target_id)`:**
A note with 5 `[[links]]` to the same target should produce one edge, not 5. The unique constraint on that triplet plus `onConflict` upsert handles this without duplicate edges accumulating over edits.

---

### Knowledge Graph

The graph page (`src/app/graph/`) renders all entities and their connections using **React Flow v11**.

Nodes are all notes, people, bookmarks, and tasks. Edges come from two sources:

1. **`knowledge_links` rows** — both `__wikilink__` (auto) and manually created links.
2. **Implicit FK edges** — `notes.person_id` and `tasks.person_id` foreign keys are also rendered as edges.

Node colours are type-coded; clicking a node opens the entity in a side panel without leaving the graph.

---

### Notebook System

Notebooks are named containers. Membership is tracked via the `nb:` tag prefix rather than a foreign key join table.

**How it works:**

```
notebook.name = "Work Notes"
→ slug = "work-notes"   (lowercase, spaces → hyphens)
→ tag  = "nb:work-notes"

note in this notebook has tag "nb:work-notes" in its tags[] column
```

When a note is added to a notebook, the API PATCHes the note's `tags` array to include `nb:<slug>`. Removing it removes the tag.

**Why not a join table?**

The tag approach means membership information travels with the note in a single row — no join needed when listing notes. The trade-off is that renaming a notebook does _not_ retroactively update existing `nb:` tags (the old slug stays on the notes). A future migration is needed to fix this properly by switching to ID-based tags (`nb:uuid`).

**Known limitation (H2):** Two notebooks with names that produce the same slug (e.g. "My Notes" and "My  Notes" with two spaces) would collide. The unique constraint on `(user_id, name)` prevents two notebooks from having the same name, which prevents slug collision at the DB level.

**Optimistic updates with rollback:**

`useNotebooks` applies state changes immediately (optimistic) and rolls back on API failure:

```ts
const snapshot = notebooks
setNotebooks(optimistic)
const result = await fetch(...)
if (!result.ok) setNotebooks(snapshot)
```

---

### Theme System

Dotstell supports 14 themes (7 dark, 7 light).

**The flash problem:** On first load, React has not hydrated yet. If the theme is only in `localStorage`, the page renders in the default theme for one frame before React reads localStorage and switches — visible as a flash.

**Solution:** On every theme change, the theme ID is written to a cookie (`dotstell-theme`) with a 1-year expiry. The Next.js layout (or middleware) reads this cookie server-side and sets `data-theme` on `<html>` before the page HTML is sent. The browser paints the correct theme immediately, with no flash.

```
Server reads cookie → sets data-theme on <html> before sending HTML
Browser paints correct theme immediately
React hydrates → useTheme() reads localStorage → matches server HTML
```

`colorScheme` (`light` / `dark`) is also set on `document.documentElement` so the OS-native UI elements (scrollbars, input borders, system dialogs) match the theme.

---

### Task Reminders

`useTaskReminders` (mounted in the app shell) checks tasks once per session on load:

1. Requests `Notification` permission if not yet granted.
2. Fetches all tasks from `/api/tasks`.
3. Filters to tasks where `diffDays <= 1` (today or overdue, not completed).
4. Shows a single grouped browser notification if any match.
5. Writes a `sessionStorage` flag so the notification fires only once per browser session, not on every navigation.

---

## AI Layer

Dotstell's AI layer was introduced in v0.4.0. It provides: streaming chat with RAG, inline text assist, smart titles, auto-tagging, note and bookmark summaries, an AI Knowledge Digest, semantic Related Notes, Person Intelligence, and graph analysis.

### Provider Architecture

All AI operations are routed through a unified client in `src/lib/ai/client.ts` that dispatches to provider-specific implementations:

| Provider | Chat / Assist | Embeddings | Wire Format |
|---|---|---|---|
| `ollama` | `ollamaStream` | `ollamaEmbed` | Ollama native REST + NDJSON streaming |
| `openai` | `openaiStream` | `openaiEmbed` | OpenAI Chat Completions API + SSE |
| `groq` | `groqStream` (wraps openaiStream) | — | OpenAI-compatible (different base URL) |
| `anthropic` | `anthropicStream` | — | Anthropic Messages API + SSE |
| `gemini` | `geminiStream` | `geminiEmbed` | Google Generative Language REST + SSE |

**Streaming normalisation:** Every provider's SSE stream is transformed to a common format:

```
data: {"delta":"text fragment","done":false}
…
data: {"delta":"","done":true}
```

All downstream consumers (API routes, hooks, UI) read this single format regardless of provider. Provider differences (OpenAI `choices[0].delta.content`, Anthropic `content_block_delta`, Gemini `candidates[0].content.parts[0].text`) are handled entirely inside each provider's transform function.

**AI API routes** (`src/app/api/ai/`):

| Route | Method | Purpose |
|---|---|---|
| `/api/ai/chat` | POST | Streaming chat; prepends RAG context if `context` field present |
| `/api/ai/assist` | POST | Inline text operations (rewrite, expand, shorten, fix, outline, checklist, explain) |
| `/api/ai/summarize` | POST | Note or bookmark summary |
| `/api/ai/title` | POST | Smart title suggestion |
| `/api/ai/tags` | POST | Auto-tag suggestion (returns JSON array) |
| `/api/ai/embed` | POST / PUT | Single embed (POST) or bulk re-index all un-indexed notes (PUT) |
| `/api/ai/semantic-search` | POST | pgvector cosine similarity search; returns matching note/bookmark snippets |
| `/api/ai/related/[id]` | POST | Related notes for a given note (wraps semantic-search) |
| `/api/ai/digest` | POST | AI Knowledge Digest for dashboard |
| `/api/ai/person` | POST | Person intelligence: search all notes/bookmarks by name, generate brief |
| `/api/ai/graph-intel` | POST | Graph analysis: missing links, clusters, gap detection |
| `/api/ai/cloud-models` | POST | Fetch live model list from OpenAI / Anthropic / Groq |
| `/api/ai/gemini-models` | POST | Fetch live chat + embedding model list from Gemini |
| `/api/ai/ollama-models` | GET | Proxy to local Ollama `/api/tags` (avoids corporate proxy issues on localhost) |

All routes require authentication (`supabase.auth.getUser()`) and are rate-limited. The AI config (provider, model, API key) is sent in the POST body per request — it is never persisted server-side.

---

### Request Routing — Server vs. Browser

Most AI operations run on the **Next.js server** (Vercel), which then calls the provider API. This works for all cloud providers (OpenAI, Anthropic, Gemini, Groq) but **not for Ollama when using the live hosted app** — Vercel's serverless functions cannot reach `http://localhost:11434` on the user's machine.

For Ollama on the live app, all AI requests take a **browser-side path** — the browser calls Ollama (or the Local Agent proxy) directly:

```
Normal path (cloud providers, or Ollama on localhost dev):
  Browser → POST /api/ai/chat → Vercel → Provider API → SSE back

Ollama path on live app (dotstell.app):
  Browser → POST http://127.0.0.1:12345/api/chat → Local Agent → Ollama → NDJSON back
```

**Which routes use the browser-side path when Ollama + live app is detected:**

| Feature | Hook / Component | Browser-side path |
|---|---|---|
| AI Chat | `AIChatPanel` | `streamOllamaBrowser()` → Local Agent |
| Inline Assist | `useAIAssist` | `streamOllamaBrowser()` → Local Agent |
| Note/bookmark summary | `useAISummarize` | `completeOllamaBrowser()` → Local Agent |
| Smart title | `useAITitleSuggest` | `completeOllamaBrowser()` → Local Agent |
| Auto-tags | `useAITagSuggest` | `completeOllamaBrowser()` → Local Agent |
| AI Digest (dashboard) | `generateDigest()` | `completeOllamaBrowser()` → Local Agent |
| Person Intelligence | `useAIPersonIntel` | `completeOllamaBrowser()` → Local Agent |
| Embeddings (build index) | `buildSearchIndexBrowserOllama()` | `fetch(LOCAL_AGENT_BASE/api/embeddings)` |

Detection: `isLocalHostname()` (`src/lib/ai/ollama-browser.ts`) returns `true` when the page hostname is `localhost` or `127.0.0.1`. When false (live app), and the provider is Ollama, the browser-side path is used.

---

### Local AI Agent

The Local AI Agent (`packages/agent/index.mjs`) solves the **Private Network Access (PNA)** browser security restriction.

**The problem:** Chrome 115+ and Firefox 120+ block `https://` pages from fetching `http://127.0.0.1` unless the local server returns `Access-Control-Allow-Private-Network: true` in its CORS preflight response. Ollama does not return this header.

**The solution:** The agent is a zero-dependency Node.js HTTP server that:
1. Binds to `http://127.0.0.1:12345` (loopback only — not reachable from outside the machine)
2. Validates the `Origin` header against a hard-coded allow-list (`dotstell.app`, `dotstell.com`, `*.vercel.app`, localhost)
3. Returns correct PNA and CORS headers on OPTIONS preflight
4. Forwards the request verbatim to Ollama (`127.0.0.1:11434` by default)
5. Copies Ollama's streaming response back with its own CORS headers

```
Browser (dotstell.app)
  │  OPTIONS http://127.0.0.1:12345/api/chat
  │  ← Access-Control-Allow-Private-Network: true
  │  ← Access-Control-Allow-Origin: https://dotstell.app
  │
  │  POST http://127.0.0.1:12345/api/chat
  ▼
Local Agent (127.0.0.1:12345)
  │  forward (origin/referer headers stripped)
  ▼
Ollama (127.0.0.1:11434)
  └── model inference → NDJSON stream back
```

The app detects the agent via `GET http://127.0.0.1:12345/health`. The AI Settings modal shows a live status badge. If the agent is not running, a warning is shown with the start command.

---

### Embedding Pipeline

Semantic search (Related Notes, RAG context, AI Chat grounding) requires notes and bookmarks to have embeddings stored in the database.

**Storage:** The `notes` and `bookmarks` tables each have an `embedding vector(768)` column (pgvector extension). All embedding models are configured to produce exactly 768 dimensions:

| Provider | Embedding model | 768-dim mechanism |
|---|---|---|
| Ollama | `nomic-embed-text` | Native 768-dim model |
| OpenAI | `text-embedding-3-small` | `dimensions: 768` param (Matryoshka) |
| Gemini | `gemini-embedding-001` | `outputDimensionality: 768` param |

> `text-embedding-ada-002` is not supported — it ignores the `dimensions` parameter and always returns 1536 dimensions, which mismatches the `vector(768)` column. The app rejects it with a clear error.

**Indexing:** The `PUT /api/ai/embed` route (bulk) embeds all un-indexed notes and bookmarks sequentially (to avoid rate-limit bursts). For Ollama on the live app, `buildSearchIndexBrowserOllama()` runs the same pipeline entirely in the browser via the Local Agent.

**Search:** `POST /api/ai/semantic-search` embeds the query and runs:

```sql
SELECT id, title, content, 1 - (embedding <=> query_vector) AS similarity
FROM notes
WHERE user_id = $1
  AND deleted_at IS NULL
  AND embedding IS NOT NULL
  AND 1 - (embedding <=> query_vector) > threshold
ORDER BY similarity DESC
LIMIT limit
```

The `<=>` operator is pgvector's cosine distance. Results above the threshold are returned as context chunks.

---

### AI Security Model

| Concern | Approach |
|---|---|
| API key storage | Browser `localStorage` only — never sent to dotstell servers, never persisted in the database |
| API key transmission | Sent in POST body (not query params) over TLS to the provider directly from the browser, or server-side to cloud providers |
| Gemini key in URL | Gemini REST API requires `?key=` query param — this is a known limitation of that API's design |
| Ollama key-free access | Ollama requires no API key; `isConfigured` requires localStorage to contain a saved config to prevent the default Ollama config being treated as "configured" |
| Rate limiting | All `/api/ai/*` routes are rate-limited (60–120 req/min depending on route) |
| Local Agent SSRF | Agent only proxies to a fixed `OLLAMA_HOST:OLLAMA_PORT` — the target is not controllable by the browser request |
| Local Agent origin gate | Non-allow-listed origins receive 403; `*` is never returned as `Access-Control-Allow-Origin` |

---



A typical note save (PATCH) follows this path:

```
User types in editor
  → debounce 500ms
  → PATCH /api/notes/[id]  { title, content, tags }

Next.js API route (server):
  1. createClient() — reads session cookie, initialises Supabase server client
  2. auth.getUser() — verifies JWT, extracts user.id
  3. Rate limit check (120/min per user)
  4. Input validation — allowlist fields, validate color if present
  5. supabase.from('notes').update(allowed).eq('id', id).eq('user_id', user.id)
     └── Supabase applies RLS: auth.uid() = user_id (double enforcement)
  6. Return updated row

Client:
  7. Optimistic update was already applied on input
  8. On success: no-op (already showing correct state)
  9. On failure: rollback to previous state + toast error
```

---

## Desktop vs Web

The desktop app is built with **Tauri v2** — a Rust framework that wraps a WebView (WKWebView on macOS, WebView2 on Windows, webkit2gtk on Linux).

```
┌─────────────────────────────────┐
│     Native OS Window            │
│  ┌───────────────────────────┐  │
│  │  WebView                  │  │
│  │  loads dotstell.app       │  │
│  │  (same Next.js web app)   │  │
│  └───────────────────────────┘  │
│     Rust shell (src-tauri/)     │
│     handles: window mgmt,       │
│     auto-updater, tray icon,    │
│     deep links, notifications   │
└─────────────────────────────────┘
```

**Key properties:**

- No bundled frontend — the WebView loads `dotstell.app` over the internet. This means desktop users always get the latest web app version without a desktop app update.
- No local database — all data goes through the same Supabase backend.
- The Rust shell is minimal: ~50 lines in `lib.rs`. It wires up the Tauri plugins (updater, notifications, shell, dialog) and starts the WebView.
- Installer size: ~10 MB (vs ~150 MB for Electron) because the OS's own WebView engine is used, not a bundled Chromium.
- Tauri plugins used: `tauri-plugin-updater`, `tauri-plugin-notification`, `tauri-plugin-shell`, `tauri-plugin-dialog`, `tauri-plugin-process`.

---

## Database Migrations

A fresh database should be set up by running `supabase/schema.sql` in the Supabase SQL Editor. This creates all tables, RLS policies, indexes, and triggers.

For existing databases, apply incremental migrations in order:

```
supabase/migrations/
├── add_notebooks_table.sql        # adds notebooks table + nb: tag design
├── add_notes_soft_delete.sql      # adds deleted_at column for trash
├── 002_bookmarks_enhancements.sql # reading_time, hostname, visit columns
├── 003_bookmark_visits.sql        # last_visited_at, visit_count tracking
├── 004_notes_parent.sql           # parent_id for note hierarchy
├── 005_notes_sort_pin.sql         # sort_order + pinned columns
├── 006_notes_color.sql            # color column (hex string)
├── 007_notebooks_constraints.sql  # unique (user_id, name) + explicit WITH CHECK policy
├── 008_ai_embeddings.sql          # vector(768) columns on notes + bookmarks; enables pgvector
└── 009_ai_match_functions.sql     # match_notes() + match_bookmarks() RPC functions for cosine similarity search
```

> **Note on `007_notebooks_constraints.sql`:** This migration must be run manually in the Supabase SQL Editor. It adds the `UNIQUE(user_id, name)` constraint that prevents duplicate notebook names from producing colliding `nb:` tags. Without it, creating two notebooks with the same name will cause a 500 error instead of a clean 409 conflict response.

### Trigger ordering

All `updated_at` triggers are defined at the bottom of `schema.sql`, after all table definitions. PostgreSQL requires the table to exist before a trigger can reference it — placing triggers inline (next to each table) causes a fresh `schema.sql` run to fail.
