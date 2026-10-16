import { safeHref } from '../export/urls'
import { escapeHtml } from './markdown'
import { isSafeSvg, sniffImage } from './safety'
import { MAX_IMAGE_BYTES, toTagSlug, type DraftNote, type Reporter } from './types'

// Google Takeout writes one JSON file per Keep note, with attachments beside it.
// https://takeout.google.com → Keep

const NOTEBOOK = 'Google Keep'
const MAX_JSON_BYTES = 2 * 1024 * 1024

interface KeepJson {
  title?: unknown
  textContent?: unknown
  listContent?: unknown
  labels?: unknown
  annotations?: unknown
  attachments?: unknown
  isPinned?: unknown
  isTrashed?: unknown
  createdTimestampUsec?: unknown
  userEditedTimestampUsec?: unknown
}

/** Parses a candidate file; null when it is not a Keep note, so other JSON files stay untouched. */
export function readKeepJson(data: Uint8Array): KeepJson | null {
  if (data.length > MAX_JSON_BYTES) return null
  let parsed: unknown
  try { parsed = JSON.parse(new TextDecoder().decode(data)) } catch { return null }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const j = parsed as KeepJson
  const looksLikeKeep = ('textContent' in j || 'listContent' in j) && 'userEditedTimestampUsec' in j
  return looksLikeKeep ? j : null
}

const toIso = (usec: unknown): string | null => {
  const ms = typeof usec === 'number' ? usec / 1000 : NaN
  const d = new Date(ms)
  // Keep started in 2013; anything outside a sane range is a corrupt value, not a date.
  return Number.isFinite(ms) && d.getFullYear() >= 2012 && d.getFullYear() <= 2100 ? d.toISOString() : null
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

function listItems(list: unknown): { text: string; checked: boolean }[] {
  if (!Array.isArray(list)) return []
  return list
    .filter((i): i is { text?: unknown; isChecked?: unknown } => !!i && typeof i === 'object')
    .slice(0, 2000)
    .map(i => ({ text: str(i.text, 2000), checked: i.isChecked === true }))
}

/**
 * Converts one note. `readAttachment` returns the bytes of a file that sat next to the JSON, or null.
 * Returns null for notes in Keep's trash.
 */
export function keepToNote(
  j: KeepJson, path: string, readAttachment: (filePath: string) => Uint8Array | null, report: Reporter,
): DraftNote | null {
  if (j.isTrashed === true) { report('trashed-skipped'); return null }

  const parts: string[] = []
  const text = str(j.textContent, 200_000)
  // A loop rather than push(...lines): spreading a very long note would exceed the argument limit.
  if (text) for (const line of text.split(/\r?\n/)) parts.push(`<p>${escapeHtml(line)}</p>`)

  const items = listItems(j.listContent)
  if (items.length) {
    parts.push(`<ul data-type="taskList">${items.map(i =>
      `<li data-type="taskItem" data-checked="${i.checked}"><label><input type="checkbox"${i.checked ? ' checked' : ''}><span></span></label><div><p>${escapeHtml(i.text)}</p></div></li>`,
    ).join('')}</ul>`)
  }

  if (Array.isArray(j.annotations)) {
    for (const a of j.annotations.slice(0, 50)) {
      const link = a && typeof a === 'object' ? safeHref(str((a as { url?: unknown }).url, 2000)) : null
      if (!link) continue
      const title = str((a as { title?: unknown }).title, 200) || link
      parts.push(`<p><a href="${escapeHtml(link)}">${escapeHtml(title)}</a></p>`)
    }
  }

  if (Array.isArray(j.attachments)) {
    for (const a of j.attachments.slice(0, 50)) {
      const filePath = a && typeof a === 'object' ? str((a as { filePath?: unknown }).filePath, 300) : ''
      const bytes = filePath ? readAttachment(filePath) : null
      const mime = bytes ? sniffImage(bytes) : null
      if (!bytes || !mime) { report('attachment-skipped', filePath || 'attachment'); continue }
      if (bytes.length > MAX_IMAGE_BYTES) { report('image-too-large', filePath); continue }
      if (mime === 'image/svg+xml' && !isSafeSvg(bytes)) { report('unsafe-svg', filePath); continue }
      let bin = ''
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      parts.push(`<p><img src="data:${mime};base64,${btoa(bin)}"></p>`)
      report('image-embedded')
    }
  }

  const firstLine = (text.split(/\r?\n/).find(l => l.trim()) ?? items[0]?.text ?? '').trim()
  const created = toIso(j.createdTimestampUsec)
  const labels = Array.isArray(j.labels) ? j.labels : []
  return {
    path,
    title: str(j.title, 300).trim() || firstLine.slice(0, 60) || 'Untitled note',
    html: parts.join(''),
    tags: labels
      .map(l => (l && typeof l === 'object' ? toTagSlug(str((l as { name?: unknown }).name, 60)) : ''))
      .filter(Boolean).slice(0, 30),
    notebook: NOTEBOOK,
    createdAt: created,
    updatedAt: toIso(j.userEditedTimestampUsec) ?? created,
    pinned: j.isPinned === true,
  }
}
