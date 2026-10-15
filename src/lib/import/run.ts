import { unzipSync } from 'fflate'
import type { ImportPlan, PlannedNote, VaultFile } from './vault'

// Limits that keep a hostile or accidental huge archive from exhausting the tab's memory.
const MAX_FILE_BYTES = 25 * 1024 * 1024
// Evernote puts a whole notebook, attachments included, in one file.
const MAX_ENEX_BYTES = 150 * 1024 * 1024
const limitFor = (path: string) => (/\.enex$/i.test(path) ? MAX_ENEX_BYTES : MAX_FILE_BYTES)
const MAX_TOTAL_BYTES = 400 * 1024 * 1024
const MAX_ENTRIES = 20_000

// Must match the server (src/app/api/import/*).
const NOTES_PER_REQUEST = 25
const PAIRS_PER_REQUEST = 60
const PEOPLE_PER_REQUEST = 50
// Vercel rejects request bodies over 4.5 MB, so a batch also stops growing at this many characters.
const MAX_BATCH_CHARS = 3_000_000

/** A refusal with a message that is safe and useful to show as is. */
class LimitError extends Error {}

export interface ReadResult {
  files: VaultFile[]
  /** Files left out because they were too large; reported to the user. */
  oversized: number
}

/** A file together with where it sat inside the chosen folder. */
export interface InputFile {
  file: File
  path: string
}

/** Reads either one .zip or a set of files into the shape the planner expects. */
export async function readVaultFiles(input: InputFile[]): Promise<ReadResult> {
  const files: VaultFile[] = []
  let oversized = 0
  let total = 0

  const accept = (path: string, data: Uint8Array) => {
    if (data.length > limitFor(path)) { oversized++; return }
    total += data.length
    if (total > MAX_TOTAL_BYTES) throw new Error('This import is too large for the browser (over 400 MB). Try importing a smaller folder.')
    files.push({ path, data })
  }

  if (input.length === 1 && /\.zip$/i.test(input[0].file.name)) {
    const bytes = new Uint8Array(await input[0].file.arrayBuffer())
    // The filter runs before a file is inflated, so a zip bomb is refused without decompressing it.
    let declared = 0
    let count = 0
    let entries: Record<string, Uint8Array>
    try {
      entries = unzipSync(bytes, {
        filter: ({ name, originalSize }) => {
          if (name.endsWith('/')) return false
          if (++count > MAX_ENTRIES) throw new LimitError(`This zip holds more than ${MAX_ENTRIES.toLocaleString()} files. Import a smaller folder.`)
          if (originalSize > limitFor(name)) { oversized++; return false }
          declared += originalSize
          if (declared > MAX_TOTAL_BYTES) throw new LimitError('This zip is too large for the browser (over 400 MB uncompressed).')
          return true
        },
      })
    } catch (e) {
      if (e instanceof LimitError) throw e
      throw new Error('That zip could not be read. It may be damaged, encrypted or not a zip file.')
    }
    for (const [path, data] of Object.entries(entries)) files.push({ path, data })
    return { files, oversized }
  }

  for (const { file, path } of input) accept(path, new Uint8Array(await file.arrayBuffer()))
  return { files, oversized }
}

/** Files from an <input type=file>: a folder pick carries each file's path relative to the folder. */
export function fromFileList(list: FileList): InputFile[] {
  return Array.from(list).map(file => ({ file, path: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name }))
}

/**
 * Files from a drag and drop. Dropped folders are only reachable through the (webkit-prefixed)
 * entries API, which hands out one directory level at a time.
 */
export async function fromDataTransfer(dt: DataTransfer): Promise<InputFile[]> {
  const out: InputFile[] = []

  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej))
      out.push({ file, path: entry.fullPath.replace(/^\//, '') })
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader()
      // readEntries returns results in chunks and signals the end with an empty one.
      for (;;) {
        const chunk = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej))
        if (chunk.length === 0) break
        for (const child of chunk) await walk(child)
      }
    }
  }

  const entries = Array.from(dt.items ?? [])
    .map(item => (item.kind === 'file' ? item.webkitGetAsEntry?.() ?? null : null))
    .filter((e): e is FileSystemEntry => !!e)

  if (entries.length) {
    for (const e of entries) await walk(e)
    return out
  }
  return Array.from(dt.files).map(file => ({ file, path: file.name }))
}

/** `imported-2026-10-16-1430`: marks one run so it can be found, and undone, later. */
export function makeImportTag(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `imported-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
}

/** Parents first, so a child never refers to a note that has not been saved yet. */
export function orderForInsert(notes: PlannedNote[]): PlannedNote[] {
  const byId = new Map(notes.map(n => [n.id, n]))
  const depth = (n: PlannedNote): number => {
    let d = 0
    for (let p = n.parentId; p && d < 100; p = byId.get(p)?.parentId ?? null) d++
    return d
  }
  return notes.map(n => ({ n, d: depth(n) })).sort((a, b) => a.d - b.d).map(x => x.n)
}

export interface RunProgress {
  phase: 'notes' | 'links' | 'people'
  done: number
  total: number
}

/** Groups notes into requests: at most NOTES_PER_REQUEST, and never more than MAX_BATCH_CHARS of content. */
export function batchNotes(notes: PlannedNote[]): PlannedNote[][] {
  const batches: PlannedNote[][] = []
  let current: PlannedNote[] = []
  let size = 0
  for (const n of notes) {
    if (current.length && (current.length >= NOTES_PER_REQUEST || size + n.html.length > MAX_BATCH_CHARS)) {
      batches.push(current)
      current = []
      size = 0
    }
    current.push(n)
    size += n.html.length
  }
  if (current.length) batches.push(current)
  return batches
}

export class ImportError extends Error {
  constructor(message: string, readonly savedNotes: number) {
    super(message)
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) return res.json()
    if (res.status === 429 && attempt < 4) {
      await new Promise(r => setTimeout(r, 1500 * (attempt + 1)))
      continue
    }
    const detail = await res.json().catch(() => null) as { error?: string } | null
    throw new Error(detail?.error ?? `The server refused the request (HTTP ${res.status}).`)
  }
}

export async function runImport(
  plan: ImportPlan,
  importTag: string,
  onProgress: (p: RunProgress) => void,
  includeContacts = true,
): Promise<{ created: number; linked: number; contacts: number; skippedContacts: number }> {
  const ordered = orderForInsert(plan.notes)
  let created = 0

  try {
    for (const batch of batchNotes(ordered)) {
      await post('/api/import/notes', {
        importTag,
        notes: batch.map(n => ({
          id: n.id, title: n.title, html: n.html, tags: n.tags, notebook: n.notebook,
          createdAt: n.createdAt, updatedAt: n.updatedAt, pinned: n.pinned, parentId: n.parentId,
        })),
      })
      created += batch.length
      onProgress({ phase: 'notes', done: created, total: ordered.length })
    }
  } catch (e) {
    throw new ImportError(e instanceof Error ? e.message : 'Import failed.', created)
  }

  const pairs = plan.notes.flatMap(n => n.linkedIds.map(t => [n.id, t] as [string, string]))
  let linked = 0
  try {
    for (let i = 0; i < pairs.length; i += PAIRS_PER_REQUEST) {
      const chunk = pairs.slice(i, i + PAIRS_PER_REQUEST)
      const res = await post<{ linked: number }>('/api/import/links', { pairs: chunk })
      linked += res.linked
      onProgress({ phase: 'links', done: Math.min(i + chunk.length, pairs.length), total: pairs.length })
    }
  } catch (e) {
    // The notes are saved; only the graph edges are missing, and the [[links]] still work in the text.
    throw new ImportError(`Notes were imported, but connecting them failed: ${e instanceof Error ? e.message : 'unknown error'}`, created)
  }

  let contacts = 0
  let skippedContacts = 0
  const people = includeContacts ? plan.contacts : []
  try {
    for (let i = 0; i < people.length; i += PEOPLE_PER_REQUEST) {
      const chunk = people.slice(i, i + PEOPLE_PER_REQUEST)
      const res = await post<{ created: number; skipped: number }>('/api/import/people', { importTag, people: chunk })
      contacts += res.created
      skippedContacts += res.skipped
      onProgress({ phase: 'people', done: Math.min(i + chunk.length, people.length), total: people.length })
    }
  } catch (e) {
    throw new ImportError(`Notes were imported, but the contacts could not be saved: ${e instanceof Error ? e.message : 'unknown error'}`, created)
  }
  return { created, linked, contacts, skippedContacts }
}

export async function undoImport(importTag: string): Promise<{ trashed: number; removedPeople: number }> {
  return post('/api/import/undo', { importTag })
}
