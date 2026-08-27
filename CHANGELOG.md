# Changelog

All notable changes to Dotstell are documented here.

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
