# Changelog

All notable changes to Dotstell are documented here.

---

## [v0.8.0] — Oct 2026

### 🎙️ Meetings

- **Meeting assistant** — open a note, press **Meeting**, and paste a transcript or your rough notes (or choose a file). You get a summary, key points, decisions, action items and open questions; edit or remove anything, then insert it into the note
- **Zoom, Teams and Google Meet transcripts** — `.vtt`, `.srt` and `.txt` files are understood, including Zoom's audio-transcript and chat files. Speakers are detected and passed on as attendees. Long meetings are read in parts with a progress bar and a Cancel button
- **Action items become tasks** — tick the ones you want and create them in one click. Owners that match someone in People are linked to them, dates written as `2026-10-30` become due dates, and the tasks are linked back to the note
- **Dictate** — speak and the words are added at the cursor, in 12 languages, using your browser's speech recognition. You are told where the audio goes the first time
- **Record a meeting** — record your microphone, and optionally a shared browser tab for online meetings, and watch the transcript fill in as you go. Speech-to-text uses your own OpenAI or Groq key, sent straight from your browser; dotstell does not receive or keep the audio

### 🛡️ Privacy and safety

- Transcripts are treated as untrusted: markup is stripped, the model's reply is validated, everything written into the note is escaped, and tasks are only created when you press the button
- The microphone is allowed for dotstell only, and the macOS app now declares why it needs it

---

## [v0.7.1] — Oct 2026

A security, reliability and accessibility release. No new screens; everything that was found in a full audit of the app is fixed.

### 🛡️ Security

- **Notes can no longer run scripts** — the Markdown view and the print view now rebuild a note from an allow-list of safe elements instead of removing known-bad ones. Links with `javascript:`, `data:` or disguised schemes, SVG, forms, frames and event handlers are removed
- **Link previews are safer** — fetching a page title for a bookmark refuses private and internal addresses (including addresses a hostile site resolves to), unusual ports, redirects and very large pages, and is rate limited
- **Faster, safer import checks** — the import safety scanner and the bookmark-file reader no longer slow down on crafted input
- **Local AI agent 1.2.0** — it now only answers dotstell.app, dotstell.com and localhost (previously any `*.vercel.app` site could reach it), checks the Host header against DNS-rebinding, and only forwards the endpoints dotstell uses (no model pull, create or delete). Self-hosters add their own address with `DOTSTELL_ALLOWED_ORIGINS`
- **Dependencies updated** — Next.js 16.3.8, Tiptap 3.32 and refreshed transitive packages; the 31 known advisories are down to one in a development-only tool with no fix available

### 🗂️ Your data

- **Deleting a note for good no longer deletes its sub-notes** that you are still using; they move to the top level. Emptying the trash does the same
- **A note can no longer be moved inside itself** or one of its own sub-notes
- **Saving `[[wikilinks]]` can no longer lose existing links** if the save fails part-way
- **Renaming a notebook keeps its notes**; two notebooks whose names differ only by case or spacing are no longer allowed
- Tasks and notebooks reject values the database would refuse, with a clear message instead of a generic error
- Search text with commas or brackets is matched literally

### ♿ Accessibility

- Muted text, section titles and small labels meet the 4.5:1 contrast ratio in all 14 themes (brightness adjusted, colours kept); fading by opacity was removed from small text
- Icon-only buttons and links have names for screen readers (sidebar toggles, drawer close, dashboard quick-add, carousel dots, tablet rail items); links inside sentences are underlined

### 🔧 Fixes

- Export no longer stops on a note that holds a damaged embedded image, and image file names are always plain
- Import copes with very large vCard files and very long Google Keep notes
- The import safety box is titled "Safety checks" and no longer says files were skipped when a note was only made harmless
- The help page now describes accurately how AI keys are handled: stored in your browser, passed through the dotstell server to your provider for each request, never saved or logged

---

## [v0.7.0] — Oct 2026

### 📦 Import & Export

- **New Import & Export page** — one place to bring notes in and take them out, with a side-by-side layout that stacks on phones and tablets
- **Export everything** — one zip of plain files: Markdown notes (notebooks as folders, `[[wikilinks]]`, front matter, tasks and images kept), people, tasks as a checklist and as CSV, bookmarks as a list and as a browser-importable file, and a lossless JSON backup. Built in your browser; nothing is stored on a server
- **Import Markdown** — Obsidian, Notion, Bear, Joplin, Logseq or a dotstell export. Folders become notebooks; tags, dates, aliases, sub-notes, task lists, tables and images are kept and `[[wikilinks]]` still work
- **Import Evernote** (`.enex`), **Google Keep** (Takeout) and **contacts** (`.vcf`, Google or Outlook CSV)
- **Preview first, undo anytime** — see exactly what will be created before anything is saved; one click removes an import afterwards
- **Drag and drop** a zip, files or a whole folder onto the import card

### 🛡️ Safe by design

- Imported files are treated as untrusted: program and script files, images that are not really images, SVGs with scripts, binary files named `.md`, zips inside zips, paths that escape the import, oversized notes and damaged or hostile Evernote files are refused and listed in the preview
- Scripts and `javascript:` links inside notes are made harmless, and you are told when it happens
- The server re-checks every imported note and contact
- Export: spreadsheet cells that start with `=`, `+`, `-` or `@` can no longer run as formulas, and `javascript:` links are no longer exported as clickable bookmarks or links

### 📱 Tablets and phones

- Working tablet rail (expand to the full menu), overlays and colour pickers that stay clear of the rail, focus mode and note panels that respect the sidebar
- The bottom navigation hides while you type, and the editor stays visible when the Android keyboard is up
- Larger touch targets, long email addresses wrap, touch-visible actions on People and notes

---

## [v0.6.0] — Sep 2026

### 🌅 AI Digest & Dashboard

- **AI Digest** — pulls from your notes, open tasks and saved bookmarks to surface insights, relationships and priorities you might otherwise overlook
- **Knowledge Health redesign** — four stat boxes (capture volume, week-over-week trend, unique topics, notes organised %), each with a plain-language explanation
- **Cleanup signals** — stale notes (30+ days), stale bookmarks (90+ days, never revisited) and empty notes
- **AI tag suggestions** — suggest tags for all untagged notes and bookmarks at once
- **Knowledge Connections** and **Connections to explore** — related notes, tasks and bookmarks on the dashboard

### 🛡️ Reliability & security

- Fixed an intermittent "This page couldn't load" error on first load or after a long idle
- Several AI reliability fixes: Related notes shows an error when search fails, notebook summaries cover every note
- Fixed a middleware auth bypass that allowed access during Supabase outages; capped inputs to the AI Write route

---

## [v0.5.1] — Aug 2026

### 🧠 Tasks in AI Chat & Semantic Search

- **Tasks now have vector embeddings** — every task is indexed alongside notes and bookmarks so AI Chat, semantic search, and the Related sidebar all understand your tasks
- **AI Chat RAG context** — tasks are retrieved and injected as context before every chat reply; prompts like "What are my high-priority tasks?" and "What's overdue?" now give accurate, grounded answers
- **Semantic search across everything** — search by meaning, not just keywords; finds relevant notes, tasks, and bookmarks even when exact words don't match
- **Related sidebar** — now surfaces semantically similar tasks alongside notes and bookmarks as you read
- **Browser-side embedding** (Local Agent / Ollama) — tasks are included when building the local search index; dimension validation and `user_id` guard added for defence-in-depth

### 💬 AI Chat improvements

- **Five global prompts** added: "What have I been working on?", "What are my high-priority tasks?", "What's overdue or needs attention?", "Summarise recent activity", "Find connections between my notes"
- Recent tasks now fetched alongside recent notes in the global fallback context
- Welcome message updated to reflect tasks and bookmarks in context

### 🖥️ Desktop builds

- **macOS Intel** build fixed — cross-compiled from Apple Silicon runner; the `macos-13` runner was stalling indefinitely on Rust compilation
- All four platforms now build reliably: macOS Apple Silicon, macOS Intel, Windows, Linux
- Added `timeout-minutes: 60` to all build jobs as a safety net

---

## [v0.5.0] — Aug 2026

### ✍️ AI Writing Assistant

- New **AI Write** button in the note editor toolbar — opens a right-side panel
- **Draft from scratch** (empty notes): choose from 8 starter templates — Outline, Meeting notes, Daily log, Research note, OoO email, Proposal, Status update, Email draft — or enter a custom intent
- **Improve existing content**: five one-click actions — Improve English, Make formal, Make concise, Expand, Full rewrite
- Empty-note hint bar with 5 quick-pick template chips appears when the note is blank — start drafting without opening the full panel
- Results stream live; accept by appending to the note or replacing all content

### ⚙️ AI Settings UX improvements

- **Build search index** button is now disabled until the AI provider and embedding model have been saved — prevents the "index failed" error when clicking the button before configuration was complete
- Fixed **Local Agent** notice link — the "Install Local Agent →" link now renders correctly in the settings modal
- Fixed double-arrow (↗↗) that appeared in some provider error message links

### 🎨 Dashboard light theme

- All dashboard text now uses CSS variables (`var(--foreground)`, `var(--muted-foreground)`) instead of hard-coded dark hex values — dashboard now looks correct on all themes, not just dark

---

## [v0.4.0] — Aug 2026

The AI release — bring your own key and get intelligence across your entire knowledge graph.

### ✨ AI Integration — multi-provider support

- Connect **Ollama** (local), **OpenAI**, **Anthropic**, **Gemini** or **Groq** from the new AI Settings modal (`Ctrl+Shift+,`)
- API keys are stored in your browser only — never sent to our servers
- Per-provider model guidance and a **Recommended** badge in the model picker
- Warning shown when a very large Ollama model is selected (70B+)

### 📊 AI Digest — daily briefing on your dashboard

- New Digest card on the dashboard generates a concise recap of your recent notes, due tasks, idle knowledge and what to focus on
- Choose **Daily** or **Weekly** cadence; regenerate on demand

### 📝 Note, bookmark & notebook summarisation

- Summarise any note in **Bullets**, **Short** or **Detailed** mode from the right sidebar
- Summarise an entire **notebook** (all its notes) via the notebook context menu
- Summarise any **bookmark** inline with a single click

### 🏷️ Smart titles & auto-tags

- Generate a note title from its content with one click in the editor toolbar
- Auto-suggest tags for any note, person, bookmark or task

### 🔗 Related notes

- Semantic search surfaces similar notes to the one you are reading
- Powered by vector embeddings stored in pgvector

### 🌐 Graph intelligence

- **Missing links** — pairs of nodes that mention each other but have no edge
- **Clusters** — natural topic groupings in your graph
- **Knowledge gaps** — areas that have gone stale or underdeveloped
- Accessible via the new AI panel on the Graph page

### 💬 AI Chat with RAG

- Ask questions about your notes; answers are grounded in your actual knowledge base via semantic retrieval
- Available on every note editor page

### 👤 Person intelligence

- AI insights panel on every person page: topics discussed, relationship context, communication patterns

### 🗺️ Navigation

- `G A` — jump to Tags; `G H` — jump to Help (G-key navigation now covers all 8 pages)

### 🎨 Theme fixes

- Replaced all hardcoded dark-only hover colours (`rgba(255,255,255,0.03)`, `#14141f`) with theme-aware `var(--accent)` — all pages now look correct on light themes

---

## [v0.3.0] — Aug 2026

A productivity and safety release — note recovery with 30-day trash, smart paste, table of contents, PDF export, and richer templates.

### 🗑️ Trash — 30-day note recovery

- Deleting a note now moves it to Trash instead of removing it permanently
- **Restore** any trashed note within 30 days from the Trash view in the sidebar
- Notes are **auto-purged** after the 30-day window expires
- **Empty Trash** and **Delete Forever** both require a confirmation dialog so you never lose a note by accident

### 📋 Smart paste

- Pasting from web pages and documents now preserves semantic formatting: headings, bold, italic, lists, and links
- Unsafe elements (scripts, inline styles) are stripped automatically
- Toggle **Rich paste / Plain paste** mode in the toolbar — preference is remembered between sessions

### 🗂️ Table of contents (Outline panel)

- An auto-generated Outline panel appears in the right sidebar of every note, built from your headings (H1–H4)
- Click any entry to scroll to that section instantly
- Collapsible; preference is remembered per-session

### 📄 PDF export

- New **PDF** button in the editor header opens a clean print-ready view
- Use your browser's **Save as PDF** option in the print dialog to export

### 📐 Richer templates with auto-date

- All 9 built-in templates now include structured guidance text, mood/energy indicators, and type selectors
- Today's date is auto-filled when a template is selected — no manual editing required
- Templates include: Meeting notes, 1-on-1, Daily standup, Weekly review, Decision log, Project plan, Bug report, Feedback (SBI), and Blank

### 🔒 Security hardening

- Blocked `javascript:` hrefs in the link dialog and paste path; added Link `validate` callback in the editor
- DNS pre-resolution in the bookmark fetch-meta endpoint to prevent DNS rebinding SSRF
- Rate limits added to bulk-import (5/min) and preview-import (10/min) bookmark endpoints
- Escaped `LIKE` metacharacters (`%`, `_`) in the notes search query to prevent injection
- Enforced 2 MB content size cap on note POST and PATCH routes
- Input validation added across notes, tasks, and people POST routes (title/name required, status/priority enum checks)

---

## [v0.2.2] — Aug 2026

A visual polish and security release — colour-coded notes, a completely redesigned colour picker, smoother drag-to-reorder, and a comprehensive security hardening pass.

### 🎨 Colour picker redesign

- 25-colour swatch grid with a full gradient custom picker
- Your last 5 custom colours are remembered as quick-access swatches
- Highlights show an Aa preview — you see exactly how each looks before applying

### 🏷️ Note & notebook colour labels

- Right-click any note or notebook to assign a colour label
- Notes get a coloured left border and tinted background — visible in both the sidebar and the main grid

### ↕️ Smooth drag-to-reorder (notes)

- Sidebar note reordering rebuilt with pointer-based drag — no more accidental single-click moves
- Works precisely on trackpads and touch screens

### 🔒 Security hardening

- Fixed IPv6-mapped SSRF bypass, ILIKE pattern injection, missing rate limits on write routes, and OTP type validation
- HSTS extended to all routes

### 🛠️ Stability fixes

- Resolved React hydration mismatches on the tab bar and dashboard greeting
- Fixed Content Security Policy for Google Fonts and Cloudflare Insights

---

## [v0.2.1] — Aug 2026

### 🎉 Onboarding flow

- A guided 3-step welcome for first-time users — creates your first note and gets you into the graph immediately

### 🔔 Task reminders

- Browser notifications when a task is due within 15 minutes
- Set a date and time — Dotstell reminds you automatically

### 🔗 Unlinked mentions

- The backlinks panel now shows notes that mention your note's title as plain text
- One click converts them into a formal [[wikilink]]

### ⏱️ Note status bar

- Word count, character count, and read time in a clean status bar at the bottom of every note — plus a save indicator

### 🕐 Task due time

- Task due dates now include time — set both date and time from the same picker

### ⚡ Live wikilinks panel

- The Links / Linked from panel refreshes instantly after saving — no page reload needed

---

## [v0.2.0] — Aug 2026

### 🗂️ Notebooks

- Organise notes into named collections
- Collapsible sidebar, drag to reorder, pin important notes to the top

### 🗃️ Note tabs

- Open multiple notes at once in a tab bar
- Tabs persist across refresh — middle-click to close

### 📝 Sub-notes

- Nest notes under a parent for hierarchical organisation — ideal for projects and meeting series

### 🎨 12 themes

- Six new themes: Dotstell Light, Pure Light, Catppuccin Latte, Rosé Pine Dawn, Gruvbox Light, Catppuccin Mocha

### 📤 Export to Markdown

- Download any note as a `.md` file in one click

### 🔒 Security hardening

- Fixed mass-assignment, SSRF, and auth gaps
- Rate limiting added on all write routes
- Error messages sanitised

---

## [v0.1.0] — Aug 2026 — Initial release

### ✍️ Rich text notes

- Full editor with slash commands, tables, code blocks, task lists, and [[wikilinks]] between notes

### 🌐 Knowledge graph

- Visual graph of all linked notes — click any node to navigate
- Backlinks tracked automatically

### 👥 People

- Track contacts and collaborators
- Attach notes, tasks, and context to any person

### ✅ Tasks

- Kanban board with priorities, due dates, and status tracking
- Attach tasks to people

### 🔖 Bookmarks

- Save any URL — title, description and favicon fetched automatically
- Tag and search

### 🔍 Universal search

- Ctrl+K command palette — search notes, tasks, bookmarks and people in one place
