import type { PlannedContact, Reporter } from './types'

// vCard (.vcf) is what phones and address books export; Google Contacts and Outlook export CSV.
// The people table holds a name, role, company, one email and one phone. Everything else in a
// contact (addresses, birthdays, notes, photos) is not stored, and the preview says so.

const MAX_CONTACTS = 20_000
const LIMITS = { name: 200, role: 200, company: 200, email: 254, phone: 50 }

// Control characters would only ever be hostile or corrupt in a name or phone number.
const clean = (v: string | null | undefined, max: number): string | null => {
  const s = (v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
  return s || null
}

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/

function finish(raw: { name?: string | null; role?: string | null; company?: string | null; email?: string | null; phone?: string | null }): PlannedContact | null {
  const email = clean(raw.email, LIMITS.email)
  const name = clean(raw.name, LIMITS.name) ?? (email && EMAIL.test(email) ? email : null)
  if (!name) return null
  return {
    name,
    role: clean(raw.role, LIMITS.role),
    company: clean(raw.company, LIMITS.company),
    email: email && EMAIL.test(email) ? email : null,
    phone: clean(raw.phone, LIMITS.phone),
  }
}

/** The same person twice in one file is one person. */
export function dedupeContacts(list: PlannedContact[]): PlannedContact[] {
  const seen = new Set<string>()
  return list.filter(c => {
    const key = c.email ? `e:${c.email.toLowerCase()}` : `n:${c.name.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, MAX_CONTACTS)
}

// ── vCard ───────────────────────────────────────────────────

function decodeQuotedPrintable(v: string): string {
  const bytes: number[] = []
  for (let i = 0; i < v.length; i++) {
    if (v[i] === '=' && /^[0-9a-f]{2}$/i.test(v.slice(i + 1, i + 3))) { bytes.push(parseInt(v.slice(i + 1, i + 3), 16)); i += 2 }
    else bytes.push(...new TextEncoder().encode(v[i]))
  }
  return new TextDecoder().decode(Uint8Array.from(bytes))
}

const unescapeVcard = (v: string) => v.replace(/\\([nN,;\\])/g, (_, c: string) => (c === 'n' || c === 'N' ? ' ' : c))

function unfold(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    // vCard 2.1 quoted-printable values continue on the next line after a trailing "=".
    while (/quoted-printable/i.test(line.split(':')[0]) && line.endsWith('=') && i + 1 < lines.length) line = line.slice(0, -1) + lines[++i]
    // Folded lines (3.0 / 4.0) continue with a leading space or tab.
    if (/^[ \t]/.test(line) && out.length) out[out.length - 1] += line.slice(1)
    else out.push(line)
  }
  return out
}

export function parseVcf(text: string, report: Reporter): PlannedContact[] {
  const contacts: PlannedContact[] = []
  let card: Record<string, string[]> | null = null
  let extras = 0

  for (const line of unfold(text)) {
    const upper = line.toUpperCase()
    if (upper === 'BEGIN:VCARD') { card = {}; continue }
    if (upper === 'END:VCARD') {
      if (card) {
        const n = (card.N?.[0] ?? '').split(';')
        const fromN = [n[3], n[1], n[2], n[0]].filter(Boolean).join(' ')
        const c = finish({
          name: card.FN?.[0] || fromN,
          role: card.TITLE?.[0] || card.ROLE?.[0],
          company: (card.ORG?.[0] ?? '').split(';')[0],
          email: card.EMAIL?.[0],
          phone: card.TEL?.[0],
        })
        if (c) contacts.push(c)
        if (Object.keys(card).some(k => ['ADR', 'BDAY', 'NOTE', 'URL', 'PHOTO'].includes(k))) extras++
      }
      card = null
      if (contacts.length >= MAX_CONTACTS) break
      continue
    }
    if (!card) continue

    const colon = line.indexOf(':')
    if (colon < 1) continue
    const [rawName, ...params] = line.slice(0, colon).split(';')
    // "item1.EMAIL" is Apple's grouping prefix.
    const name = rawName.split('.').pop()!.toUpperCase()
    if (name === 'PHOTO' || name === 'LOGO' || name === 'KEY' || name === 'SOUND') { card[name] = ['']; continue }
    let value = line.slice(colon + 1)
    if (params.some(p => /^encoding=quoted-printable$/i.test(p) || /^quoted-printable$/i.test(p))) value = decodeQuotedPrintable(value)
    ;(card[name] ??= []).push(name === 'N' || name === 'ORG' ? value.replace(/\\([,\\])/g, '$1') : unescapeVcard(value))
  }
  if (extras) report('extra-contact-fields', String(extras))
  return dedupeContacts(contacts)
}

// ── CSV ─────────────────────────────────────────────────────

/** RFC 4180 with quoted fields that may contain delimiters, quotes and line breaks. */
export function parseCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  const src = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++ } else quoted = false }
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === delimiter) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some(c => c !== '')) rows.push(row)
      row = []
      if (rows.length > MAX_CONTACTS + 1) return rows
    } else cell += ch
  }
  row.push(cell)
  if (row.some(c => c !== '')) rows.push(row)
  return rows
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '')
const NAME = new Set(['name', 'fullname', 'displayname', 'contactname'])
const FIRST = new Set(['firstname', 'givenname'])
const LAST = new Set(['lastname', 'familyname', 'surname'])
const EMAIL_COL = (h: string) => /^(e?mail|email\d*(value|address)?|emailaddress\d*|primaryemail)$/.test(h)
const PHONE_COL = (h: string) => /^(phone|telephone|mobile|mobilephone|businessphone|homephone|primaryphone|phonenumber|phone\d*(value|number)?)$/.test(h)
const COMPANY = new Set(['company', 'organization', 'organizationname', 'organization1name', 'org', 'companyname'])
const ROLE = new Set(['jobtitle', 'title', 'role', 'position', 'organizationtitle', 'organization1title'])

/**
 * Reads a CSV as contacts when its header looks like an address book: a name column plus an
 * email or phone column. Any other CSV (a spreadsheet, a Notion database) returns null.
 */
export function parseContactsCsv(text: string): PlannedContact[] | null {
  const head = text.slice(0, 2000).split(/\r?\n/)[0] ?? ''
  const delimiter = [',', ';', '\t'].map(d => [d, head.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0]
  const rows = parseCsv(text, delimiter)
  if (rows.length < 2) return null

  const header = rows[0].map(norm)
  const idx = (match: (h: string) => boolean) => header.flatMap((h, i) => (match(h) ? [i] : []))
  const nameCols = idx(h => NAME.has(h)), first = idx(h => FIRST.has(h)), last = idx(h => LAST.has(h))
  const emailCols = idx(EMAIL_COL), phoneCols = idx(PHONE_COL)
  if (!(nameCols.length || first.length || last.length) || !(emailCols.length || phoneCols.length)) return null

  const company = idx(h => COMPANY.has(h)), role = idx(h => ROLE.has(h))
  const pick = (r: string[], cols: number[]) => cols.map(i => r[i]?.trim()).find(Boolean) ?? null

  const out: PlannedContact[] = []
  for (const r of rows.slice(1, MAX_CONTACTS + 1)) {
    const name = pick(r, nameCols) ?? [pick(r, first), pick(r, last)].filter(Boolean).join(' ')
    const c = finish({ name, role: pick(r, role), company: pick(r, company), email: pick(r, emailCols), phone: pick(r, phoneCols) })
    if (c) out.push(c)
  }
  return dedupeContacts(out)
}
