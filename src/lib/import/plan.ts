import { dedupeContacts, parseContactsCsv, parseVcf } from './contacts'
import { parseEnex } from './evernote'
import { keepToNote, readKeepJson } from './keep'
import { containsActiveContent, extensionOf, hasUnsafePath } from './safety'
import type { DraftNote, PlannedContact, ReportKind, Reporter } from './types'
import { isIgnorable, MAX_NOTE_HTML, planMarkdownImport, type ImportPlan, type PlanOptions, type PlannedNote, type VaultFile } from './vault'

const decode = (data: Uint8Array) => new TextDecoder('utf-8').decode(data)
const norm = (p: string) => p.replace(/\\/g, '/').replace(/^\.?\/+/, '')
const baseName = (p: string) => p.slice(p.lastIndexOf('/') + 1)
const stem = (p: string) => baseName(p).replace(/\.[^.]+$/, '')

/**
 * Turns whatever the user chose into one plan. Evernote (.enex), Google Keep (Takeout JSON) and
 * contact files (.vcf, .csv) are recognised by what they contain; everything else goes through the
 * Markdown planner, which also reports the files nothing could read.
 */
export function planImport(input: VaultFile[], options: PlanOptions = {}): ImportPlan {
  const newId = options.newId ?? (() => crypto.randomUUID())

  const counts = new Map<ReportKind, Map<string, number>>()
  const report: Reporter = (kind, detail = '') => {
    const m = counts.get(kind) ?? new Map<string, number>()
    m.set(detail, (m.get(detail) ?? 0) + 1)
    counts.set(kind, m)
  }
  const total = (kind: ReportKind) => [...(counts.get(kind)?.values() ?? [])].reduce((a, b) => a + b, 0)
  const names = (kind: ReportKind) => [...(counts.get(kind)?.keys() ?? [])].filter(Boolean).slice(0, 3).join(', ')

  // Unsafe or hidden paths are left for the Markdown planner, which refuses and reports them.
  const candidates = input.filter(f => !hasUnsafePath(f.path) && !isIgnorable(norm(f.path)))
  const byPath = new Map(candidates.map(f => [norm(f.path).toLowerCase(), f]))

  const consumed = new Set<VaultFile>()
  const drafts: DraftNote[] = []
  const contacts: PlannedContact[] = []
  const keepStems = new Set<string>()

  for (const f of candidates) {
    const ext = extensionOf(f.path)
    const path = norm(f.path)

    if (ext === 'enex') {
      consumed.add(f)
      // Loops rather than push(...list): a large export would exceed the argument limit.
      for (const d of parseEnex(decode(f.data), stem(path).slice(0, 100).trim() || 'Evernote', path, report)) drafts.push(d)
    } else if (ext === 'vcf') {
      consumed.add(f)
      for (const c of parseVcf(decode(f.data), report)) contacts.push(c)
    } else if (ext === 'csv') {
      const parsed = parseContactsCsv(decode(f.data))
      if (parsed) { consumed.add(f); for (const c of parsed) contacts.push(c) }
    } else if (ext === 'json') {
      const keep = readKeepJson(f.data)
      if (!keep) continue
      consumed.add(f)
      keepStems.add(path.slice(0, -'.json'.length).toLowerCase())
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : ''
      const note = keepToNote(keep, path, rel => (hasUnsafePath(rel) ? null : byPath.get((dir + norm(rel)).toLowerCase())?.data ?? null), report)
      if (note) drafts.push(note)
    }
  }

  // Takeout repeats every Keep note as an .html page and adds a label list; they hold nothing new.
  if (keepStems.size) {
    for (const f of candidates) {
      const path = norm(f.path)
      const ext = extensionOf(path)
      const lower = baseName(path).toLowerCase()
      if (((ext === 'html' || ext === 'htm') && keepStems.has(path.replace(/\.[^.]+$/, '').toLowerCase())) ||
          lower === 'archive_browser.html' || lower === 'labels.txt') consumed.add(f)
    }
  }

  const markdown = planMarkdownImport(input.filter(f => !consumed.has(f)), options)

  // The last checks before saving, applied to everything the adapters produced.
  let refusedActive = 0
  let tooLarge = 0
  const adapted: PlannedNote[] = []
  for (const d of drafts) {
    if (containsActiveContent(d.html)) { refusedActive++; continue }
    if (d.html.length > MAX_NOTE_HTML) { tooLarge++; continue }
    adapted.push({
      id: newId(), path: d.path, title: d.title, html: d.html, tags: [...new Set(d.tags)],
      notebook: d.notebook, createdAt: d.createdAt, updatedAt: d.updatedAt, pinned: d.pinned,
      parentId: null, linkedIds: [],
    })
  }

  const issues = [...markdown.report.issues]
  const warnings = [...markdown.report.warnings]
  if (total('image-too-large')) issues.push(`${total('image-too-large')} image(s) over 500 KB were left out.`)
  if (total('attachment-skipped')) issues.push(`${total('attachment-skipped')} attachment(s) (PDFs, audio …) were not imported.`)
  if (total('link-removed')) issues.push(`${total('link-removed')} link(s) with an unsafe address were removed.`)
  if (total('encrypted-text')) issues.push(`${total('encrypted-text')} encrypted text block(s) cannot be read and were left out.`)
  if (total('trashed-skipped')) issues.push(`${total('trashed-skipped')} note(s) in Google Keep's trash were skipped.`)
  if (total('extra-contact-fields')) issues.push('Addresses, birthdays, notes and photos on contacts are not stored: dotstell keeps name, role, company, email and phone.')

  if (total('fake-image')) warnings.push(`${total('fake-image')} attachment(s) with an image type are not valid images and were refused.`)
  if (total('unsafe-svg')) warnings.push(`${total('unsafe-svg')} SVG image(s) contain scripts or external references and were refused.`)
  if (total('unreadable-file')) warnings.push(`${total('unreadable-file')} file(s) could not be read and were skipped: ${names('unreadable-file')}.`)
  if (total('xml-entities')) warnings.push(`${total('xml-entities')} file(s) use XML features that are not allowed and were refused: ${names('xml-entities')}.`)
  if (refusedActive) warnings.push(`${refusedActive} note(s) contained scripts or unsafe code and were refused.`)
  if (tooLarge) warnings.push(`${tooLarge} note(s) are too large to import (over 2 MB of content) and were skipped.`)

  const notes = [...markdown.notes, ...adapted]
  const notebooks = [...new Set([...markdown.notebooks, ...adapted.flatMap(n => (n.notebook ? [n.notebook] : []))])]
  const people = dedupeContacts(contacts)

  return {
    notes,
    contacts: people,
    notebooks,
    report: {
      notes: notes.length,
      contacts: people.length,
      notebooks: notebooks.length,
      images: { embedded: markdown.report.images.embedded + total('image-embedded'), skipped: markdown.report.images.skipped },
      links: markdown.report.links,
      issues,
      warnings,
    },
  }
}
