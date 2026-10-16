export interface ActionItem {
  text: string
  /** Who should do it, as named in the meeting; null when nobody was named. */
  owner: string | null
  /** The deadline as said ("Friday", "2026-10-30"); null when none was given. */
  due: string | null
}

export interface MeetingDigest {
  summary: string
  keyPoints: string[]
  decisions: string[]
  actionItems: ActionItem[]
  openQuestions: string[]
}

const MAX_LIST = 40
const MAX_TEXT = 600
const MAX_SUMMARY = 3000

export const emptyDigest = (): MeetingDigest => ({ summary: '', keyPoints: [], decisions: [], actionItems: [], openQuestions: [] })

const clean = (v: unknown, max = MAX_TEXT): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : ''

const cleanList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(x => clean(x)).filter(Boolean).slice(0, MAX_LIST) : []

/** Null for the many ways a model says "nobody" or "none". */
function optional(v: unknown, max = 80): string | null {
  const s = clean(v, max)
  return !s || /^(null|none|n\/?a|unknown|unassigned|nobody|tbd|unspecified|not (specified|mentioned|stated|given|provided|assigned)|[-—–])$/i.test(s) ? null : s
}

/** Finds the first complete {...} object in the text, ignoring braces inside strings. */
function firstJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  for (let i = start; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (c === '\\') i++
      else if (c === '"') inString = false
    } else if (c === '"') inString = true
    else if (c === '{') depth++
    else if (c === '}' && --depth === 0) return text.slice(start, i + 1)
  }
  return null
}

/**
 * Reads a model reply into a digest. Models wrap JSON in prose or code fences, so the first complete object is
 * used; every field is type-checked and length-limited because the reply is untrusted. Returns null when there is
 * nothing usable.
 */
export function parseDigest(reply: string): MeetingDigest | null {
  const json = firstJsonObject(reply)
  if (!json) return null
  let data: unknown
  try { data = JSON.parse(json) } catch { return null }
  if (!data || typeof data !== 'object') return null
  const o = data as Record<string, unknown>

  const actionItems: ActionItem[] = []
  if (Array.isArray(o.actionItems)) {
    for (const item of o.actionItems.slice(0, MAX_LIST)) {
      if (typeof item === 'string') {
        const text = clean(item)
        if (text) actionItems.push({ text, owner: null, due: null })
      } else if (item && typeof item === 'object') {
        const a = item as Record<string, unknown>
        const text = clean(a.text ?? a.task ?? a.action)
        if (text) actionItems.push({ text, owner: optional(a.owner ?? a.assignee), due: optional(a.due ?? a.deadline) })
      }
    }
  }

  const digest: MeetingDigest = {
    summary: clean(o.summary, MAX_SUMMARY),
    keyPoints: cleanList(o.keyPoints),
    decisions: cleanList(o.decisions),
    actionItems,
    openQuestions: cleanList(o.openQuestions),
  }
  const empty = !digest.summary && !digest.keyPoints.length && !digest.decisions.length && !digest.actionItems.length && !digest.openQuestions.length
  return empty ? null : digest
}

const sameText = (a: string, b: string) => a.toLowerCase().replace(/[^a-z0-9぀-鿿]+/g, '') === b.toLowerCase().replace(/[^a-z0-9぀-鿿]+/g, '')

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const out: T[] = []
  for (const item of items) if (!out.some(o => sameText(key(o), key(item)))) out.push(item)
  return out.slice(0, MAX_LIST)
}

const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9぀-鿿]+/).filter(w => w.length > 2 || /^\d+$/.test(w)))

/** Two owners can be the same person: equal names, or one part did not name anybody. */
const compatibleOwners = (a: string | null, b: string | null) => !a || !b || a.toLowerCase() === b.toLowerCase()

/**
 * The same task worded twice: identical text, or mostly the same words (for tasks long enough to compare), from the
 * same or an unnamed owner. The same words for two different people are two tasks.
 */
function sameAction(a: ActionItem, b: ActionItem): boolean {
  if (!compatibleOwners(a.owner, b.owner)) return false
  if (sameText(a.text, b.text)) return true
  const x = words(a.text), y = words(b.text)
  if (Math.min(x.size, y.size) < 3) return false
  let shared = 0
  for (const w of x) if (y.has(w)) shared++
  return shared / Math.min(x.size, y.size) >= 0.75
}

/** Action items from several parts with repeats removed. Nothing is dropped unless it is a repeat. */
export function mergeActionItems(items: ActionItem[]): ActionItem[] {
  const out: ActionItem[] = []
  for (const item of items) if (!out.some(o => sameAction(o, item))) out.push(item)
  return out.slice(0, MAX_LIST)
}

/** Combines the notes of several parts without the model: used when the final merge step fails. */
export function mergeDigests(parts: MeetingDigest[]): MeetingDigest {
  return {
    summary: parts.map(p => p.summary).filter(Boolean).join(' ').slice(0, MAX_SUMMARY),
    keyPoints: uniqueBy(parts.flatMap(p => p.keyPoints), s => s),
    decisions: uniqueBy(parts.flatMap(p => p.decisions), s => s),
    actionItems: mergeActionItems(parts.flatMap(p => p.actionItems)),
    openQuestions: uniqueBy(parts.flatMap(p => p.openQuestions), s => s),
  }
}

/**
 * An ISO date (YYYY-MM-DD) when the deadline is one, otherwise null. Words like "Friday" are left to the person.
 * When the transcript is given, the date must appear in it: small models invent a year for "Monday the 26th", and a
 * wrong due date on a task is worse than none.
 */
export function isoDue(due: string | null, transcript?: string): string | null {
  if (!due) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due.trim())
  if (!m) return null
  if (transcript !== undefined && !transcript.includes(m[0])) return null
  const date = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return date.getUTCFullYear() === +m[1] && date.getUTCMonth() === +m[2] - 1 && date.getUTCDate() === +m[3] ? m[0] : null
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const bullets = (items: string[]) => `<ul>${items.map(i => `<li><p>${esc(i)}</p></li>`).join('')}</ul>`

const taskItem = (a: ActionItem) => {
  const meta = [a.owner ? `<strong>${esc(a.owner)}</strong>` : '', a.due ? `due ${esc(a.due)}` : ''].filter(Boolean).join(', ')
  return `<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>${esc(a.text)}${meta ? ` (${meta})` : ''}</p></div></li>`
}

/** The digest as note content. Every piece of text is escaped, so a hostile transcript cannot inject markup. */
export function digestToHtml(digest: MeetingDigest, opts: { attendees?: string[] } = {}): string {
  const parts: string[] = []
  if (opts.attendees?.length) parts.push(`<h2>Attendees</h2>${bullets(opts.attendees)}`)
  if (digest.summary) parts.push(`<h2>Summary</h2><p>${esc(digest.summary)}</p>`)
  if (digest.keyPoints.length) parts.push(`<h2>Key points</h2>${bullets(digest.keyPoints)}`)
  if (digest.decisions.length) parts.push(`<h2>Decisions</h2>${bullets(digest.decisions)}`)
  if (digest.actionItems.length) parts.push(`<h2>Action items</h2><ul data-type="taskList">${digest.actionItems.map(taskItem).join('')}</ul>`)
  if (digest.openQuestions.length) parts.push(`<h2>Open questions</h2>${bullets(digest.openQuestions)}`)
  return parts.join('')
}
