<div align="center">

# ✦ Dotstell

### Your knowledge is scattered. Dotstell connects it.

**Notes · People · Tasks · Bookmarks — all linked in one living knowledge graph**

[![Open Source](https://img.shields.io/badge/Open%20Source-MIT-7c6aff?style=flat-square)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-Postgres-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)

</div>

---

## Why Dotstell?

You already use Notion, Obsidian, Todoist, Raindrop, or some combination of all of them.

**So why build another one?**

Because none of them answer the question that actually matters:

> *"What do I know about this person, this project, this decision — right now, in context?"*

Notion is a database. Obsidian is a vault. Todoist is a list.
**Dotstell is a graph.** Every note, person, task, and bookmark is a node. Every connection between them is an edge. The result is a living map of your thinking — not just a place to dump information.

---

## The insight that drives this

Most productivity tools are built around **capture**.
Dotstell is built around **connection**.

Capture is easy. Everyone has solved capture.

The hard part is surfacing the right context at the right moment:
- The task you're working on relates to a decision made last week
- That decision came from a conversation with a person
- That person has three notes attached to them you've already forgotten about

**Dotstell makes those connections visible, navigable, and useful.**

---

## Who is it for?

Anyone who thinks for a living and feels like their knowledge is leaking:

- 👩‍💻 **Engineers & developers** — link tickets, decisions, and technical notes
- 👔 **Managers** — track 1-on-1s, team context, and follow-ups in one place
- 🎓 **Students & researchers** — connect ideas across sources and people
- 🚀 **Founders & PMs** — never lose context on a conversation, decision, or customer
- 🧠 **Anyone building a second brain** — who finds existing tools too rigid or too complex

---

## What's in the MVP

| Feature | What it does |
|---|---|
| 📑 **Notes** | Plain text, Markdown, and Checklist — all in one place |
| 👥 **People & 1-on-1s** | Add contacts, attach notes directly to people |
| ✅ **Tasks** | Kanban board + list view with priorities and due dates |
| 🔖 **Bookmarks** | Save and tag links with full context |
| 🌐 **Knowledge Graph** | Visual map of everything, connected |
| 🔍 **Search** | Instant search across all item types |
| 🔗 **Knowledge Linking** | Connect any note to any person, task or bookmark |
| 🔐 **Auth** | Secure login via Supabase |

---

## The Ecosystem Vision

Dotstell is not just an app. It's the beginning of an **open source ecosystem** built on a shared knowledge graph.

The notes app is the first building block. Every future app plugs into the same graph underneath:

| App | Status | Description |
|---|---|---|
| 📑 **Notes** | ✅ Live | The foundation — all note types in one place |
| 👥 **People** | ✅ Live | Relationships, contacts & 1-on-1 notes |
| ✅ **Tasks** | ✅ Live | Priorities, due dates, kanban |
| 🔖 **Bookmarks** | ✅ Live | Save links with context |
| 🌐 **Graph** | ✅ Live | Visual knowledge map |
| 🤖 **AI Layer** | 🔜 Planned | Auto-tagging, summarisation, semantic search |
| 🌐 **Browser Extension** | 🔜 Planned | One-click capture from the web |
| 💬 **Integrations** | 🔜 Planned | Slack, Teams, Email |
| 📱 **Mobile** | 🔜 Planned | Capture on the go |

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/R-OSS-CSDD/dotstell.git
cd dotstell
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run [`supabase/schema.sql`](./supabase/schema.sql)
3. Copy your project URL and anon key from **Settings → API**

### 4. Configure environment

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

> **Corporate network?** Add `NODE_TLS_REJECT_UNAUTHORIZED=0` to your `.env.local` if you're behind a corporate SSL proxy.

### 5. Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) — create an account and start connecting your knowledge.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | Supabase (Postgres + RLS + pgvector ready) |
| Auth | Supabase Auth |
| Graph | React Flow |
| Markdown | @uiw/react-md-editor |

---

## Project Structure

```
src/
├── app/                  # Pages & API routes
│   ├── api/              # REST API (notes, people, bookmarks, tasks, links)
│   ├── auth/             # Login & register
│   ├── dashboard/        # Home dashboard
│   ├── notes/            # Notes
│   ├── people/           # People & 1-on-1 notes
│   ├── bookmarks/        # Bookmarks
│   ├── tasks/            # Tasks (kanban + list)
│   ├── graph/            # Knowledge graph
│   └── search/           # Global search
├── components/
│   ├── layout/           # Sidebar, AppLayout, PageHeader
│   ├── notes/            # NoteCard, NoteEditor
│   └── ui/               # Design system components
├── lib/supabase/         # Supabase client, server, proxy
└── types/                # Shared TypeScript types
supabase/
└── schema.sql            # Full DB schema with RLS policies
```

---

## Contributing

This is being built in the open and contributions are genuinely welcome — features, fixes, design, docs, or just opening an issue with your ideas.

**Please open an issue before a large PR** so we can align on approach first.

---

## License

Not yet licensed — observing before going fully public.
Once public: **MIT** — free to use, modify, and build on.
