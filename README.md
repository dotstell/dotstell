<div align="center">

<br/>

<img src="banner.svg" alt="dotstell" width="100%" />

<br/>
<br/>

### Your knowledge is scattered. Dotstell connects it.

**Notes · People · Tasks · Bookmarks · Wikilinks — all linked in one living knowledge graph**

<br/>

[![GitHub Stars](https://img.shields.io/github/stars/dotstell/dotstell?style=flat-square&color=7c6aff&logo=github)](https://github.com/dotstell/dotstell/stargazers)
[![GitHub Forks](https://img.shields.io/github/forks/dotstell/dotstell?style=flat-square&color=gray&logo=github)](https://github.com/dotstell/dotstell/network/members)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-7c6aff?style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Rust](https://img.shields.io/badge/Rust-Tauri%20v2-CE422B?style=flat-square&logo=rust)](https://tauri.app)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](CONTRIBUTING.md)

<br/>

[Website](https://www.dotstell.com) · [Live App](https://dotstell.app) · [Releases](https://github.com/dotstell/dotstell/releases) · [Report a bug](https://github.com/dotstell/dotstell/issues) · [Request a feature](https://github.com/dotstell/dotstell/issues) · [Contact](mailto:hello@dotstell.com)

</div>

---

## What is Dotstell?

Dotstell is an open source personal knowledge graph — a single place to write notes, track people, manage tasks, save bookmarks, and connect all of them together through a visual graph.

Most productivity tools are built around **capture**. Dotstell is built around **connection**.

The question it answers that other tools don't:

> *"What do I know about this person, this project, this decision — right now, in full context?"*

---

## Support the project

Dotstell is free, self-hostable, and built in the open. If it saves you time or you believe in what we're building:

- **[Star the repo](https://github.com/dotstell/dotstell/stargazers)** — the single most useful thing you can do. It helps others find Dotstell and tells us the work is worthwhile.
- **[Open an issue](https://github.com/dotstell/dotstell/issues)** — bug reports and feature requests shape what gets built next.
- **[Contribute code](CONTRIBUTING.md)** — all skill levels welcome; see the contributing guide.
- **Share it** — tell someone who needs a better way to organise their work.

Every star, issue, and PR genuinely matters for an early-stage OSS project.

---

## Features

| | Feature | Description |
|---|---|---|
| 📑 | **Rich Text Notes** | Write in rich text with slash commands, tables, code blocks and checklists |
| ⬡ | **Wikilinks & Backlinks** | Type `[[` in any note to link it to another — backlinks update automatically |
| 📓 | **Notebooks** | Organise notes into named collections with colour-coded sidebar grouping |
| 👥 | **People & 1-on-1s** | Track contacts, attach notes, tasks and context directly to people — supports `@mention` in notes |
| 🔖 | **Smart Bookmarks** | Save any URL — title, description and favicon fetched automatically; bulk import from Chrome, Firefox or Safari |
| ✅ | **Tasks & Priorities** | Kanban board + list view with priorities, due dates and overdue alerts |
| 🌐 | **Knowledge Graph** | Visual map of everything — wikilinks and manual connections appear as live edges |
| 🔍 | **Universal Search** | Ctrl+K command palette across all notes, people, tasks and bookmarks |
| 🔗 | **Manual Linking** | Connect any entity to any other — note → person, bookmark → task, etc. |
| 🏠 | **Dashboard** | Unified home screen: overdue alerts, task progress, recent notes and bookmarks |
| ✨ | **AI — Chat, Assist & Search** | RAG-grounded chat, inline text assist (rewrite, expand, fix), smart titles, auto-tagging, note summaries, AI Digest, Person Intelligence, semantic Related Notes — works with Ollama (local/private), OpenAI, Anthropic, Gemini, or Groq |

---

## Screenshots

Live previews of the app are available on [dotstell.com](https://www.dotstell.com) — the landing page includes an interactive knowledge graph, dashboard mockup, and feature walkthroughs.

Try the live app at [dotstell.app](https://dotstell.app) or [download the desktop build](https://github.com/dotstell/dotstell/releases) for Windows, macOS and Linux.

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm — `npm install -g pnpm`
  > We use pnpm instead of npm/yarn because it is significantly faster (hard-linked global store, no re-downloading the same package twice), produces a deterministic `pnpm-lock.yaml`, and is required by the Tauri CLI toolchain used for the desktop build. The lockfile is committed — always use `pnpm install`, not `npm install`, to keep the lockfile consistent.
- A free [Supabase](https://supabase.com) account

### 1. Clone

```bash
git clone https://github.com/dotstell/dotstell.git
cd dotstell
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run `supabase/schema.sql` to create all tables, policies, and triggers.

   For an existing database, apply migrations in order:

```
supabase/migrations/
├── add_notebooks_table.sql
├── add_notes_soft_delete.sql
├── 002_bookmarks_enhancements.sql
├── 003_bookmark_visits.sql
├── 004_notes_parent.sql
├── 005_notes_sort_pin.sql
├── 006_notes_color.sql
├── 007_notebooks_constraints.sql
├── 008_ai_embeddings.sql          ← vector(768) columns on notes + bookmarks (AI semantic search)
└── 009_ai_match_functions.sql     ← pgvector cosine similarity RPC functions
```

3. Copy your project URL and anon key from **Settings → API**

### 4. Configure environment

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

> **Behind a corporate SSL proxy?** Add `NODE_TLS_REJECT_UNAUTHORIZED=0` to your `.env.local`. Do **not** set this in production.

### 5. Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000), create an account and start connecting your knowledge.

---

## AI Features

Dotstell ships a complete AI layer. All features work with five provider options:

| Provider | Chat | Embeddings | Notes |
|---|---|---|---|
| **Ollama (local)** | ✅ | ✅ | Free, private, runs on your machine |
| **OpenAI** | ✅ | ✅ | GPT-4o, text-embedding-3-small |
| **Anthropic** | ✅ | — | Claude models; use a separate embedding provider |
| **Google Gemini** | ✅ | ✅ | Generous free tier |
| **Groq** | ✅ | — | Extremely fast inference; use a separate embedding provider |

**AI features:**
- **AI Chat** — slide-out panel with RAG (semantic search grounds answers in your notes), "This note" and "All knowledge" modes, People tab for person intelligence
- **Inline Assist** — select text → rewrite / expand / shorten / fix grammar / outline / checklist / explain
- **Smart title & auto-tags** — suggest a title and up to 5 relevant tags as you write
- **Note & bookmark summaries** — one-click summary in bullet or paragraph form
- **AI Knowledge Digest** — dashboard panel summarising your latest notes activity
- **Semantic Related Notes** — sidebar panel showing notes similar to the one you're reading
- **Person Intelligence** — searches all your notes and bookmarks for mentions of a person and generates a structured brief
- **Graph intelligence** — finds missing links, note clusters, and bridgeable gaps in your knowledge graph

API keys are stored only in your browser's `localStorage`. They are never sent to dotstell servers — only to your chosen AI provider directly over TLS.

### Using Ollama with the live app — Local AI Agent

The hosted app at `dotstell.app` runs over `https://`. Modern browsers block `https://` pages from fetching `http://localhost` directly (Private Network Access spec). To use Ollama with the live app, run the **Dotstell Local AI Agent** — a tiny zero-dependency Node.js proxy that adds the required browser security headers:

```bash
# If Ollama is not already running (on Windows it usually auto-starts):
ollama serve

# Start the Local Agent
node packages/agent/index.mjs
```

> **Windows tip:** Ollama typically runs as a background service on Windows and starts automatically. If you see `bind: Only one usage of each socket address` when running `ollama serve`, Ollama is already up — skip that step and just start the agent.

The agent runs on `http://127.0.0.1:12345`, is loopback-only (not reachable from outside your machine), and proxies all AI requests from the browser to your local Ollama. The settings modal shows a green badge when it detects the agent.

See [`packages/agent/README.md`](packages/agent/README.md) for full setup, environment variables, and security details.

**You do not need the agent when running dotstell locally** (`localhost:3000`). PNA restrictions only apply when accessing the live `https://dotstell.app`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript 5 · Rust (desktop shell) |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL 15 + Row Level Security) |
| Auth | Supabase Auth (JWT) |
| Rich Text Editor | Tiptap v3 |
| Graph Visualisation | React Flow v11 |
| Desktop | Tauri v2 (native WebView wrapper, ~10 MB installer) |
| Icons | Lucide React |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for a full breakdown of the system design, data model, security model, and key design decisions.

---

## Project Structure

```
src/
├── app/
│   ├── api/                          # Next.js API routes (server-side)
│   │   ├── ai/                       # AI routes — all require auth + rate limiting
│   │   │   ├── chat/                 # Streaming chat (SSE) — all providers
│   │   │   ├── assist/               # Inline text operations (rewrite, expand, fix…)
│   │   │   ├── summarize/            # Note / bookmark summary
│   │   │   ├── title/                # Smart title suggestion
│   │   │   ├── tags/                 # Auto-tag suggestion
│   │   │   ├── embed/                # Single + bulk embedding (PUT = bulk re-index)
│   │   │   ├── semantic-search/      # pgvector similarity search
│   │   │   ├── related/[id]/         # Related notes for a given note
│   │   │   ├── digest/               # AI Knowledge Digest (dashboard)
│   │   │   ├── person/               # Person intelligence brief
│   │   │   ├── graph-intel/          # Graph AI analysis (clusters, gaps)
│   │   │   ├── cloud-models/         # Live model list (OpenAI / Anthropic / Groq)
│   │   │   ├── gemini-models/        # Live model list (Gemini)
│   │   │   └── ollama-models/        # Ollama installed model list (server proxy)
│   │   ├── notes/                    # Notes list + create
│   │   ├── notes/[id]/               # Note CRUD (soft delete)
│   │   ├── notes/[id]/backlinks/     # Backlink lookup for a note
│   │   ├── notes/[id]/wikilinks/     # Wikilink edge sync on save
│   │   ├── notes/[id]/unlinked-mentions/ # Unlinked [[title]] detection
│   │   ├── notes/[id]/restore/       # Restore note from trash
│   │   ├── notes/[id]/permanent/     # Permanent delete (bypass soft)
│   │   ├── notes/trash/              # List trashed notes
│   │   ├── notebooks/                # Notebooks list + create
│   │   ├── notebooks/[id]/           # Notebook rename / delete
│   │   ├── people/                   # People list + create
│   │   ├── people/[id]/              # Person CRUD
│   │   ├── bookmarks/                # Bookmarks list + create
│   │   ├── bookmarks/[id]/           # Bookmark patch / delete
│   │   ├── bookmarks/bulk-import/    # Netscape HTML file parser
│   │   ├── bookmarks/bulk-delete/    # Delete multiple bookmarks
│   │   ├── bookmarks/preview-import/ # Parse without saving (preview)
│   │   ├── bookmarks/manage-tags/    # Rename / delete a tag globally
│   │   ├── bookmarks/fetch-meta/     # SSRF-protected URL metadata fetch
│   │   ├── bookmarks/visit/          # Record visit + update last_visited_at
│   │   ├── tasks/                    # Tasks list + create
│   │   ├── tasks/[id]/               # Task CRUD
│   │   ├── links/                    # Knowledge links (manual + wikilink edges)
│   │   ├── wikilinks/                # Wikilink resolution (title → id lookup)
│   │   ├── graph/                    # Graph data (all nodes + edges combined)
│   │   └── search/                   # Full-text search across all entity types
│   ├── auth/                         # Login, register, OAuth callback
│   ├── dashboard/                    # Home: overdue tasks, recent notes
│   ├── notes/                        # Notes list
│   ├── notes/[id]/                   # Note editor (full page)
│   ├── people/                       # People list
│   ├── people/[id]/                  # Person detail + attached notes/tasks
│   ├── bookmarks/                    # Bookmarks + collections
│   ├── tasks/                        # Kanban board + list view
│   ├── graph/                        # Interactive knowledge graph
│   ├── tags/                         # Tag browser across all entity types
│   ├── search/                       # Global search results
│   └── help/                         # Help & keyboard shortcuts
├── components/
│   ├── ai/                           # AI UI components
│   │   ├── AISettingsModal.tsx       # Provider/model picker, test connection, build index
│   │   ├── AIChatPanel.tsx           # Slide-out chat panel with RAG + People tab
│   │   ├── AIPersonPanel.tsx         # Person intelligence search + brief
│   │   └── AIRelatedPanel.tsx        # Related notes sidebar panel
│   ├── editor/                       # Tiptap editor + WikiLinkExtension node
│   ├── layout/                       # Sidebar, AppLayout, PageHeader
│   ├── command/                      # Ctrl+K command palette
│   ├── links/                        # LinkPanel (manual entity-to-entity linking)
│   ├── graph/                        # Graph canvas, node/edge renderers
│   ├── notes/                        # NoteCard, NotesSidePane, BacklinksPanel
│   ├── bookmarks/                    # BookmarkCard, BookmarkImport, TagFilter
│   ├── people/                       # PersonCard, PersonDetail
│   ├── tasks/                        # TaskCard, KanbanBoard, TaskList
│   ├── onboarding/                   # First-run onboarding flow
│   ├── brand/                        # Logo and brand assets
│   └── ui/                           # Design system: buttons, dialogs, inputs
├── hooks/
│   ├── useAI.ts                      # useAIStream, useAIAssist, useAISummarize, useAIPersonIntel…
│   ├── useAISettings.ts              # AI config: load/save/sync across instances
│   └── …                            # useNotebooks, useMention, useTheme, etc.
├── store/                            # Zustand global stores
├── lib/
│   ├── ai/
│   │   ├── client.ts                 # streamChat(), complete(), embed(), validateConfig()
│   │   ├── types.ts                  # AIConfig, AIProvider, EmbeddingProvider, defaults
│   │   ├── prompts.ts                # Prompt builders for each AI operation
│   │   ├── error.ts                  # providerError() — normalises provider errors
│   │   ├── ollama-browser.ts         # Browser-side Ollama client + Local Agent detection
│   │   └── providers/
│   │       ├── openai.ts             # OpenAI + Groq streaming (OpenAI-compatible format)
│   │       ├── anthropic.ts          # Anthropic Messages API streaming
│   │       ├── gemini.ts             # Gemini streamGenerateContent + embedContent
│   │       └── ollama.ts             # Ollama /api/chat + /api/embeddings
│   ├── supabase/                     # Browser + server Supabase clients
│   ├── tiptap/                       # WikiLinkExtension (custom ProseMirror node)
│   └── ratelimit.ts                  # In-memory rate limiter
└── types/                            # Shared TypeScript types
src-tauri/
├── src/lib.rs                        # Tauri v2 desktop shell (Rust)
└── tauri.conf.json                   # App metadata, permissions, updater config
supabase/
├── schema.sql                        # Full schema: tables, RLS, indexes, triggers
└── migrations/                       # Incremental SQL migrations (002 → 008)
packages/
└── agent/                            # Dotstell Local AI Agent v1.0.0
    ├── index.mjs                     # Zero-dep Node.js CORS/PNA proxy for Ollama
    ├── package.json
    └── README.md                     # Setup guide and security notes
```

---

## Roadmap

| Feature | Status |
|---|---|
| Notes, People, Tasks, Bookmarks | ✅ Live |
| Wikilinks + Backlinks | ✅ Live |
| Knowledge Graph | ✅ Live |
| Desktop app (Windows, macOS + Linux) | ✅ Live |
| AI layer — Chat, Assist, Semantic Search, Person Intelligence, Summaries, Digest | ✅ Live (v0.4.0) |
| Local AI via Ollama — works from both live app and local dev | ✅ Live (v0.4.0) |
| Docs (per-project documentation) | 🔜 Soon |
| Browser extension | 🔜 Planned |
| Integrations (Slack, Teams, etc.) | 🔜 Planned |
| Mobile app | 🔜 Planned |

---

## Contributing

Contributions are welcome and genuinely appreciated.

- **Bug reports & feature requests** — open an [issue](https://github.com/dotstell/dotstell/issues)
- **Code contributions** — please open an issue first for anything significant so we can align on approach
- **Docs, design, tests** — always welcome without prior discussion

See [CONTRIBUTING.md](CONTRIBUTING.md) for full guidelines.

---

## Self-Hosting

Dotstell is designed to be self-hostable. You need:

- A Node.js server (or Vercel / any Next.js host)
- A Supabase project (or self-hosted Supabase)

Full self-hosting guide coming soon. In the meantime the Getting Started steps above cover a local setup.

---

## License

[GNU Affero General Public License v3.0](LICENSE) — AGPL-3.0

This means you can use, modify and distribute Dotstell freely, including self-hosting it. If you run a modified version as a network service, you must make the modified source available to users of that service.

© 2026 Dotstell
