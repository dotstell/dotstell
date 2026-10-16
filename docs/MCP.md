# MCP server (design, v0.9.0)

This document describes how dotstell lets AI tools such as Claude Desktop, Claude Code and Cursor read a user's notes through the [Model Context Protocol](https://modelcontextprotocol.io). It is written before the code so the security design can be reviewed first. Status: implemented in v0.9.0.

## Goals

- Let a user ask their own AI assistant questions about their dotstell notes, bookmarks, notebooks, tags, tasks, people, links and meetings.
- Read-only in v0.9.0. Nothing an AI tool does can change or delete data.
- Off by default. Nothing is exposed until the user creates a token.
- Small enough to audit: one HTTP endpoint, one SQL file, a handful of read-only tools.

Non-goals for v0.9.0: writing notes or tasks, semantic (embedding) search, OAuth sign-in for third-party apps, sharing between users.

## How a request flows

```
AI tool --HTTPS, Authorization: Bearer dst_...--> POST /api/mcp (Next.js)
  --> checks size, Origin and rate limit
  --> calls one SQL function with the raw token (anon key, no user session)
  --> the SQL function hashes the token, checks it, and returns only that user's rows
```

dotstell never uses a service-role key. There is no key in the server that can read every user's data.

## Why database functions and not a service-role key

The rest of the app reads data with the signed-in user's session, and row-level security decides what is visible. An AI tool has a token, not a session. The two ways to bridge that:

| | Service-role key on the server | Narrow SQL functions (chosen) |
|---|---|---|
| A leaked server key exposes | every user's data | nothing, no such key exists |
| A missed `user_id` filter in code | exposes another user's data | not possible, the function derives the user from the token |
| What must be reviewed | every query in the route | one SQL file |

## Tokens

- Format: `dst_` followed by 32 random bytes, base64url. The prefix lets secret scanners recognise a leaked token.
- Created by a signed-in user in the app. Shown once, never again.
- Stored as a SHA-256 hash only. The token has 256 bits of randomness, so a fast hash is sufficient and a database leak does not yield usable tokens.
- Each token has a name, a read-only scope, an expiry (default 90 days, maximum one year), and can be revoked instantly.
- The SQL functions receive the raw token and hash it inside the database. A stolen hash is therefore not a credential.
- The user sees, per token: prefix, name, created, last used, request count, and a short activity log (tool name and time, never note contents). Entries are deleted after 30 days.

### Table (migration 012)

`mcp_tokens(id, user_id, name, token_hash unique, prefix, expires_at, revoked_at, last_used_at, use_count, created_at)` and `mcp_token_events(token_id, tool, at)`. Row-level security: users see and revoke only their own rows. Only token creation (a server route using the signed-in session) can insert.

## SQL functions

All are `security definer`, with `set search_path = ''`, execute revoked from `public` and granted only to the roles the endpoint uses. Each begins by validating the token (exists, not revoked, not expired), recording use, and resolving the user. None accepts a user id from the caller.

| Function | Returns |
|---|---|
| `mcp_search_notes(token, query, limit)` | id, title, short excerpt, updated_at; keyword match on title, text and the items of checklist notes |
| `mcp_get_note(token, id)` | one note, as text, with the items of a checklist note |
| `mcp_recent_notes(token, limit)` | newest notes |
| `mcp_list_tasks(token, status, due_before, limit)` | tasks |
| `mcp_list_meetings(token, limit)` | notes tagged `meeting`, with their sections |
| `mcp_list_people(token, query, limit)` / `mcp_get_person` | people and the notes linked to them |
| `mcp_search_bookmarks(token, query, limit)` | bookmarks matching every word of title, address or description |
| `mcp_list_notebooks(token)` | notebooks with how many notes each holds |
| `mcp_list_tags(token, limit)` | tags in use on notes, most used first (notebook tags excluded) |
| `mcp_notes_by_tag(token, tag, limit)` | notes carrying a tag; a notebook name is turned into its tag by the endpoint |
| `mcp_get_links(token, id)` | what a note, person, bookmark or task links to or from, with titles; only the token owner's links and items |

Internal: `mcp_resolve` (checks the token, counts use, records the tool name), `mcp_check_token` (checks without counting) and `mcp_plain` (note text for searching). The first and last are not callable by the public role.

Deleted notes (`deleted_at` set) are never returned. Limits are capped inside the function, not only in the route.

## Endpoint: `/api/mcp`

- Transport: MCP Streamable HTTP, stateless, JSON responses. Methods: `initialize`, `ping`, `tools/list`, `tools/call`. Notifications get 202.
- Request body at most 64 KB. Response at most 100 KB; longer results are cut with a visible notice.
- Rejects requests carrying a browser `Origin` header (DNS-rebinding defence required by the MCP specification). Non-browser MCP clients do not send one.
- Rate limited per token, and per IP for failed authentication.
- Errors never say whether a token exists, only that it is not valid.
- Implemented without a runtime dependency on an MCP library, to keep the audited surface small. A development-only test drives it with the official MCP client to catch protocol drift.

## Content safety (prompt injection)

A note may contain text written to manipulate an assistant, for example from a pasted web page. Mitigations:

1. Read-only: the worst outcome is a misleading answer, never a changed or deleted note.
2. Note text is returned as plain text (HTML removed), inside a clearly marked block, with a server instruction that the content is the user's data and not instructions.
3. No tool returns links to fetch or runs anything.

This reduces the risk; it cannot remove it. The setup page says so.

## Search

Semantic search needs an embedding of the question, and the server never holds the user's AI key (it stays in the browser). v0.9.0 therefore uses keyword search (Postgres full text). Semantic search is a possible later addition, for example by letting the user store a key for this purpose.

## Meetings

Meeting summaries inserted by the assistant are ordinary note HTML. v0.9.0 adds a `meeting` tag when the assistant inserts a summary, and `mcp_list_meetings` returns notes with that tag. Earlier meeting notes can be tagged by the user.

## App changes

- A "Connect AI tools (MCP server)" screen reached from AI Settings and Help: create, copy once, list, revoke (one confirmed step; revoked and expired tokens move to a collapsed list where Remove deletes them), view activity, and a "How to connect each tool" guide that stays available after the token is closed.
- A public setup page with copy-paste configuration for Claude Desktop, Claude Code and Cursor.

## Threat model

| Threat | Handling |
|---|---|
| Token leaked in a repo or chat | `dst_` prefix for scanners; expiry; instant revoke; read-only |
| Database leaked | only hashes stored; functions need the raw token |
| Another user's data returned | user comes from the token inside the database; no user id parameter |
| Brute-forcing tokens | 256-bit tokens; rate limiting; generic errors |
| Malicious website calls the endpoint from a browser | Origin check; no cookies used by this endpoint |
| Malicious note text steers the assistant | read-only; marked as data; documented residual risk |
| Oversized or abusive requests | size caps in route and SQL; per-token rate limit |
| Silent misuse | per-token activity log visible to the user |

Known limits: the in-memory rate limiter resets on cold starts (see `src/lib/ratelimit.ts`); anyone holding the public anon key can call the SQL functions directly, which is why the functions rely on token strength and not on the route alone.

## Setting it up

1. **Database (once per installation).** Run `supabase/migrations/012_mcp.sql` in the Supabase SQL editor. Until then the app works as before and the Connect AI tools (MCP server) screen says MCP is not set up. The endpoint answers 503 in that state.
   - The migration only adds objects (two tables, nine functions, all named `mcp_...`). It does not change or read existing tables or data, and it is safe to run again.
   - Optional check first: `select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto';` should return `extensions` (Supabase's default) or no rows. If it returns another schema, tell us before running; only the MCP functions would be affected.
   - To undo it completely, run `supabase/rollback/012_mcp_down.sql`. Issued tokens stop working; notes, tasks and everything else stay as they are.
2. **Create a token.** AI Settings, Connect AI tools (MCP server), name it, choose an expiry, copy the token once.
3. **Connect a tool** with the setup the screen shows:
   - Claude Code: `claude mcp add --transport http dotstell https://dotstell.app/api/mcp --header "Authorization: Bearer <token>"`
   - Codex (desktop app, CLI and IDE extension share `~/.codex/config.toml`): a `[mcp_servers.dotstell]` table with `url` and `http_headers = { Authorization = "Bearer <token>" }`.
   - Cursor: an entry in `.cursor/mcp.json` with `url` and an `Authorization` header.
   - Claude Desktop: through `mcp-remote` (needs Node.js), with the token in an environment variable.

## What to ask

Say "use dotstell" in the first question so the tool knows where to look. Replace the words in brackets.

- "List my 5 most recent notes."
- "Search my notes for [a word] and tell me the titles." Search matches the words given, so use a word that is in the note.
- "Read my note called [title] and summarise it in 3 bullets."
- "List my notebooks and how many notes each has." / "What tags do I use most?"
- "Show my open tasks and which are due soonest."
- "List my meeting notes, then read the latest and give me its decisions and action items." Meetings are the notes the meeting assistant has tagged `meeting`.
- "Search my bookmarks for [a word]."
- "Who is [a person] in my people, and which notes are linked to them?" / "What is linked to my note called [title]?"

## What has been verified

| Check | Result |
|---|---|
| Migration against a real Postgres (PGlite) with the cut-down schema | Passes, including cross-user, revoked, expired, deleted and permission checks. Removing the user filter from a function makes the tests fail |
| Whole endpoint driven by the official MCP TypeScript client | Passes |
| Claude Code 2.1.299, added with the exact command the screen shows, `claude mcp list` and a real tool call | Connected; a search returned only the signed-in user's matching note |
| Codex CLI 0.162.1, configured with the same `url` and `http_headers` the screen shows, and a real tool call | Connected; a search returned only the signed-in user's matching note. The desktop app and IDE extension read the same file per OpenAI's documentation; the desktop app itself was not run |
| Cursor and Claude Desktop setups | Follow each tool's documented configuration format; not yet run against the real applications |
| Supabase itself (PostgREST calling the functions) | Not run in tests. The first real use after applying the migration is the check |

## Testing

- Unit tests: token creation and hashing, expiry and revoke, size caps, Origin rejection.
- Database tests for each function: wrong token, revoked, expired, deleted notes, another user's data, limit caps.
- Protocol test with the official MCP client.
- A browser test of creating and revoking a token.

## Open questions

- Notebook-limited tokens (a token that can read only chosen notebooks): include in v0.9.0 or v0.9.1.
- Whether to publish the security design on dotstell.com at release.
