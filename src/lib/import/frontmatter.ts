import { parse } from 'yaml'

export interface FrontMatterResult {
  data: Record<string, unknown>
  body: string
  /** Set when a front matter block was present but could not be parsed. */
  error?: string
}

/**
 * Splits a note into its YAML front matter and body.
 *
 * Front matter only counts at the very start of the file, delimited by `---` lines. A broken
 * block is not fatal: the note is still imported, with the block left in the text so nothing
 * the user wrote is lost, and the caller reports it.
 */
export function splitFrontMatter(raw: string): FrontMatterResult {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const open = /^---[ \t]*\n/.exec(text)
  if (!open) return { data: {}, body: text }

  const rest = text.slice(open[0].length)
  const close = /^(---|\.\.\.)[ \t]*$/m.exec(rest)
  if (!close) return { data: {}, body: text }

  const yamlText = rest.slice(0, close.index)
  const body = rest.slice(close.index + close[0].length).replace(/^\n/, '')

  // An empty block (`---\n---`) is valid and means "no properties".
  if (!yamlText.trim()) return { data: {}, body }

  try {
    const parsed: unknown = parse(yamlText)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { data: parsed as Record<string, unknown>, body }
    }
    return { data: {}, body: text, error: 'Front matter is not a set of properties' }
  } catch (e) {
    return { data: {}, body: text, error: e instanceof Error ? e.message.split('\n')[0] : 'Invalid front matter' }
  }
}

/** Accepts `tags: [a, b]`, `tags: a, b`, `tags: "#a #b"` and a single string. */
export function toStringList(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,\s]+/) : []
  return items
    .map(v => (typeof v === 'string' || typeof v === 'number' ? String(v) : ''))
    .map(v => v.trim().replace(/^#/, ''))
    .filter(Boolean)
}

/** Returns an ISO string for anything Date can parse, otherwise null. */
export function toIsoDate(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
