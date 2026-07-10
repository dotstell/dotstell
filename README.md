# Dotstell

> Every note, person, task, and decision is a dot. Dotstell connects them into constellations you can actually navigate.

**Open source · Personal knowledge graph · Built for humans, not just power users**

---

## The Problem

Every day you capture information in ten different places — notes in one app, bookmarks in another, tasks somewhere else, meeting notes scattered across tools, people and conversations completely disconnected from everything.

You remember *having* the information. You just can't find it when it matters.

That's not a storage problem. It's a **connection problem**.

## The Vision

Dotstell is an open source ecosystem built around one idea: **your knowledge should be linked, not siloed.**

Whether you're an engineer, a manager, a student, a researcher, a founder, or anyone who thinks for a living — you deserve a tool that understands that a note about a person connects to a meeting, which connects to a decision, which connects to a task.

**Dotstell is being built as a long-term ecosystem of interconnected apps**, each solving a focused daily problem, all sharing the same knowledge graph underneath:

| App | Status | Description |
|---|---|---|
| 📑 **Notes** | ✅ MVP | Plain, Markdown & Checklist notes — the foundation |
| 👥 **People** | ✅ MVP | Contacts, relationships & 1-on-1 notes |
| ✅ **Tasks** | ✅ MVP | Kanban & list view with priorities and due dates |
| 🔖 **Bookmarks** | ✅ MVP | Save and tag links with context |
| 🌐 **Graph** | ✅ MVP | Visual knowledge map connecting everything |
| 🤖 **AI Layer** | 🔜 Planned | Auto-categorisation, summarisation, semantic search |
| 🌐 **Browser Extension** | 🔜 Planned | One-click capture from anywhere on the web |
| 💬 **Integrations** | 🔜 Planned | Slack, Teams, Email — capture without context switching |
| 📱 **Mobile** | 🔜 Planned | Capture on the go |

The notes app is the first building block. Everything else grows from it.

---

## Features (MVP)

- 📑 **Notes** — Plain text, Markdown, and Checklist notes in one place
- 👥 **People & 1-on-1s** — Track anyone and attach notes directly to them
- 🔖 **Bookmarks** — Save links with tags and descriptions
- ✅ **Tasks** — Kanban board and list view with priorities and due dates
- 🌐 **Knowledge Graph** — Visual map of all your connected items
- 🔍 **Search** — Instant search across everything
- 🔗 **Knowledge Linking** — Connect any note to any person, task or bookmark
- 🔐 **Auth** — Secure email/password login via Supabase

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

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/your-username/dotstell.git
cd dotstell
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of [`supabase/schema.sql`](./supabase/schema.sql)
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

> **Corporate network?** If you're behind a corporate SSL proxy, also add `NODE_TLS_REJECT_UNAUTHORIZED=0` to your `.env.local`.

### 5. Run the dev server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) and create your account.

---

## Project Structure

```
src/
├── app/                  # Next.js App Router pages & API routes
│   ├── api/              # REST API (notes, people, bookmarks, tasks, links)
│   ├── auth/             # Login & register
│   ├── dashboard/        # Home dashboard
│   ├── notes/            # Notes feature
│   ├── people/           # People & 1-on-1 notes
│   ├── bookmarks/        # Bookmarks
│   ├── tasks/            # Tasks (kanban + list)
│   ├── graph/            # Knowledge graph
│   └── search/           # Global search
├── components/
│   ├── layout/           # Sidebar, AppLayout, PageHeader
│   ├── notes/            # NoteCard, NoteEditor
│   └── ui/               # Button, Input, Card, Dialog, Badge, etc.
├── lib/supabase/         # Supabase client, server, proxy
├── hooks/                # useDebounce
└── types/                # Shared TypeScript types
supabase/
└── schema.sql            # Full DB schema with RLS policies
```

---

## Contributing

This project is being built in the open. Contributions of all kinds are welcome — features, bug fixes, design improvements, docs, or just opening an issue with your ideas.

**Before submitting a large PR**, please open an issue first so we can discuss the approach.

---

## Philosophy

Most productivity tools optimise for *capture*. Dotstell optimises for *connection*.

Capture is easy. The hard part is surfacing the right context at the right moment — knowing that the task you're working on relates to a conversation you had last week, which connects to a note you wrote three months ago.

Dotstell is built on the belief that a second brain should feel less like a filing cabinet and more like a living map of your thinking.

---

## License

MIT — free to use, modify, and build on.
