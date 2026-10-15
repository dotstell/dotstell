import { zipSync, strToU8, type Zippable } from 'fflate'
import type { ExportFiles } from './types'

const TEXT_FILE = /\.(md|json|csv|html|txt)$/i

/**
 * Packs the export into a single .zip, everything under one top-level folder so extracting it
 * never scatters files across the user's current directory.
 */
export function zipExport(files: ExportFiles, rootFolder: string): Uint8Array {
  const entries: Zippable = {}
  for (const [path, { content, mtime }] of Object.entries(files)) {
    const data = typeof content === 'string' ? strToU8(content) : content
    entries[`${rootFolder}/${path}`] = [
      data,
      // Images are already compressed; deflating them again only costs time.
      { level: TEXT_FILE.test(path) ? 6 : 0, ...(mtime ? { mtime } : {}) },
    ]
  }
  return zipSync(entries)
}
