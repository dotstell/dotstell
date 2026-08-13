<div align="center">

<br/>

<img src="public/logo-full.svg" alt="Dotstell" width="400" />

<br/>
<br/>

### Your knowledge is scattered. Dotstell connects it.

**Notes · People · Tasks · Bookmarks · Wikilinks — all linked in one living knowledge graph**

<br/>

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-7c6aff?style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](CONTRIBUTING.md)

<br/>

[Website](https://www.dotstell.com) · [Live App](https://dotstell.app) · [Report a bug](https://github.com/dotstell/dotstell/issues) · [Request a feature](https://github.com/dotstell/dotstell/issues) · [Contact](mailto:hello@dotstell.com)

</div>

---

## What is Dotstell?

Dotstell is an open source personal knowledge graph — a single place to write notes, track people, manage tasks, save bookmarks, and connect all of them together through a visual graph.

Most productivity tools are built around **capture**. Dotstell is built around **connection**.

The question it answers that other tools don't:

> *"What do I know about this person, this project, this decision — right now, in full context?"*

---

## Features

| | Feature | Description |
|---|---|---|
| 📑 | **Rich Text Notes** | Write in rich text with slash commands, tables, code blocks and checklists |
| ⬡ | **Wikilinks & Backlinks** | Type `[[` in any note to link it to another — backlinks update automatically |
| 👥 | **People & 1-on-1s** | Track contacts, attach notes, tasks and context directly to people |
| 🔖 | **Smart Bookmarks** | Save any URL — title, description and favicon fetched automatically |
| ✅ | **Tasks & Priorities** | Kanban board + list view with priorities, due dates and overdue alerts |
| 🌐 | **Knowledge Graph** | Visual map of everything — wikilinks and manual connections appear as live edges |
| 🔍 | **Universal Search** | Ctrl+K command palette across all notes, people, tasks and bookmarks |
| 🔗 | **Manual Linking** | Connect any entity to any other — note → person, bookmark → task, etc. |
| 🏠 | **Dashboard** | Unified home screen: overdue alerts, task progress, recent notes and bookmarks |

---

## Screenshots

Live previews of the app are available on [dotstell.com](https://www.dotstell.com) — the landing page includes an interactive knowledge graph, dashboard mockup, and feature walkthroughs.

App screenshots will be added here once the first public release is tagged.

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
2. Go to **SQL Editor** and run the migrations in order:

```bash
supabase/migrations/
├── 001_initial_schema.sql
├── 002_knowledge_links.sql
├── 003_bookmarks.sql
└── 004_notes_hierarchy.sql
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

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth |
| Rich Text Editor | Tiptap v3 |
| Graph Visualisation | React Flow v11 |
| Icons | Lucide React |

---

## Project Structure

```
src/
├── app/
│   ├── api/              # REST API routes
│   │   ├── notes/        # Notes CRUD + wikilinks + backlinks
│   │   ├── people/       # People CRUD
│   │   ├── bookmarks/    # Bookmarks CRUD
│   │   ├── tasks/        # Tasks CRUD
│   │   ├── links/        # Knowledge links (manual + wikilink edges)
│   │   └── search/       # Universal search
│   ├── auth/             # Login & register pages
│   ├── dashboard/        # Home dashboard
│   ├── notes/            # Notes list + editor
│   ├── people/           # People list + detail
│   ├── bookmarks/        # Bookmarks + collections
│   ├── tasks/            # Kanban + list view
│   ├── graph/            # Knowledge graph
│   └── search/           # Global search page
├── components/
│   ├── editor/           # Tiptap rich text editor + WikiLinkExtension
│   ├── layout/           # Sidebar, AppLayout, PageHeader
│   ├── links/            # LinkPanel (manual knowledge linking)
│   ├── notes/            # NoteCard, BacklinksPanel
│   └── ui/               # Design system (ThemePicker, buttons, etc.)
├── hooks/                # useTheme, useDebounce, etc.
├── lib/
│   ├── supabase/         # Supabase client + server helpers
│   └── tiptap/           # WikiLinkExtension node
└── types/                # Shared TypeScript types
supabase/
└── migrations/           # SQL migrations with RLS policies
```

---

## Roadmap

| Feature | Status |
|---|---|
| Notes, People, Tasks, Bookmarks | ✅ Live |
| Wikilinks + Backlinks | ✅ Live |
| Knowledge Graph | ✅ Live |
| AI layer (auto-tagging, semantic search) | 🔜 Planned |
| Desktop app (Windows + macOS) | ✅ Live |
| Browser extension | 🔜 Planned |
| Slack / Teams integrations | 🔜 Planned |
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
