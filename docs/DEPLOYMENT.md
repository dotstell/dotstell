# Self-hosting dotstell

dotstell is a Next.js app that stores everything in a Supabase (PostgreSQL) project. Hosting it yourself means running the app and owning the database. There are no other services to run, and the only two settings are the address and public key of your Supabase project.

## What you need

- Node.js 20 or newer and [pnpm](https://pnpm.io) (`npm install -g pnpm`)
- A [Supabase](https://supabase.com) project: the free hosted one, or a self-hosted Supabase
- A place to run a Node.js server, such as Vercel, a VPS, or your own computer
- HTTPS if the app is not on `localhost`. Browsers only allow the microphone (dictation and meeting recording) on secure pages

## 1. Create the database

1. Create a Supabase project.
2. Open **SQL Editor**, paste the whole of [`supabase/schema.sql`](../supabase/schema.sql) and run it. It creates every table, row-level security policy, trigger and function, enables the `vector` extension used for AI search, and includes everything the files in `supabase/migrations/` add. On a fresh project you do not run the migrations.
3. Open **Settings > API** and copy the **Project URL** and the **anon public key**.

Updating an existing installation to a newer dotstell: run any file in `supabase/migrations/` that you have not run yet, in number order. [`CHANGELOG.md`](../CHANGELOG.md) says which release needs one.

## 2. Configure the app

```bash
git clone https://github.com/dotstell/dotstell.git
cd dotstell
pnpm install
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

That is all. dotstell never needs a Supabase service-role key; do not add one. AI provider keys are not server settings: each user adds their own in the app.

## 3. Tell Supabase where the app lives

In Supabase, open **Authentication > URL Configuration**:

- **Site URL**: the address people use, for example `https://notes.example.com` (or `http://localhost:3000` while trying it out)
- **Redirect URLs**: add `https://notes.example.com/auth/callback`

Sign-up confirmation and password-reset emails link back to this address. If you would rather not set up email while testing, turn off **Confirm email** under **Authentication > Providers > Email**.

## 4. Run it

On your own computer or a server:

```bash
pnpm build
pnpm start          # http://localhost:3000
```

Put a reverse proxy such as Caddy or nginx in front of it for HTTPS. `pnpm dev` is for development, not for serving users.

On Vercel: import the repository, set the two environment variables above, and deploy. Any host that runs Next.js 16 works the same way.

Create an account on the running app and you are done.

## Features that need a little more

| Feature | What it needs |
|---|---|
| AI chat, writing, summaries, meetings | Each user opens **AI settings** and adds their own key (OpenAI, Anthropic, Gemini, Groq) or uses Ollama. The server stores no AI keys |
| Semantic search and Related notes | An embedding provider in AI settings (OpenAI, Gemini or Ollama), then **Build search index** |
| Ollama | Ollama on the same machine as the browser. When the app is on `https://`, run the [Local AI Agent](../packages/agent/README.md) (`npx @dotstell/agent`). On `localhost` no agent is needed |
| Dictation, High accuracy | A speech key (OpenAI, Groq or Gemini) in AI settings or in the Meeting recording box. Audio goes from the browser to that service |
| Connect AI tools (MCP) | Nothing extra. Your address plus `/api/mcp` is the server; create a token in the app and see [`MCP.md`](MCP.md) |
| Desktop app | The installers from the releases page load `dotstell.app`, not your server |

The app sends a strict Content-Security-Policy ([`next.config.ts`](../next.config.ts)). If you use an AI service that is not OpenAI, Groq, Gemini or a local Ollama, add its address to `connect-src` there.

## Backups and upgrades

- **Your notes are yours.** In the app, **Import & Export** downloads everything as Markdown, CSV and a full JSON backup. Do this before any upgrade.
- Back up the database as well, with Supabase's backups or `pg_dump`.
- To upgrade: `git pull`, `pnpm install`, run any new migration files in order, then `pnpm build` and restart.

## Security notes

- Keep the anon key public and everything else private: row-level security in the database is what keeps one person's notes from another, so do not disable it or add a service-role key to the app.
- Do not set `NODE_TLS_REJECT_UNAUTHORIZED=0` on a server. It exists only for developers behind a corporate SSL proxy.
- MCP tokens can be revoked by their owner at any time. They are stored only as hashes.
- Report a security problem as described in [`SECURITY.md`](../SECURITY.md).
