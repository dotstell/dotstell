import { splitFrontMatter, toIsoDate, toStringList } from './frontmatter'
import { classifyFile, extensionOf, hasUnsafePath, isSafeSvg, looksBinary, sniffImage } from './safety'
import { extractInlineTags, parseWikiTarget, renderMarkdown } from './markdown'

export interface VaultFile {
  /** Path inside the archive or folder, with any separator. */
  path: string
  data: Uint8Array
}

export interface PlannedNote {
  /** Assigned up front so wikilinks can point at it before anything is saved. */
  id: string
  /** Original location, for the report. */
  path: string
  title: string
  html: string
  tags: string[]
  notebook: string | null
  createdAt: string | null
  updatedAt: string | null
  pinned: boolean
  parentId: string | null
  /** Ids of notes this one links to; becomes knowledge_links rows. */
  linkedIds: string[]
}

export interface ImportReport {
  notes: number
  notebooks: number
  images: { embedded: number; skipped: number }
  links: { resolved: number; unresolved: number }
  /** Short human-readable lines: what was not imported or was changed along the way. */
  issues: string[]
  /** Files that were refused for safety reasons. Shown prominently, separate from the notes about conversion. */
  warnings: string[]
}

export interface ImportPlan {
  notes: PlannedNote[]
  notebooks: string[]
  report: ImportReport
}

export interface PlanOptions {
  newId?: () => string
  /** Images larger than this are left out; they would bloat the note and its search index. */
  maxImageBytes?: number
}

const DEFAULT_MAX_IMAGE_BYTES = 500 * 1024
// Stays under the server's 2 MB limit so one oversized note never aborts the whole import.
const MAX_NOTE_HTML = 1_900_000

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', avif: 'image/avif',
}

const extOf = extensionOf
const baseName = (p: string) => p.slice(p.lastIndexOf('/') + 1)
const stripMd = (p: string) => p.replace(/\.md$/i, '')

/** Notion appends a 32-character id to every file and folder name; it is noise in a title. */
const cleanName = (name: string) => name.replace(/\s[0-9a-f]{32}$/i, '')

/** Resolves `a/b/../c` style segments; returns null if the path escapes the root. */
function normalizePath(path: string): string | null {
  const out: string[] = []
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue
    if (seg === '..') { if (out.pop() === undefined) return null } else out.push(seg)
  }
  return out.join('/')
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  // Chunked: spreading a large array into String.fromCharCode overflows the call stack.
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** Drops files that are never part of a vault's content (app config, trash, OS litter). */
function isIgnorable(path: string): boolean {
  return path.split('/').some(seg => seg.startsWith('.') || seg === '__MACOSX')
}

export function planMarkdownImport(input: VaultFile[], options: PlanOptions = {}): ImportPlan {
  const newId = options.newId ?? (() => crypto.randomUUID())
  const maxImageBytes = options.maxImageBytes ?? DEFAULT_MAX_IMAGE_BYTES
  const issues: string[] = []
  const warnings: string[] = []
  const counts = new Map<string, number>()
  const tally = (kind: string, detail: string) => {
    counts.set(`${kind}\u0000${detail}`, (counts.get(`${kind}\u0000${detail}`) ?? 0) + 1)
  }

  // ── Refuse paths that try to escape the import before anything else looks at them
  const unsafePaths = input.filter(f => hasUnsafePath(f.path)).length
  if (unsafePaths) warnings.push(`${unsafePaths} file(s) with unsafe paths (such as "../") were refused.`)

  // ── Normalise paths and drop noise
  let files = input
    .filter(f => !hasUnsafePath(f.path))
    .map(f => ({ path: f.path.replace(/\\/g, '/').replace(/^\.?\/+/, ''), data: f.data }))
    .filter(f => f.path && !isIgnorable(f.path))

  // A vault zipped as a folder arrives wrapped in one extra directory; take it off.
  const firstSegments = new Set(files.map(f => f.path.split('/')[0]))
  if (firstSegments.size === 1 && files.every(f => f.path.includes('/'))) {
    const wrapper = [...firstSegments][0] + '/'
    files = files.map(f => ({ ...f, path: f.path.slice(wrapper.length) }))
  }

  // A dotstell export keeps its notes under notes/ next to people/, tasks and a JSON backup.
  const isDotstellExport = files.some(f => f.path === 'dotstell-export.json')
  if (isDotstellExport) {
    issues.push('This looks like a dotstell export: only the notes were imported. People, tasks and bookmarks need the restore-from-backup option.')
    files = files.filter(f => f.path.startsWith('notes/')).map(f => ({ ...f, path: f.path.slice('notes/'.length) }))
  }

  const decoder = new TextDecoder('utf-8')
  const mdFiles = files.filter(f => extOf(f.path) === 'md' && !looksBinary(f.data))
  const fakeText = files.filter(f => extOf(f.path) === 'md').length - mdFiles.length
  if (fakeText) warnings.push(`${fakeText} file(s) named .md are not text files and were refused.`)
  const imageFiles = new Map<string, VaultFile>()
  const imageByName = new Map<string, VaultFile>()
  const unsupported = new Map<string, number>()
  const blocked = new Map<string, number>()
  const bump = (m: Map<string, number>, ext: string) => m.set(ext || 'no extension', (m.get(ext || 'no extension') ?? 0) + 1)
  let nestedArchives = 0
  let fakeImages = 0
  let unsafeSvgs = 0
  for (const f of files) {
    const kind = classifyFile(f.path)
    if (kind === 'markdown') continue
    if (kind === 'image') {
      // The bytes decide what a file is, not its name.
      const real = sniffImage(f.data)
      if (!real || real !== IMAGE_MIME[extOf(f.path)] && !(real === 'image/jpeg' && extOf(f.path) === 'jpg')) { fakeImages++; continue }
      if (real === 'image/svg+xml' && !isSafeSvg(f.data)) { unsafeSvgs++; continue }
      imageFiles.set(f.path.toLowerCase(), f)
      if (!imageByName.has(baseName(f.path).toLowerCase())) imageByName.set(baseName(f.path).toLowerCase(), f)
    } else if (kind === 'blocked') bump(blocked, extOf(f.path))
    else if (kind === 'archive') nestedArchives++
    else bump(unsupported, extOf(f.path))
  }
  const list = (m: Map<string, number>) => [...m].map(([e, n]) => `.${e} ×${n}`).join(', ')
  if (blocked.size) warnings.push(`Program or script files were refused and never opened: ${list(blocked)}.`)
  if (fakeImages) warnings.push(`${fakeImages} file(s) with an image name are not valid images and were refused.`)
  if (unsafeSvgs) warnings.push(`${unsafeSvgs} SVG image(s) contain scripts or external references and were refused.`)
  if (nestedArchives) warnings.push(`${nestedArchives} zip or archive file(s) inside the import were not opened. Extract them and import the folder instead.`)
  if (unsupported.size) issues.push(`Unsupported files were skipped (PDFs, audio, canvases …): ${list(unsupported)}.`)

  // ── Pass 1: identities, so every link can be resolved in pass 2
  interface Draft {
    id: string
    path: string
    dir: string
    title: string
    raw: string
    data: Record<string, unknown>
    body: string
    aliases: string[]
  }
  const drafts: Draft[] = mdFiles.map(f => {
    const raw = decoder.decode(f.data)
    const fm = splitFrontMatter(raw)
    if (fm.error) issues.push(`"${f.path}": front matter could not be read (${fm.error}); it was kept as text.`)
    const fmTitle = typeof fm.data.title === 'string' ? fm.data.title.trim() : ''
    return {
      id: newId(),
      path: f.path,
      dir: f.path.includes('/') ? f.path.slice(0, f.path.lastIndexOf('/')) : '',
      title: fmTitle || cleanName(stripMd(baseName(f.path))),
      raw,
      data: fm.data,
      body: fm.body,
      aliases: toStringList(fm.data.aliases ?? fm.data.alias),
    }
  })

  const byPath = new Map<string, Draft>()
  const byName = new Map<string, Draft[]>()
  const byAlias = new Map<string, Draft>()
  for (const d of drafts) {
    byPath.set(stripMd(d.path).toLowerCase(), d)
    const key = stripMd(baseName(d.path)).toLowerCase()
    byName.set(key, [...(byName.get(key) ?? []), d])
    for (const a of d.aliases) if (!byAlias.has(a.toLowerCase())) byAlias.set(a.toLowerCase(), d)
  }

  let ambiguous = 0
  const findNote = (target: string, fromDir: string): Draft | null => {
    let t = target.trim()
    try { t = decodeURIComponent(t) } catch { /* use as written */ }
    t = stripMd(t.replace(/\\/g, '/')).toLowerCase()
    if (t.includes('/')) {
      const abs = normalizePath(t)
      const rel = normalizePath(`${fromDir}/${t}`.toLowerCase())
      return (rel && byPath.get(rel)) || (abs && byPath.get(abs)) || null
    }
    const matches = byName.get(t)
    if (matches?.length) {
      if (matches.length === 1) return matches[0]
      ambiguous++
      // Obsidian prefers the closest note; same folder first, then the shortest path.
      return matches.find(m => m.dir === fromDir) ?? [...matches].sort((a, b) => a.path.length - b.path.length)[0]
    }
    return byAlias.get(t) ?? null
  }

  const embedded = { count: 0, skipped: 0 }
  const resolveImage = (src: string, fromDir: string): string | null => {
    let s = src.split('|')[0].split('#')[0].split('?')[0].trim()
    try { s = decodeURIComponent(s) } catch { /* use as written */ }
    s = s.replace(/\\/g, '/')
    const rel = normalizePath(`${fromDir}/${s}`)
    const file = (rel && imageFiles.get(rel.toLowerCase())) || imageFiles.get(s.toLowerCase()) || imageByName.get(baseName(s).toLowerCase())
    if (!file) { embedded.skipped++; return null }
    if (file.data.length > maxImageBytes) {
      embedded.skipped++
      tally('image-too-large', baseName(file.path))
      return null
    }
    embedded.count++
    return `data:${IMAGE_MIME[extOf(file.path)]};base64,${toBase64(file.data)}`
  }

  // ── Pass 2: render each note
  const notebooks = new Set<string>()
  let resolvedLinks = 0
  let unresolvedLinks = 0
  const notes: PlannedNote[] = drafts.map(d => {
    const linked = new Set<string>()
    const html = renderMarkdown(d.body, {
      resolveLink: target => {
        const hit = findNote(target, d.dir)
        if (!hit) return null
        resolvedLinks++
        if (hit.id !== d.id) linked.add(hit.id)
        return { id: hit.id, title: hit.title }
      },
      resolveImage: src => resolveImage(src, d.dir),
      warn: (kind, detail) => {
        if (kind === 'unresolved-link') unresolvedLinks++
        tally(kind, detail)
      },
    })

    const notebook = d.dir ? cleanName(d.dir.split('/')[0]) : null
    if (notebook) notebooks.add(notebook)

    let parentId: string | null = null
    if (typeof d.data.parent === 'string') {
      const m = /\[\[([^\]]+)\]\]/.exec(d.data.parent)
      const hit = m ? findNote(parseWikiTarget(m[1]).target, d.dir) : null
      if (hit && hit.id !== d.id) parentId = hit.id
    }

    const tags = [...new Set([...toStringList(d.data.tags ?? d.data.tag), ...extractInlineTags(d.body)])]
    return {
      id: d.id,
      path: d.path,
      title: d.title,
      html,
      tags,
      notebook,
      createdAt: toIsoDate(d.data.created ?? d.data.created_at ?? d.data.date),
      updatedAt: toIsoDate(d.data.updated ?? d.data.updated_at ?? d.data.modified),
      pinned: d.data.pinned === true,
      parentId,
      linkedIds: [...linked],
    }
  })

  // A note too large for the server is dropped here, with its references, instead of failing mid-import.
  const tooBig = new Set(notes.filter(n => n.html.length > MAX_NOTE_HTML).map(n => n.id))
  if (tooBig.size) {
    warnings.push(`${tooBig.size} note(s) are too large to import (over 2 MB of content) and were skipped.`)
    for (const n of notes) {
      n.linkedIds = n.linkedIds.filter(id => !tooBig.has(id))
      if (n.parentId && tooBig.has(n.parentId)) n.parentId = null
    }
    notes.splice(0, notes.length, ...notes.filter(n => !tooBig.has(n.id)))
  }

  // A parent chain that loops back on itself would make the notes unreachable in a tree.
  const byId = new Map(notes.map(n => [n.id, n]))
  for (const n of notes) {
    const seen = new Set<string>([n.id])
    for (let p = n.parentId; p; p = byId.get(p)?.parentId ?? null) {
      if (seen.has(p)) { n.parentId = null; break }
      seen.add(p)
    }
  }

  // ── Turn the tallies into readable lines
  const total = (kind: string) => [...counts].filter(([k]) => k.startsWith(`${kind}\u0000`)).reduce((s, [, v]) => s + v, 0)
  if (total('unresolved-link')) issues.push(`${total('unresolved-link')} link(s) point at notes that are not in this import and were kept as plain [[text]].`)
  if (total('embed-as-link')) issues.push(`${total('embed-as-link')} embedded note(s) were turned into links.`)
  if (total('unsupported-embed')) issues.push(`${total('unsupported-embed')} embedded file(s) (PDF, audio, video …) were not imported.`)
  if (total('image-too-large')) issues.push(`${total('image-too-large')} image(s) over ${Math.round(maxImageBytes / 1024)} KB were left out.`)
  if (total('image-skipped')) issues.push(`${total('image-skipped')} image(s) could not be found in the import.`)
  if (total('local-link')) issues.push(`${total('local-link')} link(s) to local files were kept as plain text.`)
  if (total('unsafe-link')) issues.push(`${total('unsafe-link')} link(s) with an unsafe address were removed.`)
  if (ambiguous) issues.push(`${ambiguous} link(s) matched several notes with the same name; the closest one was used.`)

  return {
    notes,
    notebooks: [...notebooks],
    report: {
      notes: notes.length,
      notebooks: notebooks.size,
      images: { embedded: embedded.count, skipped: embedded.skipped },
      links: { resolved: resolvedLinks, unresolved: unresolvedLinks },
      issues,
      warnings,
    },
  }
}
