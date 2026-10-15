import { createMarkdownConverter, looksLikeHtml } from './html-to-markdown'
import { safeHref } from './urls'
import { createNamer, encodePath, sanitizeFileName } from './filenames'
import type {
  ExportData, ExportFile, ExportFiles, ExportNote, ExportTask, ExportBookmark,
} from './types'

export const EXPORT_FORMAT_VERSION = 1

export interface ExportSummary {
  notes: number
  people: number
  tasks: number
  bookmarks: number
  attachments: number
}

export interface BuiltExport {
  files: ExportFiles
  summary: ExportSummary
}

// ── YAML front matter ───────────────────────────────────────
// JSON strings and flow arrays are valid YAML, which avoids hand-rolled escaping of quotes,
// colons and newlines in titles.

type YamlValue = string | number | boolean | string[] | null | undefined

function frontMatter(fields: Record<string, YamlValue>): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === '' || value === false) continue
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      lines.push(`${key}: [${value.map(v => JSON.stringify(v)).join(', ')}]`)
    } else if (typeof value === 'string') {
      lines.push(`${key}: ${JSON.stringify(value)}`)
    } else {
      lines.push(`${key}: ${value}`)
    }
  }
  return lines.length ? `---\n${lines.join('\n')}\n---\n\n` : ''
}

// ── Helpers ─────────────────────────────────────────────────

const NOTEBOOK_PREFIX = 'nb:'
const WIKILINK_LABEL = '__wikilink__'

const notebookSlug = (name: string) => `${NOTEBOOK_PREFIX}${name.toLowerCase().replace(/\s+/g, '-')}`

/** Obsidian tags cannot contain spaces. */
const toTag = (t: string) => t.trim().replace(/\s+/g, '-')

const toDate = (iso: string | null | undefined) => (iso ? new Date(iso) : undefined)

const dateOnly = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '')

const IMAGE_EXT: Record<string, string> = {
  jpeg: 'jpg', 'svg+xml': 'svg', 'x-icon': 'ico', 'vnd.microsoft.icon': 'ico',
}

function decodeBase64(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''))
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/**
 * Spreadsheet apps run a cell that starts with = + - @ (or a tab/CR) as a formula. Text from notes,
 * tasks or bookmarks is untrusted, so such cells are prefixed with an apostrophe and show as text.
 * Numbers are left alone.
 */
function neutraliseFormula(value: unknown, s: string): string {
  return typeof value === 'string' && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
}

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : neutraliseFormula(value, String(value))
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function csv(header: string[], rows: unknown[][]): string {
  // Leading BOM so Excel opens non-ASCII text as UTF-8 instead of guessing a legacy code page.
  return '\uFEFF' + [header, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ── Builders ────────────────────────────────────────────────

export function buildExport(data: ExportData, exportedAt: Date = new Date()): BuiltExport {
  const files: ExportFiles = {}
  const put = (path: string, content: string | Uint8Array, mtime?: Date) => {
    files[path] = { content, mtime } satisfies ExportFile
  }

  // ── Names are assigned up front so links between files can be written in a single pass.
  // Note names are unique across the whole vault (not per folder): Obsidian resolves a bare
  // [[Name]] vault-wide, so two notes called "Meeting" in different folders would be ambiguous.
  const noteNamer = createNamer()
  const noteName = new Map<string, string>()
  const sortedNotes = [...data.notes].sort((a, b) => a.created_at.localeCompare(b.created_at))
  for (const n of sortedNotes) noteName.set(n.id, noteNamer(n.title))

  const personNamer = createNamer()
  const personName = new Map<string, string>()
  for (const p of [...data.people].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    personName.set(p.id, personNamer(p.name, 'Unnamed person'))
  }

  const notebookByTag = new Map(data.notebooks.map(nb => [notebookSlug(nb.name), nb.name]))
  const taskTitle = new Map(data.tasks.map(t => [t.id, t.title]))
  const bookmarkTitle = new Map(data.bookmarks.map(b => [b.id, b.title]))

  const noteLink = (id: string | null | undefined): string | null => {
    const name = id ? noteName.get(id) : undefined
    return name ? `[[${name}]]` : null
  }
  const personLink = (id: string | null | undefined): string | null => {
    const name = id ? personName.get(id) : undefined
    return name ? `[[people/${name}|${name}]]` : null
  }

  const toMarkdown = createMarkdownConverter((id, title) => {
    const name = id ? noteName.get(id) : undefined
    if (!name) return sanitizeFileName(title)
    return name === title ? name : `${name}|${title}`
  })

  const attachmentNamer = createNamer()
  let attachmentCount = 0

  // ── Related links per note (manual connections, not the wikilinks already in the text)
  const related = new Map<string, string[]>()
  for (const l of data.links) {
    if (l.label === WIKILINK_LABEL || l.source_type !== 'note') continue
    let text: string | null = null
    if (l.target_type === 'note') text = noteLink(l.target_id)
    else if (l.target_type === 'person') text = personLink(l.target_id)
    else if (l.target_type === 'task') text = taskTitle.has(l.target_id) ? `task: ${taskTitle.get(l.target_id)}` : null
    else if (l.target_type === 'bookmark') text = bookmarkTitle.has(l.target_id) ? `bookmark: ${bookmarkTitle.get(l.target_id)}` : null
    if (!text) continue
    const list = related.get(l.source_id) ?? []
    list.push(text)
    related.set(l.source_id, list)
  }

  // ── Notes
  for (const note of sortedNotes) {
    const name = noteName.get(note.id)!
    const tags = note.tags ?? []
    const notebookNames = tags
      .filter(t => t.startsWith(NOTEBOOK_PREFIX))
      .map(t => notebookByTag.get(t) ?? t.slice(NOTEBOOK_PREFIX.length))
    const folder = notebookNames[0] ? sanitizeFileName(notebookNames[0]) : ''
    const path = folder ? `notes/${folder}/${name}.md` : `notes/${name}.md`
    const depth = path.split('/').length - 1

    let body = noteBody(note, toMarkdown)

    // Embedded (base64) images become real files; otherwise a single screenshot would put
    // hundreds of KB of base64 into the middle of the Markdown.
    body = body.replace(
      /!\[([^\]]*)\]\(data:image\/([a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+?)(?:\s+"[^"]*")?\)/g,
      (_m, alt: string, subtype: string, b64: string) => {
        const ext = IMAGE_EXT[subtype.toLowerCase()] ?? subtype.toLowerCase()
        const file = `${attachmentNamer(`${name} image`)}.${ext}`
        put(`attachments/${file}`, decodeBase64(b64))
        attachmentCount++
        return `![${alt}](${'../'.repeat(depth)}${encodePath(`attachments/${file}`)})`
      },
    )

    const head = frontMatter({
      title: note.title || undefined,
      tags: tags.filter(t => !t.startsWith(NOTEBOOK_PREFIX)).map(toTag),
      notebooks: notebookNames.length > 1 ? notebookNames : undefined,
      notebook: notebookNames[0],
      created: note.created_at,
      updated: note.updated_at,
      pinned: note.pinned,
      color: note.color,
      parent: noteLink(note.parent_id),
      person: personLink(note.person_id),
      related: related.get(note.id),
      dotstell_id: note.id,
    })

    put(path, head + body + (body ? '\n' : ''), toDate(note.updated_at))
  }

  // ── People
  const notesByPerson = groupBy(data.notes, n => n.person_id)
  const tasksByPerson = groupBy(data.tasks, t => t.person_id)
  for (const person of data.people) {
    const name = personName.get(person.id)!
    const head = frontMatter({
      name: person.name,
      role: person.role,
      company: person.company,
      email: person.email,
      phone: person.phone,
      tags: (person.tags ?? []).map(toTag),
      last_interaction: person.last_interaction,
      created: person.created_at,
      dotstell_id: person.id,
    })
    const sections: string[] = []
    const theirNotes = notesByPerson.get(person.id) ?? []
    if (theirNotes.length) {
      sections.push(`## Notes\n\n${theirNotes.map(n => `- ${noteLink(n.id)}`).join('\n')}`)
    }
    const theirTasks = tasksByPerson.get(person.id) ?? []
    if (theirTasks.length) {
      sections.push(`## Tasks\n\n${theirTasks.map(t => `- [${t.status === 'done' ? 'x' : ' '}] ${t.title}`).join('\n')}`)
    }
    put(`people/${name}.md`, head + sections.join('\n\n') + (sections.length ? '\n' : ''), toDate(person.updated_at))
  }

  // ── Tasks
  put('tasks.md', tasksMarkdown(data.tasks, personLink))
  put('tasks.csv', csv(
    ['id', 'title', 'description', 'status', 'priority', 'due_date', 'person', 'tags', 'created_at', 'updated_at'],
    data.tasks.map(t => [
      t.id, t.title, t.description, t.status, t.priority, t.due_date,
      t.person_id ? personName.get(t.person_id) ?? '' : '', (t.tags ?? []).join('; '), t.created_at, t.updated_at,
    ]),
  ))

  // ── Bookmarks
  put('bookmarks.md', bookmarksMarkdown(data.bookmarks))
  put('bookmarks.html', bookmarksNetscapeHtml(data.bookmarks))

  // ── Lossless backup: everything, in the shape the app stores it
  put('dotstell-export.json', JSON.stringify({
    format: 'dotstell-export',
    version: EXPORT_FORMAT_VERSION,
    exportedAt: exportedAt.toISOString(),
    counts: {
      notes: data.notes.length, people: data.people.length, tasks: data.tasks.length,
      bookmarks: data.bookmarks.length, notebooks: data.notebooks.length, links: data.links.length,
    },
    ...data,
  }, null, 2))

  const summary: ExportSummary = {
    notes: data.notes.length,
    people: data.people.length,
    tasks: data.tasks.length,
    bookmarks: data.bookmarks.length,
    attachments: attachmentCount,
  }
  put('README.md', readme(summary, exportedAt))

  return { files, summary }
}

function noteBody(note: ExportNote, toMarkdown: (html: string) => string): string {
  const parts: string[] = []
  const content = note.content ?? ''
  if (content.trim()) parts.push(looksLikeHtml(content) ? toMarkdown(content) : content.trim())

  if (note.type === 'checklist' && note.checklist_items?.length) {
    parts.push(note.checklist_items.map(i => `- [${i.checked ? 'x' : ' '}] ${i.text}`).join('\n'))
  }
  return parts.filter(Boolean).join('\n\n')
}

function groupBy<T>(items: T[], key: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    if (!k) continue
    const list = map.get(k) ?? []
    list.push(item)
    map.set(k, list)
  }
  return map
}

function tasksMarkdown(tasks: ExportTask[], personLink: (id: string | null) => string | null): string {
  const sections: Array<[ExportTask['status'], string]> = [
    ['todo', 'To do'], ['in_progress', 'In progress'], ['done', 'Done'],
  ]
  const out: string[] = ['# Tasks']
  for (const [status, heading] of sections) {
    const list = tasks.filter(t => t.status === status)
    if (list.length === 0) continue
    const lines = list.map(t => {
      const meta = [
        t.due_date ? `due ${dateOnly(t.due_date)}` : '',
        t.priority !== 'medium' ? `${t.priority} priority` : '',
        personLink(t.person_id) ?? '',
        ...(t.tags ?? []).map(tag => `#${toTag(tag)}`),
      ].filter(Boolean)
      const desc = t.description?.trim() ? `\n  ${t.description.trim().replace(/\n+/g, '\n  ')}` : ''
      return `- [${status === 'done' ? 'x' : ' '}] ${t.title}${meta.length ? ` — ${meta.join(' · ')}` : ''}${desc}`
    })
    out.push(`## ${heading}\n\n${lines.join('\n')}`)
  }
  return out.join('\n\n') + '\n'
}

function bookmarksMarkdown(bookmarks: ExportBookmark[]): string {
  if (bookmarks.length === 0) return '# Bookmarks\n'
  const lines = bookmarks.map(b => {
    const tags = (b.tags ?? []).map(t => `#${toTag(t)}`).join(' ')
    const desc = b.description?.trim() ? ` — ${b.description.trim().replace(/\s+/g, ' ')}` : ''
    const href = safeHref(b.url)
    // Parentheses and spaces would end the Markdown link early, so they are percent-encoded.
    const target = href?.replace(/[()\s]/g, c => encodeURIComponent(c).replace('(', '%28').replace(')', '%29'))
    const label = b.title.replace(/[[\]]/g, '')
    return `- ${target ? `[${label}](${target})` : `${label} (${b.url.replace(/[\r\n]+/g, ' ')})`}${desc}${tags ? ` ${tags}` : ''}`
  })
  return `# Bookmarks\n\n${lines.join('\n')}\n`
}

/** Netscape bookmark file: the format Chrome, Firefox, Safari and Edge all import. */
function bookmarksNetscapeHtml(bookmarks: ExportBookmark[]): string {
  // A javascript: URL would become a bookmarklet that runs when clicked, so only safe links are listed.
  const items = bookmarks.filter(b => safeHref(b.url)).map(b => {
    const added = Math.floor(new Date(b.created_at).getTime() / 1000)
    const tags = (b.tags ?? []).join(',')
    return `    <DT><A HREF="${escapeHtml(safeHref(b.url)!)}" ADD_DATE="${added}"${tags ? ` TAGS="${escapeHtml(tags)}"` : ''}>${escapeHtml(b.title)}</A>` +
      (b.description?.trim() ? `\n    <DD>${escapeHtml(b.description.trim())}` : '')
  })
  return [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
    ...items,
    '</DL><p>',
    '',
  ].join('\n')
}

function readme(s: ExportSummary, exportedAt: Date): string {
  return `# Dotstell export

Exported ${exportedAt.toISOString().slice(0, 10)}: ${s.notes} notes, ${s.people} people, ${s.tasks} tasks, ${s.bookmarks} bookmarks, ${s.attachments} images.

## What is in here

| Path | Contents |
|---|---|
| \`notes/\` | One Markdown file per note. Notebooks are folders; tags, dates and links are in the front matter. |
| \`people/\` | One file per person, with the notes and tasks linked to them. |
| \`tasks.md\`, \`tasks.csv\` | Every task, as a readable checklist and as a spreadsheet. |
| \`bookmarks.md\`, \`bookmarks.html\` | Every bookmark; the HTML file imports straight into any browser. |
| \`attachments/\` | Images that were pasted into notes. |
| \`dotstell-export.json\` | A complete, lossless copy of your data, for backup or re-import. |

## Opening it in Obsidian

Choose **Open folder as vault** and select this folder. \`[[wikilinks]]\` between notes are
preserved, so the graph view and backlinks work straight away.

## What does not carry over

- Text colour, font, and alignment: Markdown has no way to express them. They are kept in \`dotstell-export.json\`.
- Underline, subscript and superscript are kept as inline HTML.
- Notes in the trash are not exported.
- Semantic-search embeddings are not exported; they are rebuilt from your text.
`
}
