import { buildExport, type ExportSummary } from './build'
import { fetchAllExportData, type ExportProgress } from './fetch'
import { zipExport } from './zip'

export type { ExportProgress, ExportSummary }

/** Fetches everything, builds the archive and returns it as a downloadable blob. */
export async function createExportArchive(
  onProgress?: (p: ExportProgress) => void,
): Promise<{ blob: Blob; fileName: string; summary: ExportSummary }> {
  const data = await fetchAllExportData(onProgress)
  const now = new Date()
  // Local date and time, not UTC: someone in Tokyo exporting in the morning should not get
  // yesterday's date, and two exports on the same day must not share a name. Dashes, not
  // colons, because colons are not allowed in Windows file names.
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`
  const root = `dotstell-export-${stamp}`
  const { files, summary } = buildExport(data, now)
  // Copy into a plain ArrayBuffer-backed view: Blob rejects SharedArrayBuffer-typed views.
  const bytes = zipExport(files, root)
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/zip' })
  return { blob, fileName: `${root}.zip`, summary }
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
