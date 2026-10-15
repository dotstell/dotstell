import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { safeHref } from '../export/urls'
import { escapeHtml } from './markdown'
import { md5Hex } from './md5'
import { isSafeSvg, sniffImage } from './safety'
import { MAX_IMAGE_BYTES, toTagSlug, type DraftNote, type Reporter } from './types'

// Evernote exports one .enex (XML) file per notebook. Each <note> holds its body as ENML, an
// XHTML dialect, inside CDATA, plus its attachments as base64. Everything in the file is untrusted,
// so the body is never passed through: it is rebuilt element by element from an allow-list.

type PNode = Record<string, unknown>

const MAX_DEPTH = 100

const OUTER = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: false,
  isArray: name => name === 'note' || name === 'tag' || name === 'resource',
})

const INNER = new XMLParser({
  preserveOrder: true,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
  htmlEntities: true,
})

const BLOCK = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'table', 'hr'])
const KEEP_BLOCK = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'table', 'thead', 'tbody', 'tr', 'td', 'th'])
const INLINE: Record<string, string> = {
  b: 'strong', strong: 'strong', i: 'em', em: 'em', u: 'u', s: 's', strike: 's', del: 's', sub: 'sub', sup: 'sup', code: 'code',
}
// Dropped with everything inside them.
const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'svg', 'math', 'head', 'title', 'meta', 'link', 'base', 'input', 'button', 'textarea', 'select'])

const tagOf = (n: PNode) => Object.keys(n).find(k => k !== ':@') ?? null
const attrsOf = (n: PNode) => (n[':@'] as Record<string, string> | undefined) ?? {}
const childrenOf = (n: PNode, tag: string) => (Array.isArray(n[tag]) ? (n[tag] as PNode[]) : [])

interface Resource {
  mime: string
  name: string
  image: { b64: string; mime: string } | null
  hash: string | null
}

interface Ctx {
  media: (hash: string | undefined) => string
  report: Reporter
}

function taskItem(checked: boolean, inner: string): string {
  return `<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox"${checked ? ' checked' : ''}><span></span></label><div><p>${inner}</p></div></li>`
}

/** `<div><en-todo/>text</div>` is Evernote's checklist line; returns the state and what follows the box. */
function leadingTodo(node: PNode, tag: string): { checked: boolean; rest: PNode[] } | null {
  if (tag !== 'div' && tag !== 'p') return null
  const kids = childrenOf(node, tag)
  const first = kids.findIndex(k => !(tagOf(k) === '#text' && String(k['#text']).trim() === ''))
  if (first < 0 || tagOf(kids[first]) !== 'en-todo') return null
  return { checked: attrsOf(kids[first])['@_checked'] === 'true', rest: kids.slice(first + 1) }
}

function renderNodes(nodes: PNode[], ctx: Ctx, depth: number): string {
  if (depth > MAX_DEPTH) return ''
  const parts: string[] = []
  let tasks: string[] = []
  const flush = () => {
    if (tasks.length) parts.push(`<ul data-type="taskList">${tasks.join('')}</ul>`)
    tasks = []
  }

  for (const n of nodes) {
    const tag = tagOf(n)
    if (!tag) continue
    if (tag === '#text') {
      const text = String(n['#text'])
      // Line breaks between elements are formatting of the XML, not content.
      if (text.trim() === '' && text.includes('\n')) continue
      flush()
      parts.push(escapeHtml(text))
      continue
    }
    const todo = leadingTodo(n, tag)
    if (todo) {
      tasks.push(taskItem(todo.checked, renderNodes(todo.rest, ctx, depth + 1)))
      continue
    }
    flush()
    parts.push(renderElement(n, tag, ctx, depth))
  }
  flush()
  return parts.join('')
}

function renderElement(n: PNode, tag: string, ctx: Ctx, depth: number): string {
  const attrs = attrsOf(n)
  const kids = childrenOf(n, tag)
  const inner = () => renderNodes(kids, ctx, depth + 1)

  if (DROP.has(tag)) return ''
  switch (tag) {
    case 'br': return '<br>'
    case 'hr': return '<hr>'
    case 'en-todo': return attrs['@_checked'] === 'true' ? '☑ ' : '☐ '
    case 'en-media': return ctx.media(attrs['@_hash'])
    case 'en-crypt':
      ctx.report('encrypted-text')
      return '<em>[encrypted text not imported]</em>'
    case 'div':
      return kids.some(k => BLOCK.has(tagOf(k) ?? '')) ? inner() : `<p>${inner()}</p>`
    case 'a': {
      const href = safeHref(attrs['@_href'] ?? '')
      if (!href) {
        if (attrs['@_href']) ctx.report('link-removed')
        return inner()
      }
      return `<a href="${escapeHtml(href)}">${inner()}</a>`
    }
  }
  if (INLINE[tag]) return `<${INLINE[tag]}>${inner()}</${INLINE[tag]}>`
  if (KEEP_BLOCK.has(tag)) return `<${tag}>${inner()}</${tag}>`
  // span, font and anything unknown: keep the words, lose the element.
  return inner()
}

/** Evernote writes `20200131T093000Z`. */
function toIso(v: unknown): string | null {
  const m = typeof v === 'string' ? /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/.exec(v.trim()) : null
  if (!m) return null
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]))
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function decodeBase64(b64: string): Uint8Array | null {
  try {
    const bin = atob(b64)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

function readResources(raw: PNode[], report: Reporter): Resource[] {
  return raw.map(r => {
    const mime = String(r.mime ?? '').toLowerCase()
    const name = String((r['resource-attributes'] as PNode | undefined)?.['file-name'] ?? 'attachment').slice(0, 120)
    const b64 = String(r.data ?? '').replace(/\s+/g, '')
    const res: Resource = { mime, name, image: null, hash: null }

    if (!mime.startsWith('image/')) {
      report('attachment-skipped', name)
      return res
    }
    // base64 is 4/3 the size of the bytes; refuse before decoding something large.
    if (b64.length > MAX_IMAGE_BYTES * 1.4) {
      report('image-too-large', name)
      return res
    }
    const bytes = decodeBase64(b64)
    const real = bytes ? sniffImage(bytes) : null
    if (!bytes || !real) { report('fake-image', name); return res }
    if (real === 'image/svg+xml' && !isSafeSvg(bytes)) { report('unsafe-svg', name); return res }
    res.hash = md5Hex(bytes)
    res.image = { b64, mime: real }
    return res
  })
}

function convertNote(note: PNode, notebook: string, path: string, report: Reporter): DraftNote | null {
  const resources = readResources((note.resource as PNode[] | undefined) ?? [], report)
  const byHash = new Map(resources.filter(r => r.hash).map(r => [r.hash as string, r]))

  const ctx: Ctx = {
    report,
    media: hash => {
      const r = hash ? byHash.get(hash.toLowerCase()) : undefined
      if (!r?.image) return '<em>[attachment not imported]</em>'
      report('image-embedded')
      return `<img src="data:${r.image.mime};base64,${r.image.b64}">`
    },
  }

  let html = ''
  const content = typeof note.content === 'string' ? note.content : ''
  try {
    const tree = INNER.parse(content) as PNode[]
    const root = tree.find(n => tagOf(n) === 'en-note')
    html = root ? renderNodes(childrenOf(root, 'en-note'), ctx, 0) : ''
  } catch {
    report('unreadable-file', path)
    return null
  }

  const attrs = (note['note-attributes'] as PNode | undefined) ?? {}
  const source = safeHref(String(attrs['source-url'] ?? ''))
  if (source && source.startsWith('http')) html += `<p>Source: <a href="${escapeHtml(source)}">${escapeHtml(source)}</a></p>`

  const created = toIso(note.created)
  return {
    path,
    title: String(note.title ?? '').trim().slice(0, 300) || 'Untitled',
    html,
    tags: ((note.tag as unknown[] | undefined) ?? []).map(t => toTagSlug(String(t))).filter(Boolean).slice(0, 30),
    notebook,
    createdAt: created,
    updatedAt: toIso(note.updated) ?? created,
    pinned: false,
  }
}

/** Reads one .enex file. `notebook` is the file's name, which is how Evernote names a notebook export. */
export function parseEnex(xml: string, notebook: string, path: string, report: Reporter): DraftNote[] {
  // Custom entities are how XML "billion laughs" attacks work. Evernote never writes them.
  if (/<!ENTITY/i.test(xml)) {
    report('xml-entities', path)
    return []
  }
  // The parser forgives broken markup by guessing; a damaged file should be refused, not half-read.
  if (XMLValidator.validate(xml) !== true) {
    report('unreadable-file', path)
    return []
  }
  let notes: PNode[]
  try {
    const parsed = OUTER.parse(xml) as { 'en-export'?: { note?: PNode[] } }
    notes = parsed['en-export']?.note ?? []
  } catch {
    report('unreadable-file', path)
    return []
  }
  if (!Array.isArray(notes)) return []
  return notes.map(n => convertNote(n, notebook, path, report)).filter((n): n is DraftNote => n !== null)
}
