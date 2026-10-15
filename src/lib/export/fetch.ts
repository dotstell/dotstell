import type { ExportData } from './types'

type Entity = keyof ExportData

// Notes carry whole documents, so they are paged smaller to keep each response well under the
// hosting platform's body-size limit even for long notes.
const PAGE_SIZE: Record<Entity, number> = {
  notes: 40, people: 100, tasks: 100, bookmarks: 100, notebooks: 100, links: 100,
}

// Order matters only for the progress display.
const ENTITIES: Entity[] = ['notebooks', 'notes', 'people', 'tasks', 'bookmarks', 'links']

export interface ExportProgress {
  entity: Entity
  fetched: number
}

async function fetchPage(entity: Entity, offset: number, limit: number): Promise<{ rows: unknown[]; hasMore: boolean }> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`/api/export?entity=${entity}&offset=${offset}&limit=${limit}`)
    if (res.ok) return res.json()
    // Back off and retry when rate limited; anything else is a real failure.
    if (res.status === 429 && attempt < 3) {
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      continue
    }
    throw new Error(res.status === 401 ? 'You are signed out. Sign in again and retry.' : `Could not read your ${entity} (HTTP ${res.status}).`)
  }
}

/** Reads every row of every entity, page by page. */
export async function fetchAllExportData(onProgress?: (p: ExportProgress) => void): Promise<ExportData> {
  const data = { notes: [], people: [], tasks: [], bookmarks: [], notebooks: [], links: [] } as unknown as Record<Entity, unknown[]>

  for (const entity of ENTITIES) {
    let offset = 0
    for (;;) {
      const { rows, hasMore } = await fetchPage(entity, offset, PAGE_SIZE[entity])
      data[entity].push(...rows)
      offset += rows.length
      onProgress?.({ entity, fetched: data[entity].length })
      if (!hasMore || rows.length === 0) break
    }
  }
  return data as unknown as ExportData
}
