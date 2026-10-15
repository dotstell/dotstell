import { describe, it, expect } from 'vitest'
import { strToU8 } from 'fflate'
import { md5Hex } from './md5'
import { planImport } from './plan'
import { parseContactsCsv, parseVcf } from './contacts'
import { batchNotes } from './run'
import type { PlannedNote, VaultFile } from './vault'

const PNG_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const PNG = Uint8Array.from(atob(PNG_B64), c => c.charCodeAt(0))
const file = (path: string, text: string): VaultFile => ({ path, data: strToU8(text) })
let counter = 0
const run = (files: VaultFile[]) => {
  counter = 0
  return planImport(files, { newId: () => `id${++counter}` })
}
const warnings = (p: ReturnType<typeof run>) => p.report.warnings.join(' | ')

describe('md5', () => {
  it('matches known digests', () => {
    expect(md5Hex(strToU8(''))).toBe('d41d8cd98f00b204e9800998ecf8427e')
    expect(md5Hex(strToU8('abc'))).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(md5Hex(strToU8('The quick brown fox jumps over the lazy dog'))).toBe('9e107d9d372bb6826bd81d3542a419d6')
  })
})

describe('Evernote (.enex)', () => {
  const hash = md5Hex(PNG)
  const enml = (body: string) =>
    `<![CDATA[<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE en-note SYSTEM "http://xml.evernote.com/pub/enml2.dtd"><en-note>${body}</en-note>]]>`
  const enex = (notes: string) =>
    `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE en-export SYSTEM "http://xml.evernote.com/pub/evernote-export4.dtd"><en-export export-date="20260101T000000Z">${notes}</en-export>`

  const good = enex(`<note><title>Trip plan &amp; ideas</title><created>20260105T093000Z</created><updated>20260106T101500Z</updated>
    <tag>Travel Plans</tag><tag>2026</tag>
    <note-attributes><source-url>https://example.com/page</source-url></note-attributes>
    <content>${enml(
      '<div><b>Bold</b> and <i>italic</i> <a href="https://ok.example/">link</a> <a href="javascript:alert(1)">bad link</a></div>' +
      '<div><en-todo checked="true"/>packed</div><div><en-todo/>book hotel</div>' +
      `<div><en-media hash="${hash}" type="image/png"/></div><div><en-media hash="deadbeef" type="image/png"/></div>` +
      '<div><en-crypt hint="x">AAAA</en-crypt></div>' +
      '<script>alert(1)</script><div onclick="evil()">plain &lt;b&gt;</div>' +
      '<table><tr><td>a</td><td>b</td></tr></table>',
    )}</content>
    <resource><data encoding="base64">${PNG_B64}</data><mime>image/png</mime><resource-attributes><file-name>pic.png</file-name></resource-attributes></resource>
    <resource><data encoding="base64">AAAA</data><mime>application/pdf</mime><resource-attributes><file-name>doc.pdf</file-name></resource-attributes></resource>
    </note>`)
  const plan = run([file('Evernote/My Notes.enex', good)])
  const note = plan.notes[0]

  it('creates a note in a notebook named after the file', () => {
    expect(plan.notes).toHaveLength(1)
    expect(note.title).toBe('Trip plan & ideas')
    expect(note.notebook).toBe('My Notes')
    expect(plan.notebooks).toEqual(['My Notes'])
  })
  it('keeps tags, dates and the source link', () => {
    expect(note.tags).toEqual(['travel-plans', '2026'])
    expect(note.createdAt).toBe('2026-01-05T09:30:00.000Z')
    expect(note.updatedAt).toBe('2026-01-06T10:15:00.000Z')
    expect(note.html).toContain('<a href="https://example.com/page">')
  })
  it('converts formatting and checklists to editor HTML', () => {
    expect(note.html).toContain('<strong>Bold</strong>')
    expect(note.html).toContain('<ul data-type="taskList">')
    expect(note.html).toContain('data-checked="true"')
    expect(note.html).toContain('data-checked="false"')
    expect(note.html).toContain('<table>')
  })
  it('embeds the image found by hash and flags the one it cannot match', () => {
    expect((note.html.match(/<img src="data:image\/png;base64,/g) ?? []).length).toBe(1)
    expect(note.html).toContain('[attachment not imported]')
  })
  it('neutralises scripts, handlers and javascript: links', () => {
    expect(note.html).not.toContain('<script')
    expect(note.html).not.toContain('alert(1)')
    expect(note.html).not.toContain('onclick')
    expect(note.html).not.toContain('javascript:')
    expect(note.html).toContain('bad link')
    expect(note.html).toContain('plain &lt;b&gt;')
    expect(note.html).toContain('[encrypted text not imported]')
  })
  it('reports what it left out', () => {
    expect(plan.report.issues.join(' ')).toMatch(/1 attachment\(s\)/)
    expect(plan.report.issues.join(' ')).toMatch(/1 link\(s\) with an unsafe address/)
    expect(plan.report.issues.join(' ')).toMatch(/1 encrypted text/)
  })
  it('refuses files that define XML entities', () => {
    const bomb = '<?xml version="1.0"?><!DOCTYPE en-export [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]><en-export><note><title>&b;</title></note></en-export>'
    const p = run([file('x.enex', bomb)])
    expect(p.notes).toHaveLength(0)
    expect(warnings(p)).toMatch(/XML features that are not allowed/)
  })
  it('survives broken XML and an image that is not an image', () => {
    const p = run([
      file('broken.enex', '<en-export><note><title>x'),
      file('fake.enex', enex(
        `<note><title>Fake</title><content>${enml('<div><en-media hash="x" type="image/png"/></div>')}</content>` +
        '<resource><data>PGh0bWw+PHNjcmlwdD4=</data><mime>image/png</mime></resource></note>')),
    ])
    expect(p.notes.map(x => x.title)).toEqual(['Fake'])
    expect(warnings(p)).toMatch(/not valid images/)
    expect(p.notes[0].html).not.toContain('<img')
  })
  it('refuses absurdly nested notes without crashing', () => {
    const deep = '<div>'.repeat(5000) + 'x' + '</div>'.repeat(5000)
    const p = run([file('deep.enex', enex(`<note><title>Deep</title><content>${enml(deep)}</content></note>`))])
    expect(p.notes).toHaveLength(0)
    expect(warnings(p)).toMatch(/could not be read/)
  })
})

describe('Google Keep (Takeout)', () => {
  const usec = (iso: string) => Date.parse(iso) * 1000
  const keep = (o: object) => JSON.stringify({
    color: 'DEFAULT', isTrashed: false, isPinned: false, isArchived: false,
    userEditedTimestampUsec: usec('2026-02-02T00:00:00Z'), createdTimestampUsec: usec('2026-02-01T00:00:00Z'), ...o,
  })
  const plan = run([
    file('Takeout/Keep/Groceries.json', keep({ title: 'Groceries', isPinned: true, listContent: [{ text: 'milk', isChecked: true }, { text: '<img src=x onerror=1>', isChecked: false }], labels: [{ name: 'Home Stuff' }] })),
    file('Takeout/Keep/Groceries.html', '<script>alert(1)</script>'),
    file('Takeout/Keep/Idea.json', keep({
      textContent: 'First line\nSecond line',
      annotations: [{ url: 'https://example.com', title: 'Example' }, { url: 'javascript:alert(1)', title: 'bad' }],
      attachments: [{ filePath: 'pic.png', mimetype: 'image/png' }, { filePath: '../../etc/passwd', mimetype: 'image/png' }],
    })),
    { path: 'Takeout/Keep/pic.png', data: PNG },
    file('Takeout/Keep/Gone.json', keep({ title: 'Gone', textContent: 'x', isTrashed: true })),
    file('Takeout/Keep/Labels.txt', 'Home Stuff'),
    file('Takeout/archive_browser.html', '<html></html>'),
    file('Takeout/other.json', JSON.stringify({ hello: 'world' })),
  ])
  const byTitle = (t: string) => plan.notes.find(x => x.title === t)!

  it('imports each note into a Google Keep notebook and skips trash', () => {
    expect(plan.notes.map(x => x.title).sort()).toEqual(['First line', 'Groceries'])
    expect(plan.notebooks).toEqual(['Google Keep'])
    expect(plan.report.issues.join(' ')).toMatch(/1 note\(s\) in Google Keep's trash/)
  })
  it('turns lists into checklists, escaping their text', () => {
    const g = byTitle('Groceries')
    expect(g.html).toContain('data-checked="true"')
    expect(g.html).toContain('&lt;img src=x onerror=1&gt;')
    expect(g.html).not.toContain('<img')
    expect(g.pinned).toBe(true)
    expect(g.tags).toEqual(['home-stuff'])
    expect(g.createdAt).toBe('2026-02-01T00:00:00.000Z')
  })
  it('titles untitled notes from the first line, and keeps safe links and images only', () => {
    const i = byTitle('First line')
    expect(i.html).toContain('<a href="https://example.com/">Example</a>')
    expect(i.html).not.toContain('javascript:')
    expect((i.html.match(/<img src="data:image\/png/g) ?? []).length).toBe(1)
  })
  it('ignores the duplicate HTML pages; unrelated JSON stays unsupported', () => {
    expect(warnings(plan)).toBe('')
    expect(plan.report.issues.join(' ')).toMatch(/\.json ×1/)
  })
})

describe('contacts', () => {
  const vcf = [
    'BEGIN:VCARD', 'VERSION:3.0', 'FN:Aiko Tanaka', 'ORG:Rakuten;Security', 'TITLE:SRE',
    'EMAIL;TYPE=work:aiko@example.com', 'TEL;TYPE=cell:+81 90 1234 5678', 'NOTE:long',
    ' note folded', 'PHOTO;ENCODING=b:AAAA', 'END:VCARD',
    'BEGIN:VCARD', 'VERSION:2.1', 'N:Smith;Jo;;Dr.;', 'EMAIL:jo@example.com', 'END:VCARD',
    'BEGIN:VCARD', 'VERSION:2.1', 'FN;ENCODING=QUOTED-PRINTABLE;CHARSET=UTF-8:=E7=94=B0=E4=B8=AD', 'END:VCARD',
    'BEGIN:VCARD', 'FN:Aiko Tanaka', 'EMAIL:AIKO@example.com', 'END:VCARD',
    'BEGIN:VCARD', 'EMAIL:not-an-email', 'END:VCARD',
  ].join('\r\n')

  it('reads vCards, folded lines, quoted-printable and drops duplicates', () => {
    const list = parseVcf(vcf, () => {})
    expect(list.map(c => c.name)).toEqual(['Aiko Tanaka', 'Dr. Jo Smith', '田中'])
    expect(list[0]).toMatchObject({ company: 'Rakuten', role: 'SRE', email: 'aiko@example.com', phone: '+81 90 1234 5678' })
  })
  it('reads Google-style and semicolon-separated CSV', () => {
    const google = 'First Name,Last Name,E-mail 1 - Value,Phone 1 - Value,Organization Name\r\nAiko,Tanaka,a@x.jp,"+81 3 1111",Rakuten\r\nJo,"Smith, Jr",,,\r\n'
    const g = parseContactsCsv(google)!
    expect(g[0]).toMatchObject({ name: 'Aiko Tanaka', email: 'a@x.jp', company: 'Rakuten' })
    expect(g[1].name).toBe('Jo Smith, Jr')
    expect(parseContactsCsv('Name;Email\nKai;k@x.com\n')![0]).toMatchObject({ name: 'Kai', email: 'k@x.com' })
  })
  it('does not mistake other spreadsheets for contacts', () => {
    expect(parseContactsCsv('Product,Price\nTea,3\n')).toBeNull()
    expect(parseContactsCsv('Name,Score\nAiko,3\n')).toBeNull()
  })
  it('strips control characters from names', () => {
    const c = parseContactsCsv('Name,Email\n"=1+1\u0007x",a@x.com\n')![0]
    expect(c.name).toBe('=1+1 x')
  })
  it('flows through planImport next to notes', () => {
    const p = run([file('people.vcf', vcf), file('note.md', 'hi')])
    expect(p.contacts).toHaveLength(3)
    expect(p.notes).toHaveLength(1)
    expect(p.report.contacts).toBe(3)
    expect(p.report.issues.join(' ')).toMatch(/Addresses, birthdays/)
  })
})

describe('batching', () => {
  const note = (len: number): PlannedNote => ({
    id: String(Math.random()), path: '', title: '', html: 'x'.repeat(len), tags: [], notebook: null,
    createdAt: null, updatedAt: null, pinned: false, parentId: null, linkedIds: [],
  })
  it('keeps every request under the body limit and at most 25 notes', () => {
    expect(batchNotes([...Array(60)].map(() => note(10))).map(b => b.length)).toEqual([25, 25, 10])
    const big = batchNotes([note(1_500_000), note(1_500_000), note(1_500_000)])
    expect(big.map(b => b.length)).toEqual([2, 1])
    expect(big.every(b => b.reduce((s, x) => s + x.html.length, 0) <= 3_000_000)).toBe(true)
  })
})
