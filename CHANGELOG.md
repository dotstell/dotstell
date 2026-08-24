# Changelog

All notable changes to Dotstell are documented here.

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
