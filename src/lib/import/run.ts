import { unzipSync } from 'fflate'
import type { ImportPlan, PlannedNote, VaultFile } from './vault'

// Limits that keep a hostile or accidental huge archive from exhausting the tab's memory.
const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_TOTAL_BYTES = 400 * 1024 * 1024

// Must match the server (src/app/api/import/*).
const NOTES_PER_REQUEST = 25
const PAIRS_PER_REQUEST = 60

export interface ReadResult {
  files: VaultFile[]
  /** Files left out because they were too large; reported to the user. */
  oversized: number
}

/** Reads either one .zip or the contents of a chosen folder into the shape the planner expects. */
export async function readVaultFiles(input: File[]): Promise<ReadResult> {
  const files: VaultFile[] = []
  let oversized = 0
  let total = 0

  const accept = (path: string, data: Uint8Array) => {
    if (data.length > MAX_FILE_BYTES) { oversized++; return }
    total += data.length
    if (total > MAX_TOTAL_BYTES) throw new Error('This import is too large for the browser (over 400 MB). Try importing a smaller folder.')
    files.push({ path, data })
  }

  if (input.length === 1 && /\.zip$/i.test(input[0].name)) {
    const bytes = new Uint8Array(await input[0].arrayBuffer())
    // The filter runs before a file is inflated, so a zip bomb is refused without decompressing it.
    let declared = 0
    const entries = unzipSync(bytes, {
      filter: ({ name, originalSize }) => {
        if (name.endsWith('/')) return false
        if (originalSize > MAX_FILE_BYTES) { oversized++; return false }
        declared += originalSize
        if (declared > MAX_TOTAL_BYTES) throw new Error('This zip is too large for the browser (over 400 MB uncompressed).')
        return true
      },
    })
    for (const [path, data] of Object.entries(entries)) files.push({ path, data })
    return { files, oversized }
  }

  for (const f of input) {
    // A folder pick gives each file its path relative to the chosen folder's parent.
    const path = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name
    accept(path, new Uint8Array(await f.arrayBuffer()))
  }
  return { files, oversized }
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
  phase: 'notes' | 'links'
  done: number
  total: number
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
): Promise<{ created: number; linked: number }> {
  const ordered = orderForInsert(plan.notes)
  let created = 0

  try {
    for (let i = 0; i < ordered.length; i += NOTES_PER_REQUEST) {
      const batch = ordered.slice(i, i + NOTES_PER_REQUEST)
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
  return { created, linked }
}

export async function undoImport(importTag: string): Promise<number> {
  const res = await post<{ trashed: number }>('/api/import/undo', { importTag })
  return res.trashed
}
