'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/AppLayout'
import { RELEASES_URL } from '@/lib/version'

// ── primitives ──────────────────────────────────────────────────────────────

function Kbd({ children }: { children: string }) {
  return (
    <kbd style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: '1px 6px', borderRadius: 5,
      border: '1px solid var(--border)',
      backgroundColor: 'var(--muted)',
      color: 'var(--muted-foreground)',
      fontSize: 11, fontFamily: 'monospace', fontWeight: 600, lineHeight: 1.7,
    }}>
      {children}
    </kbd>
  )
}

function Keys({ keys }: { keys: string[] }) {
  return (
    <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
      {keys.map((k, i) => (
        <span key={i} style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
          {i > 0 && <span style={{ color: 'var(--muted-foreground)', fontSize: 10 }}>+</span>}
          <Kbd>{k}</Kbd>
        </span>
      ))}
    </span>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} style={{ marginBottom: 48, scrollMarginTop: 24 }}>
      <h2 style={{
        fontSize: 16, fontWeight: 600, color: 'var(--foreground)',
        margin: '0 0 16px', paddingBottom: 10,
        borderBottom: '1px solid var(--border)',
      }}>
        {title}
      </h2>
      {children}
    </section>
  )
}

function Tip({ icon, title, body }: { icon: string; title: string; body: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: 14, padding: '13px 15px',
      borderRadius: 10, border: '1px solid var(--border)',
      backgroundColor: 'var(--muted)', marginBottom: 8,
    }}>
      <span style={{ fontSize: 20, lineHeight: 1.5, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.65 }}>{body}</div>
      </div>
    </div>
  )
}

function Tag({ children }: { children: string }) {
  return (
    <span style={{
      display: 'inline-block', padding: '1px 8px', borderRadius: 20,
      backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)',
      border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
      color: 'var(--primary)', fontSize: 11, fontWeight: 500,
    }}>{children}</span>
  )
}

// ── TOC ─────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'getting-started',  label: '🧭 Getting started' },
  { id: 'dashboard',        label: '🏠 Dashboard' },
  { id: 'notes',            label: '📑 Notes' },
  { id: 'editor',           label: '✏️ Note editor' },
  { id: 'wikilinks',        label: '⬡ Wikilinks & backlinks' },
  { id: 'people',           label: '👥 People & 1-on-1s' },
  { id: 'bookmarks',        label: '🔖 Bookmarks' },
  { id: 'tasks',            label: '✅ Tasks' },
  { id: 'graph',            label: '🌐 Knowledge graph' },
  { id: 'ai',               label: '✨ AI features' },
  { id: 'tags',             label: '🏷️ Tags' },
  { id: 'search',           label: '🔍 Search & command palette' },
  { id: 'shortcuts',        label: '⌨️ Keyboard shortcuts' },
  { id: 'whats-new',        label: '✨ Changelog' },
]

// ── page ─────────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sectionContent = useMemo(() => (
    <div style={{ maxWidth: 660 }}>

            {/* GETTING STARTED */}
            <Section id="getting-started" title="🧭 Getting started">
              <Tip icon="1️⃣" title="Create your first note"
                body={<>Head to <Link href="/notes" style={{ color: 'var(--primary)' }}>Notes</Link> and click <strong>New note</strong>. Pick a template or start blank. Your note auto-saves as you type — the green dot in the top-right confirms it.</>}
              />
              <Tip icon="2️⃣" title="Connect it to something"
                body={<>Inside any note, type <Kbd>[[</Kbd> and start typing to link to another note. This is the core idea: connections between things reveal what no single item could tell you alone.</>}
              />
              <Tip icon="3️⃣" title="Link notes to people, tasks and bookmarks"
                body={<>Open any note and click <strong>Link item</strong> in the right panel to attach it to a person, task or bookmark. You can also connect items directly from the <Link href="/graph" style={{ color: 'var(--primary)' }}>Graph</Link> view. Once linked, open a person&apos;s profile and you&apos;ll see every note, task and bookmark connected to them in one place — no searching across apps.</>}
              />
              <Tip icon="4️⃣" title="Watch the graph build itself"
                body={<>Open <Link href="/graph" style={{ color: 'var(--primary)' }}>Graph</Link> after adding a few linked notes. Every connection you create appears as an edge — the picture that was invisible across separate tools becomes visible.</>}
              />
            </Section>

            {/* DASHBOARD */}
            <Section id="dashboard" title="🏠 Dashboard">
              <Tip icon="📊" title="Live stats and sparklines"
                body="Four stat cards at the top show your note count, people, bookmarks, and open task count — each with a 7-day sparkline trend. The tasks card turns red when you have overdue items."
              />
              <Tip icon="⚠️" title="Overdue alert banner"
                body="If any task is past its due date, an alert banner appears below the stat cards with a direct link to view and resolve those tasks."
              />
              <Tip icon="📋" title="Task progress bar"
                body="Below the stats, a progress bar shows your overall task completion broken down by status: to do / in progress / done / overdue."
              />
              <Tip icon="⚡" title="Quick actions"
                body={<>A row of quick action buttons lets you create a new note, add a person, add a task, or save a bookmark without navigating away. The same actions are available via <Keys keys={['Ctrl', 'K']} />.</>}
              />
              <Tip icon="🕐" title="Activity feed"
                body="The bottom of the dashboard shows your last 12 activities across 7 days — notes edited, bookmarks saved, tasks completed."
              />
              <Tip icon="✨" title="AI Knowledge Digest"
                body="When AI is configured, an AI Digest card appears on the dashboard. Choose Today or This Week and click Generate — the AI summarises your recent note activity into a concise digest. Regenerate at any time."
              />
            </Section>

            {/* NOTES LIST */}
            <Section id="notes" title="📑 Notes">
              <Tip icon="🔲" title="Grid and list view"
                body="Toggle between grid (card) and list view using the icons in the top-right of the Notes page. Your preference is remembered."
              />
              <Tip icon="🗂️" title="Filter by type"
                body="Use the type tabs to filter: All / Rich text / Plain / Checklist. Checklists are notes that start with a task list — useful for meeting notes and action items."
              />
              <Tip icon="↕️" title="Sort and group"
                body="Sort by Last edited, Date created, Title A-Z, or Manual order. Enable Group by tag to collapse notes into tag groups — notes without a tag go to an Untagged group at the bottom."
              />
              <Tip icon="📌" title="Pinning notes"
                body="Pin any note to keep it at the top of the list. Hover a card and click the pin icon that appears, or right-click and choose Pin note. Pinned notes are shown with a subtle highlight and float above unpinned notes in every sort mode."
              />
              <Tip icon="↕️" title="Drag to reorder"
                body={<>Switch to <strong>Manual order</strong> from the sort menu, then drag and drop any card to rearrange notes. Your order is saved to the server so it persists across devices and sessions. Pinned notes always stay at the top within the manual order.</>}
              />
              <Tip icon="🖱️" title="Right-click context menu"
                body={<>Right-click any note card or row to open a context menu with: <strong>Pin / Unpin</strong>, <strong>Move to notebook</strong> (reassigns the note to a different notebook), <strong>Duplicate note</strong> (creates a copy with "(copy)" appended), and <strong>Delete</strong>.</>}
              />
              <Tip icon="📓" title="Notebooks"
                body="Notebooks are displayed in the left sidebar of the Notes page. Every notebook shows a note count badge. Create notebooks via the + button next to the Notebooks header, drag notebooks to reorder them, and right-click to rename or delete. Notes can belong to one notebook at a time."
              />
              <Tip icon="🔍" title="Live search"
                body="The search bar on the Notes page filters by title and content in real time as you type. For searching across all content types at once, use Ctrl+K."
              />
              <Tip icon="🗑" title="Trash & recovery"
                body={<>Deleted notes go to <strong>Trash</strong> instead of being removed immediately. Click the <strong>Trash</strong> button in the Notes header to open the trash view. Each note shows how many days remain before it is permanently deleted (30-day window). Restore a note with one click, or delete it forever. Empty Trash removes everything at once. Notes that pass the 30-day limit are auto-purged when the trash is next opened.</>}
              />
            </Section>

            {/* EDITOR */}
            <Section id="editor" title="✏️ Note editor">
              <Tip icon="💾" title="Auto-save indicator"
                body="The small dot next to the note title shows save state: green = saved, amber = saving, red = error. You never need to save manually."
              />
              <Tip icon="🎯" title="Focus mode"
                body="Click the expand icon in the toolbar (or the button in the top-right) to enter focus mode — the sidebar and header disappear and the note fills the screen. Click the same button to exit."
              />
              <Tip icon="📐" title="Templates"
                body={<>A template picker opens automatically for every new note. Reopen it any time via the <strong>Templates</strong> button in the toolbar. Nine built-in templates: <strong>Meeting notes</strong>, <strong>1-on-1</strong>, <strong>Daily standup</strong>, <strong>Weekly review</strong>, <strong>Decision log</strong>, <strong>Project plan</strong>, <strong>Bug report</strong>, <strong>Feedback (SBI)</strong>, and <strong>Blank</strong>. All templates auto-fill today's date and include guidance text inside each section so you know what to write.</>}
              />
              <Tip icon="/" title="Slash commands"
                body={<>Type <Kbd>/</Kbd> anywhere in the editor to open the command menu. Available blocks: Heading 1/2/3 · Bullet list · Numbered list · Checklist · Quote · Code block · Callout (💡 Info or ⚠️ Warning) · Divider · Table · Image</>}
              />
              <Tip icon="🔤" title="Rich text toolbar"
                body={<>The full toolbar provides: Heading levels · <strong>Font family</strong> (16 options including System, Serif, Mono, Handwritten) · Bold · Italic · Underline · Strikethrough · Inline code · Superscript/Subscript · <strong>Text colour</strong> (25 presets + custom gradient picker) · <strong>Highlight</strong> (9 colours + None) · Alignment · Lists · Quote · Code block · Table · Image · Link · Markdown mode</>}
              />
              <Tip icon="🎨" title="Text colour & highlight picker"
                body="Click the T (text colour) or highlighter icon in the toolbar to open a colour swatch grid. Choose from 25 preset colours or click the palette icon to pick any custom colour with a full gradient picker. Your last 5 custom colours are remembered and shown as quick-access swatches. Highlight colours show an Aa preview so you see exactly how each looks before applying."
              />
              <Tip icon="🏷️" title="Note colour labels"
                body="Right-click any note in the sidebar or grid to set a colour label — choose from Red, Orange, Yellow, Green, Teal, Blue, Purple, or Pink. A coloured left border and tinted background make colour-coded notes immediately visible. Right-click and select the active colour again to clear it."
              />
              <Tip icon="📝" title="Markdown source mode"
                body="Click the Markdown button in the toolbar to switch to raw Markdown editing with a cheatsheet bar. Click Rich text to convert back. Useful for pasting content from other apps."
              />
              <Tip icon="📋" title="Smart paste"
                body={<>The toolbar has a <strong>Rich paste / Plain paste</strong> toggle. In <strong>Rich paste</strong> mode (default), pasting HTML content from a web page or document preserves headings, bold, lists, and links — stripping only unsafe formatting. In <strong>Plain paste</strong> mode, everything is stripped to bare text. Your preference is remembered between sessions.</>}
              />
              <Tip icon="🗂" title="Table of contents (Outline)"
                body={<>The right panel of any note shows an <strong>Outline</strong> section that auto-generates a table of contents from all headings in the note (H1–H4). Click any heading in the outline to scroll directly to that section. The panel is collapsible — your preference is remembered. The outline updates live as you write.</>}
              />
              <Tip icon="⬇️" title="Export as Markdown or PDF"
                body={<>Use the <strong>.md</strong> button in the editor header to export as a Markdown file. Use the <strong>PDF</strong> button to open a print-ready version of the note in a new tab and trigger the browser's print dialog — choose <em>Save as PDF</em> for a clean export. Both options are available in the editor header toolbar.</>}
              />
              <Tip icon="🌳" title="Sub-notes"
                body="The right panel of any note includes a Sub-notes section. Create child notes that are automatically linked to the parent. Navigate the hierarchy using the breadcrumb at the top of the note."
              />
              <Tip icon="📊" title="Word count and reading time"
                body="The status bar at the bottom of the editor shows live word count, character count, and estimated reading time."
              />
              <Tip icon="✨" title="AI: Inline Assist (selection bubble)"
                body="Select any text in the editor — a small AI bubble appears above your selection. Click it to choose an operation: Fix grammar · Rewrite · Expand · Shorten · Convert to outline · Convert to checklist · Explain. The result streams into a panel; accept it to replace your selection or go back to choose another operation."
              />
              <Tip icon="✨" title="AI: Smart title"
                body="After writing 30+ characters, a sparkle button appears next to the title input. Click it to auto-generate a concise 3–8 word title from the note content. If you've started typing a title it uses that as a hint."
              />
              <Tip icon="✨" title="AI: Auto-tagging"
                body="The AI Tags sparkle button (appears after 30+ characters) suggests relevant kebab-case tags based on the note content. Tags you already have are excluded. Accept individual chips or dismiss ones you don't want."
              />
              <Tip icon="✨" title="AI: Note summary"
                body="The right sidebar of any note includes a Summarize section. Click Summarize to get a bullet-point summary of the note. A refresh button regenerates it at any time."
              />
            </Section>

            {/* WIKILINKS */}
            <Section id="wikilinks" title="⬡ Wikilinks & backlinks">
              <Tip icon="⬡" title="Creating a wikilink"
                body={<>Type <Kbd>[[</Kbd> inside any note to open a live note-search picker. Type part of a note title and select it — or type a new name and press Enter to create a new note and link to it in one step.</>}
              />
              <Tip icon="↩️" title="Backlinks panel"
                body="Every note shows a Backlinks panel in its right sidebar. It lists every other note that links to this one via [[wikilink]] syntax. Backlinks update automatically — you never need to manage them manually."
              />
              <Tip icon="ℹ️" title="Links are always intentional"
                body={<>dotstell does <strong>not</strong> automatically create links when you type words that match other note titles. Every link is created explicitly — either by typing <Kbd>[[</Kbd> or by using the Link panel. This keeps your graph meaningful: an edge only exists because you decided it should.</>}
              />
              <Tip icon="🔗" title="Manual cross-type links"
                body="Use the Link panel (right sidebar of any note) to manually connect the note to a person, task, or bookmark. These links also appear as edges in the Knowledge Graph. You can link any two items together across types."
              />
            </Section>

            {/* PEOPLE */}
            <Section id="people" title="👥 People & 1-on-1s">
              <Tip icon="👤" title="Contact fields"
                body="Each person stores: name, role, company, email, phone, and tags. You can edit all fields at any time via the edit icon on the contact card."
              />
              <Tip icon="📋" title="Person detail page"
                body="Click a person's name to open their detail page. It shows their full profile, all 1-on-1 notes attached to them, and all tasks in their context."
              />
              <Tip icon="📝" title="1-on-1 notes"
                body="On a person's detail page, the 1-on-1 Notes section lets you write notes scoped to that person — meeting notes, decisions, context from conversations. Each note is linked to the person automatically."
              />
              <Tip icon="🔗" title="Attaching existing notes to a person"
                body={<>Open any note and use the Link panel (right sidebar) to connect it to a person. Alternatively, use <Kbd>[[</Kbd> to wikilink the person's name inside the note.</>}
              />
              <Tip icon="🏷️" title="Tags on people"
                body="Tag your contacts (e.g. Manager, Client, Mentor) to group them. Tags are searchable and filter across all content types via the Tags page."
              />
            </Section>

            {/* BOOKMARKS */}
            <Section id="bookmarks" title="🔖 Bookmarks">
              <Tip icon="⚡" title="Quick capture"
                body="Paste any URL into the input bar at the top of the Bookmarks page and press Enter. Title, description, favicon, hostname, and estimated reading time are fetched automatically."
              />
              <Tip icon="🖱️" title="Drag and drop"
                body="Drag a URL directly from your browser's address bar (or any link) and drop it onto the Bookmarks page. It saves instantly."
              />
              <Tip icon="📥" title="Bulk import from browser"
                body="Export your bookmarks from Chrome, Firefox, or Edge as an HTML file, then use the Import button on the Bookmarks page. A folder-selection preview lets you choose which folders to import. Duplicates are detected and skipped."
              />
              <Tip icon="🗂️" title="Collections view"
                body="Toggle to Collections view to see your bookmarks grouped by tag — useful when you have many bookmarks across different topics."
              />
              <Tip icon="✔️" title="Bulk select and delete"
                body="Enable bulk select mode (checkbox icon in the toolbar) to select multiple bookmarks at once and delete them in one action."
              />
              <Tip icon="🕐" title="Recently visited"
                body="The top of the Bookmarks page shows your 6 most recently visited bookmarks with timestamps, so you can quickly return to what you were reading."
              />
              <Tip icon="🏷️" title="Manage tags"
                body="Open Manage Tags from the toolbar to rename or delete a tag across all bookmarks at once. Sort tags by usage, alphabetically, or by last saved."
              />
              <Tip icon="✨" title="AI: Bookmark summary"
                body="When AI is configured, a sparkle (✨) button appears on each bookmark card. Click it to expand an inline AI bullet summary. Click again to collapse. A regenerate button re-runs the summary."
              />
            </Section>

            {/* TASKS */}
            <Section id="tasks" title="✅ Tasks">
              <Tip icon="📋" title="Board and list view"
                body="Switch between Kanban board (three columns: To Do / In Progress / Done) and list view using the toggle at the top-right of the Tasks page."
              />
              <Tip icon="🎯" title="Priority levels"
                body="Tasks have three priority levels — low (blue), medium (amber), high (red) — shown as colour-coded badges. High-priority overdue tasks surface prominently in the dashboard."
              />
              <Tip icon="📅" title="Due dates and overdue alerts"
                body="Set a due date and time on any task. Overdue tasks are highlighted in red in the list view, appear in the dashboard alert banner, and trigger browser notification reminders."
              />
              <Tip icon="🏷️" title="Tags on tasks"
                body="Tag tasks to group them by theme or project. Tagged tasks are findable across all content types via the Tags page."
              />
              <Tip icon="➕" title="Adding tasks from the board"
                body="In board view, each column has a + Add task button at the bottom that creates a task with the correct status pre-set."
              />
              <Tip icon="🔔" title="Task reminders"
                body="The app fires browser-native reminder notifications for upcoming and overdue tasks. You can dismiss individual reminders — they won't resurface unless the due date changes."
              />
            </Section>

            {/* GRAPH */}
            <Section id="graph" title="🌐 Knowledge graph">
              <Tip icon="🎨" title="Node colours"
                body="Every node in the graph is colour-coded by content type so you can see at a glance what you're looking at — notes, people, bookmarks, and tasks each have a distinct colour."
              />
              <Tip icon="🔭" title="Filter by type"
                body="Use the filter tabs at the top of the Graph page to show only a specific type (Notes, People, Bookmarks, Tasks). Hiding unneeded types makes dense graphs easier to read."
              />
              <Tip icon="🖱️" title="Navigation"
                body="Scroll to zoom. Click and drag the canvas to pan. Click a node to open a detail panel on the right showing its title, tags, outgoing links, and incoming links. Double-click a node to open the full item."
              />
              <Tip icon="🔗" title="Creating links visually"
                body="Drag from the handle that appears on a node when you hover it, and drop it onto another node to create a manual link. The link is saved immediately and appears in both nodes' Link panels."
              />
              <Tip icon="❌" title="Deleting links"
                body="Click the × button that appears on any edge to delete that link. This removes it from both the graph and the Link panels on both connected items."
              />
              <Tip icon="🗺️" title="Minimap and layout reset"
                body="A minimap in the bottom-right helps you navigate large graphs. Node positions are saved between sessions. If the layout gets messy, click Reset layout to reposition all nodes in a clean grid."
              />
              <Tip icon="✨" title="AI: Graph intelligence"
                body="When AI is configured, an AI button appears in the graph toolbar. Click it to open the Graph Intelligence panel with three modes — Missing links (semantically similar notes with no wikilink between them), Note clusters (orphaned notes grouped by topic), and Gap detection (notes that share many neighbours but no direct connection). Click any note button in the results to open it."
              />
            </Section>

            {/* AI */}
            <Section id="ai" title="✨ AI features">
              <Tip icon="⚙️" title="Setting up AI"
                body={<>Click the <strong>AI status badge</strong> in the top-right nav (shows an orange dot when unconfigured) or press <Keys keys={['Ctrl', 'Shift', ',']} /> to open AI Settings. Choose a provider — Ollama (local, free), OpenAI, Anthropic, Google Gemini, or Groq. Enter your API key, pick a model, and optionally configure an embedding provider for semantic search features. All keys are stored locally in your browser — they are never sent to dotstell servers.</>}
              />
              <Tip icon="🔌" title="Ollama on the live app — Local AI Agent"
                body={<>When using <strong>Ollama</strong> from <strong>dotstell.app</strong> (the hosted version), browsers block direct connections to localhost for security reasons (Private Network Access spec). Run the <strong>Dotstell Local AI Agent</strong> to bridge the gap — it's a tiny Node.js proxy that adds the required headers and forwards requests to your local Ollama. First make sure Ollama is running (on Windows it usually auto-starts — check the system tray). Then start the agent with: <code style={{ fontSize: 11, backgroundColor: 'rgba(0,0,0,0.15)', padding: '1px 5px', borderRadius: 3 }}>npx @dotstell/agent</code> (no install needed — runs directly via npx). The AI Settings modal shows a green <strong>"Local Agent is running"</strong> badge when detected. You do not need the agent when running dotstell locally at localhost:3000.</>}
              />
              <Tip icon="💬" title="AI Chat"
                body="Open AI Chat from the note editor toolbar. In This note mode the chat is scoped to the current note. In All knowledge mode it searches your notes, tasks, and bookmarks for each question. RAG can be toggled off for direct model answers. New items are indexed automatically — you only need to run Build search index once for existing content."
              />
              <Tip icon="👤" title="Person intelligence"
                body="Switch to the People tab in the AI Chat panel and type a name. The AI searches across all your notes and bookmarks for mentions, then generates a structured brief — role, key topics, last mentioned. Useful before meetings or when picking up an old context."
              />
              <Tip icon="🖊️" title="Inline Assist"
                body="Select text in any note — a small AI bubble appears above the selection. Click it to choose: Fix grammar · Rewrite · Expand · Shorten · Convert to outline · Convert to checklist · Explain. The result streams live; accept to replace your selection or go back to pick another operation."
              />
              <Tip icon="🏷️" title="Smart title & auto-tagging"
                body="After writing 30+ characters in a note, two AI buttons appear: a title suggester (fills the title field with a specific 3–8 word title from the content) and an AI tags button (suggests kebab-case tags, skipping ones already applied). Accept or dismiss individual tag chips."
              />
              <Tip icon="📋" title="Summaries"
                body={<>Summaries are available in three places: <strong>Notes</strong> — click Summarize in the right sidebar; <strong>Bookmarks</strong> — click the ✨ button on any bookmark card; <strong>Notebooks</strong> — right-click any notebook in the sidebar and choose Summarize notebook. All summaries use bullet points and can be regenerated.</>}
              />
              <Tip icon="📊" title="AI Digest"
                body="The dashboard AI Digest card summarises your recent note activity. Choose Today or This Week and click Generate. Useful for a quick review of what you've been working on."
              />
              <Tip icon="🔎" title="Related items (semantic search)"
                body="The Related Items panel in the note editor right sidebar uses vector embeddings to find semantically similar notes and tasks — not just keyword matches. Requires an embedding provider configured in AI Settings. Click Build search index in AI Settings to index all existing content."
              />
              <Tip icon="🌐" title="Graph intelligence"
                body="The Graph page AI panel (click the AI button in the toolbar) provides three analyses: Missing links surfaces highly similar unlinked note pairs; Note clusters groups orphaned notes by topic; Gap detection finds note pairs sharing many neighbours but no direct bridge — a candidate for a new connecting note."
              />
              <Tip icon="✨" title="AI Inline Assist — Ctrl+Space"
                body={<>Inside the note editor, press <Keys keys={['Ctrl', 'Space']} /> to trigger inline AI. <strong>With text selected</strong>: a floating panel appears with seven actions — Rewrite, Expand, Shorten, Fix grammar, Make outline, Extract tasks, and Explain. The result streams live; click <em>Replace</em> to swap the selection or <em>Insert</em> to add the result after it. <strong>Without a selection</strong>: AI reads the text before your cursor and continues writing in the same style. You can also click the <strong>✨ AI Assist</strong> bubble that appears above any selection.</>}
              />
              <Tip icon="✍️" title="AI Writing Assistant"
                body={<>Click the <strong>AI Write</strong> button (pen icon) in the note toolbar to open the Writing Assistant panel. On an <strong>empty note</strong>, choose from eight starter templates — Outline, Meeting notes, Daily log, Research note, OoO email, Proposal, Status update, or Email draft — or describe your intent in the custom field. On a <strong>note with existing content</strong>, pick an improve action: Improve English, Make formal, Make concise, Expand, or Full rewrite. Results stream live; choose to <em>append</em> to the note or <em>replace</em> all content. When a note is blank, quick-pick chips also appear inline so you can start without opening the panel.</>}
              />
              <Tip icon="🔒" title="Privacy"
                body="Your API keys are stored only in your browser's localStorage — they leave your device only as part of TLS-encrypted requests to your chosen AI provider (OpenAI, Anthropic, etc.), never to dotstell servers. Choosing Ollama keeps everything 100% local."
              />
            </Section>

            {/* TAGS */}
            <Section id="tags" title="🏷️ Tags">
              <Tip icon="🗂️" title="Cross-type tag browser"
                body={<>The <Link href="/tags" style={{ color: 'var(--primary)' }}>Tags page</Link> has a left panel listing all your tags sorted by item count. Click any tag to see every item with that tag — notes, people, bookmarks, and tasks — all in one place.</>}
              />
              <Tip icon="🔍" title="Searching within a tag"
                body="Once you select a tag, a search bar in the right panel lets you filter items within that tag. Click any item to navigate directly to it."
              />
              <Tip icon="🏷️" title="Consistent tags across all content"
                body="Tags work the same way on notes, people, bookmarks, and tasks. A tag called 'Q3 OKRs' will surface all four types of content with that tag on the Tags page."
              />
            </Section>

            {/* SEARCH */}
            <Section id="search" title="🔍 Search & command palette">
              <Tip icon="⌨️" title="Command palette — Ctrl+K"
                body={<>Press <Keys keys={['Ctrl', 'K']} /> (or <Keys keys={['Cmd', 'K']} /> on Mac) from anywhere in the app. When empty it shows quick navigation shortcuts. Type 2+ characters to search across all content types at once.</>}
              />
              <Tip icon="⚡" title="G-key navigation"
                body={
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>Press <Kbd>G</Kbd> from anywhere in the app (not while typing), then press a second key to jump to any of the 8 sections. A small hint badge appears at the bottom-right to confirm the first key was registered.</span>
                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                      <Tag>G D — Dashboard</Tag>
                      <Tag>G N — Notes</Tag>
                      <Tag>G P — People</Tag>
                      <Tag>G B — Bookmarks</Tag>
                      <Tag>G T — Tasks</Tag>
                      <Tag>G G — Graph</Tag>
                      <Tag>G A — Tags</Tag>
                      <Tag>G H — Help</Tag>
                    </span>
                  </span>
                }
              />
              <Tip icon="🔍" title="Universal search page"
                body={<>The <Link href="/search" style={{ color: 'var(--primary)' }}>Search page</Link> (accessible via the sidebar search bar) lets you search across all content types simultaneously. Results show type icons so you know immediately what kind of item matched.</>}
              />
            </Section>

            {/* SHORTCUTS */}
            <Section id="shortcuts" title="⌨️ Keyboard shortcuts">
              {[
                { category: 'Global', rows: [
                  { keys: ['Ctrl', 'K'],   desc: 'Open command palette / universal search' },
                  { keys: ['Ctrl', 'N'],   desc: 'Create a new note (from within notes area)' },
                  { keys: ['G', 'D'],      desc: 'Go to Dashboard' },
                  { keys: ['G', 'N'],      desc: 'Go to Notes' },
                  { keys: ['G', 'P'],      desc: 'Go to People' },
                  { keys: ['G', 'B'],      desc: 'Go to Bookmarks' },
                  { keys: ['G', 'T'],      desc: 'Go to Tasks' },
                  { keys: ['G', 'G'],      desc: 'Go to Graph' },
                  { keys: ['G', 'A'],      desc: 'Go to Tags' },
                  { keys: ['G', 'H'],      desc: 'Go to Help' },
                ]},
                { category: 'Note editor', rows: [
                  { keys: ['F'],                   desc: 'Toggle focus / distraction-free mode (when not typing in the editor)' },
                  { keys: ['Ctrl', 'Space'],       desc: 'AI Inline Assist — rewrite / expand / continue writing' },
                  { keys: ['Ctrl', 'Shift', ','],  desc: 'Open AI Settings' },
                  { keys: ['/'],                   desc: 'Open slash command menu' },
                  { keys: ['[['],                  desc: 'Insert a wikilink' },
                  { keys: ['Ctrl', 'B'],           desc: 'Bold' },
                  { keys: ['Ctrl', 'I'],           desc: 'Italic' },
                  { keys: ['Ctrl', 'U'],           desc: 'Underline' },
                  { keys: ['Ctrl', 'Shift', 'X'],  desc: 'Strikethrough' },
                  { keys: ['Ctrl', '`'],           desc: 'Inline code' },
                  { keys: ['Ctrl', 'Z'],           desc: 'Undo' },
                  { keys: ['Ctrl', 'Shift', 'Z'],  desc: 'Redo' },
                ]},
                { category: 'Navigation', rows: [
                  { keys: ['↑ / ↓'],              desc: 'Navigate items in command palette, slash menu, wikilink picker' },
                  { keys: ['Enter'],               desc: 'Select highlighted item in any picker' },
                  { keys: ['Esc'],                 desc: 'Close any floating menu, palette, or dialog' },
                ]},
              ].map(({ category, rows }) => (
                <div key={category} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>{category}</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <tbody>
                      {rows.map(({ keys, desc }) => (
                        <tr key={desc} style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 50%, transparent)' }}>
                          <td style={{ padding: '9px 0', whiteSpace: 'nowrap', width: 200 }}>
                            <Keys keys={keys} />
                          </td>
                          <td style={{ padding: '9px 0 9px 12px', color: 'var(--muted-foreground)' }}>{desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </Section>

            {/* WHAT'S NEW */}
            <Section id="whats-new" title="✨ Changelog">

              {/* v0.5.1 */}
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)', padding: '3px 10px', borderRadius: 99 }}>v0.5.1</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', padding: '2px 8px', borderRadius: 99 }}>Latest</span>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Aug 2026</span>
                </div>
                <Tip icon="🧠" title="Tasks in AI Chat, semantic search, and Related"
                  body="Tasks now have vector embeddings — they appear in AI Chat RAG context, semantic search results, and the Related Items sidebar alongside notes and bookmarks. Build search index now indexes notes, bookmarks, and tasks together. New items are automatically indexed as you create them. Switching embedding provider re-indexes everything automatically for cloud providers."
                />
              </div>

              {/* v0.5.0 */}
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)', padding: '3px 10px', borderRadius: 99 }}>v0.5.0</span>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Aug 2026</span>
                </div>
                <Tip icon="✍️" title="AI Writing Assistant"
                  body={<>New <strong>AI Write</strong> button in the note toolbar. On empty notes, draft from scratch using 8 starter templates (Outline, Meeting notes, Daily log, Research note, OoO email, Proposal, Status update, Email draft) or a custom prompt. On notes with content, improve it with one-click actions: Improve English, Make formal, Make concise, Expand, or Full rewrite. Results stream live; append to or replace the note. Quick-pick chips on blank notes let you start without opening the panel.</>}
                />
                <Tip icon="⚙️" title="AI Settings UX improvements"
                  body="Build search index button is now disabled until your AI provider and embedding model are saved — prevents index errors on unconfigured setups. Fixed the Local Agent notice link and the double-arrow (↗↗) bug in provider error messages."
                />
                <Tip icon="🎨" title="Dashboard light theme"
                  body="All dashboard text now uses CSS variables instead of hard-coded dark hex values — the dashboard now looks correct on light themes and every other theme."
                />
              </div>

              {/* v0.4.0 */}
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)', padding: '3px 10px', borderRadius: 99 }}>v0.4.0</span>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Aug 2026</span>
                </div>
                <Tip icon="✨" title="Complete AI integration"
                  body="Full AI layer across the product. Five provider options: Ollama (local), OpenAI, Anthropic, Google Gemini, Groq. API keys stored in browser only — never sent to dotstell servers."
                />
                <Tip icon="💬" title="AI Chat with RAG"
                  body="Slide-out chat panel on every note. Semantic search grounds every answer in your actual notes. Toggle note-scoped vs. full-library mode. RAG can be turned off for direct model answers."
                />
                <Tip icon="👤" title="Person intelligence"
                  body="People tab in the chat panel — search a name and get a structured brief assembled from everything you've written about that person across notes and bookmarks."
                />
                <Tip icon="🖊️" title="Inline Assist"
                  body="Select text in any note to reveal a floating AI bubble. Seven operations: fix, rewrite, expand, shorten, explain, convert to outline, convert to checklist. Results stream live."
                />
                <Tip icon="🏷️" title="Smart title & auto-tagging"
                  body="After 30+ characters, sparkle buttons appear: one suggests a specific title from the content, the other proposes kebab-case tags you don't already have. Accept or dismiss individually."
                />
                <Tip icon="📋" title="AI summaries everywhere"
                  body="Bullet summaries on notes (right sidebar), bookmarks (inline expand), and notebooks (right-click context menu). All regeneratable."
                />
                <Tip icon="📊" title="AI Digest"
                  body="Dashboard card summarises your Today or This Week note activity in a single click."
                />
                <Tip icon="🌐" title="Graph intelligence"
                  body="AI panel on the graph page with three analyses: missing links, note clusters, and gap detection — surfaces connections and patterns invisible to manual browsing."
                />
                <Tip icon="🔗" title="Related notes & auto-link"
                  body="Vector-embedding-powered Related Notes panel in the note editor. Auto-link suggestions scan note content for un-wikified references to other notes."
                />
              </div>

              {/* v0.3.0 */}
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)', padding: '3px 10px', borderRadius: 99 }}>v0.3.0</span>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Aug 2026</span>
                </div>
                <Tip icon="🗑" title="Trash — 30-day note recovery"
                  body="Delete moves notes to a recoverable trash. Restore any note within 30 days. Notes auto-purge after the window expires. Permanent delete with a proper confirmation dialog."
                />
                <Tip icon="📋" title="Smart paste"
                  body="Pasting from web pages preserves headings, bold, lists, and links while stripping unsafe elements. Toggle Rich paste / Plain paste mode in the toolbar — preference remembered between sessions."
                />
                <Tip icon="🗂" title="Table of contents (Outline)"
                  body="Auto-generated Outline panel in every note built from headings (H1–H4). Click any heading to scroll there instantly. Collapsible, preference remembered."
                />
                <Tip icon="📄" title="PDF export"
                  body="Export any note as a PDF — new PDF button in the editor header opens a print-ready view. Browser print dialog → Save as PDF."
                />
                <Tip icon="📐" title="Richer templates with auto-date"
                  body="Nine built-in templates now include structured guidance text, mood/energy indicators, and auto-fill today's date on selection. Templates include SBI Feedback, Decision log with confidence, Weekly review with rating, and more."
                />
                <Tip icon="🔒" title="Security hardening"
                  body="Blocked javascript: hrefs in the link dialog and paste path. DNS rebinding SSRF fix on bookmark fetch. Rate limits on bulk-import endpoints. LIKE injection fix in notes search. 2 MB content cap and input validation across notes, tasks, and people routes."
                />
              </div>

              {/* v0.2.2 */}
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)', padding: '3px 10px', borderRadius: 99 }}>v0.2.2</span>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Aug 2026</span>
                </div>
                <Tip icon="🎨" title="Colour picker redesign"
                  body="25-colour swatch grid with a full gradient custom picker. Your last 5 custom colours saved as quick-access swatches. Highlights show an Aa preview before applying."
                />
                <Tip icon="🏷️" title="Note & notebook colour labels"
                  body="Right-click any note or notebook to assign a colour label. Notes get a coloured left border and tinted background — visible in both the sidebar and the main grid."
                />
                <Tip icon="↕️" title="Smooth drag-to-reorder"
                  body="Sidebar note reordering rebuilt with pointer-based drag — no more accidental single-click moves. Works precisely on trackpads and touch screens."
                />
                <Tip icon="🔒" title="Security hardening"
                  body="Fixed IPv6-mapped SSRF bypass, ILIKE pattern injection, missing rate limits on write routes, and OTP type validation. HSTS extended to all routes."
                />
              </div>

              {/* v0.2.1 */}
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)', padding: '3px 10px', borderRadius: 99 }}>v0.2.1</span>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Aug 2026</span>
                </div>
                <Tip icon="🎉" title="Onboarding flow"
                  body="A guided 3-step welcome for first-time users — creates your first note and gets you into the graph immediately."
                />
                <Tip icon="🔔" title="Task reminders"
                  body="Browser notifications when a task is due within 15 minutes. Set a date and time — dotstell reminds you automatically."
                />
                <Tip icon="🔗" title="Unlinked mentions"
                  body="The backlinks panel now shows notes that mention your note's title as plain text. One click converts them into a formal [[wikilink]]."
                />
                <Tip icon="⏱️" title="Note status bar"
                  body="Word count, character count, and read time in a clean status bar at the bottom of every note."
                />
              </div>

              {/* v0.2.0 */}
              <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)', padding: '3px 10px', borderRadius: 99 }}>v0.2.0</span>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Aug 2026</span>
                </div>
                <Tip icon="🗂️" title="Notebooks"
                  body="Organise notes into named collections. Collapsible sidebar, drag to reorder, pin important notes to the top."
                />
                <Tip icon="🗃️" title="Note tabs"
                  body="Open multiple notes at once in a tab bar. Tabs persist across refresh. Middle-click to close."
                />
                <Tip icon="📝" title="Sub-notes"
                  body="Nest notes under a parent for hierarchical organisation — ideal for projects and meeting series."
                />
                <Tip icon="🎨" title="12 themes"
                  body="Six new themes added: Dotstell Light, Pure Light, Catppuccin Latte, Rosé Pine Dawn, Gruvbox Light, Catppuccin Mocha."
                />
                <Tip icon="📤" title="Export to Markdown"
                  body="Download any note as a .md file in one click."
                />
              </div>

              {/* v0.1.0 */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)', padding: '3px 10px', borderRadius: 99 }}>v0.1.0</span>
                  <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Aug 2026 — Initial release</span>
                </div>
                <Tip icon="✍️" title="Rich text notes"
                  body="Full editor with slash commands, tables, code blocks, task lists, and [[wikilinks]] between notes."
                />
                <Tip icon="🌐" title="Knowledge graph"
                  body="Visual graph of all linked notes. Click any node to navigate. Backlinks tracked automatically."
                />
                <Tip icon="👥" title="People"
                  body="Track contacts and collaborators. Attach notes, tasks, and context to any person."
                />
                <Tip icon="✅" title="Tasks"
                  body="Kanban board with priorities, due dates, and status tracking. Attach tasks to people."
                />
                <Tip icon="🔖" title="Bookmarks"
                  body="Save any URL — title, description and favicon fetched automatically. Tag and search."
                />
              </div>

            </Section>

            {/* ABOUT */}
            <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.7, margin: '12px 0' }}>
                dotstell is open source under AGPL-3.0 and built in public. Found a bug or want a feature? Open an issue on GitHub.
              </p>
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                <a href="https://github.com/dotstell/dotstell/issues" target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none' }}>Report a bug →</a>
                <a href="https://github.com/dotstell/dotstell/issues" target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none' }}>Request a feature →</a>
                <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 13, color: 'var(--muted-foreground)', textDecoration: 'none' }}>Release notes →</a>
              </div>
            </div>

    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [])

  const pillNav = (
    <div style={{
      display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', flexWrap: 'nowrap',
      padding: '10px 16px', borderBottom: '1px solid var(--border)',
    }}>
      {SECTIONS.map(s => (
        <a key={s.id} href={`#${s.id}`} style={{
          display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
          padding: '5px 12px', borderRadius: 20,
          backgroundColor: 'var(--secondary)', color: 'var(--muted-foreground)',
          fontSize: 12, textDecoration: 'none', flexShrink: 0, touchAction: 'manipulation',
        }}>
          {s.label}
        </a>
      ))}
    </div>
  )

  /* ── Mobile: fixed-height flex column — pill nav always visible, content scrolls ── */
  if (isMobile) return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 56px - env(safe-area-inset-bottom))', overflow: 'hidden' }}>
        {/* Pill nav — always visible, never scrolls away */}
        <div style={{ flexShrink: 0, backgroundColor: 'var(--background)' }}>
          {pillNav}
        </div>
        {/* Content — scrolls independently */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 0', paddingBottom: 'calc(56px + env(safe-area-inset-bottom))' }}>
          {sectionContent}
        </div>
      </div>
    </AppLayout>
  )

  /* ── Desktop: two-panel fixed-height layout ── */
  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
        <div style={{ padding: '24px 32px 16px', flexShrink: 0, borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Help &amp; features</h1>
        </div>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <nav style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--border)', padding: '24px 20px 24px 32px', overflowY: 'auto' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Contents</div>
            {SECTIONS.map(s => (
              <a key={s.id} href={`#${s.id}`}
                style={{ display: 'block', padding: '5px 0', fontSize: 13, color: 'var(--muted-foreground)', textDecoration: 'none', lineHeight: 1.4, transition: 'color 0.12s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--foreground)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--muted-foreground)' }}
              >{s.label}</a>
            ))}
          </nav>
          <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '32px 40px 80px' }}>
            {sectionContent}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
