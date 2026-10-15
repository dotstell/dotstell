import { describe, it, expect } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { buildExport } from './build'
import { zipExport } from './zip'
import { sanitizeFileName, createNamer } from './filenames'
import type { ExportData } from './types'

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const day = (d: number) => new Date(Date.UTC(2026, 0, d)).toISOString()

const base = {
  tags: [], person_id: null, parent_id: null, sort_order: 0, pinned: false, color: null, checklist_items: null,
}

const data: ExportData = {
  notebooks: [{ id: 'nb1', name: 'Work Stuff', color: null, icon: null, sort_order: 0, created_at: day(1) }],
  people: [
    { id: 'p1', name: 'Aiko Tanaka', role: 'SRE', company: null, email: 'a@x.jp', phone: null, avatar_url: null, tags: ['mentor'], last_interaction: null, created_at: day(1), updated_at: day(1) },
    { id: 'p2', name: 'CON', role: null, company: null, email: null, phone: null, avatar_url: null, tags: [], last_interaction: null, created_at: day(2), updated_at: day(2) },
  ],
  notes: [
    {
      ...base, id: 'n1', title: '週次レビュー: Q4 / 計画?', type: 'markdown', pinned: true, person_id: 'p1',
      tags: ['work stuff', 'nb:work-stuff', 'q4 plan'], created_at: day(1), updated_at: day(9),
      content:
        '<p>See <a data-wikilink="true" data-note-id="n2" data-note-title="Roadmap">[[Roadmap]]</a> and ' +
        '<a data-wikilink="true" data-note-id="gone" data-note-title="Deleted: note">[[x]]</a>. <mark>hi</mark></p>' +
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>done thing</p></div></li>' +
        '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>todo thing</p></div></li></ul>' +
        '<table><tbody><tr><th><p>Risk</p></th><th><p>Owner | who</p></th></tr><tr><td><p>Slip</p></td><td><p>A</p><p>B</p></td></tr></tbody></table>' +
        `<p><img src="data:image/png;base64,${PNG}" alt="shot"></p><p><img src="https://example.com/a.png" alt="remote"></p>`,
    },
    { ...base, id: 'n2', title: 'Roadmap', type: 'plain', parent_id: 'n1', created_at: day(2), updated_at: day(3), content: 'plain text, no markup' },
    { ...base, id: 'n3', title: 'roadmap', type: 'plain', created_at: day(3), updated_at: day(3), content: '<p>case twin</p>' },
    { ...base, id: 'n4', title: '', type: 'checklist', created_at: day(4), updated_at: day(4), content: '', checklist_items: [{ text: 'milk', checked: true }, { text: 'eggs', checked: false }] },
    { ...base, id: 'n5', title: 'a'.repeat(300), type: 'plain', created_at: day(5), updated_at: day(5), content: '<p>long</p>' },
  ],
  tasks: [
    { id: 't1', title: 'Ship export', description: 'line1\nline2', status: 'in_progress', priority: 'high', due_date: day(20), person_id: 'p1', tags: ['dev ops'], created_at: day(1), updated_at: day(2) },
    { id: 't2', title: 'Say "hi", ok', description: null, status: 'done', priority: 'medium', due_date: null, person_id: null, tags: [], created_at: day(1), updated_at: day(2) },
  ],
  bookmarks: [
    { id: 'b1', title: 'MDN <docs> & more', url: 'https://developer.mozilla.org/?a=1&b=2', description: 'Web docs', favicon_url: null, tags: ['ref'], reading_time: 3, hostname: 'mdn', last_visited_at: null, visit_count: 0, created_at: day(1), updated_at: day(1) },
  ],
  links: [
    { id: 'l1', source_id: 'n1', source_type: 'note', target_id: 'p1', target_type: 'person', label: null, created_at: day(1) },
    { id: 'l2', source_id: 'n1', source_type: 'note', target_id: 't1', target_type: 'task', label: null, created_at: day(1) },
    { id: 'l3', source_id: 'n1', source_type: 'note', target_id: 'n2', target_type: 'note', label: '__wikilink__', created_at: day(1) },
  ],
}

const text = (files: ReturnType<typeof buildExport>['files'], path: string) => {
  const f = files[path]
  if (!f) throw new Error(`missing ${path}`)
  return typeof f.content === 'string' ? f.content : strFromU8(f.content)
}

describe('file names', () => {
  it('strips characters that break Windows paths or Obsidian links', () => {
    expect(sanitizeFileName('a/b:c*d?e"f<g>h|i#j^k[l]m')).toBe('a b c d e f g h i j k l m')
  })
  it('avoids reserved names, trailing dots and empty names', () => {
    expect(sanitizeFileName('CON')).toBe('CON_')
    expect(sanitizeFileName('notes...')).toBe('notes')
    expect(sanitizeFileName('???')).toBe('Untitled')
  })
  it('is unique case-insensitively', () => {
    const name = createNamer()
    expect([name('Plan'), name('plan'), name('PLAN')]).toEqual(['Plan', 'plan (2)', 'PLAN (3)'])
  })
})

describe('buildExport', () => {
  const { files, summary } = buildExport(data, new Date('2026-10-16T00:00:00Z'))
  const note = text(files, 'notes/Work Stuff/週次レビュー Q4 計画.md')

  it('counts what it exported', () => {
    expect(summary).toEqual({ notes: 5, people: 2, tasks: 2, bookmarks: 1, attachments: 1 })
  })

  it('puts notebook notes in a folder and keeps non-ASCII titles', () => {
    expect(Object.keys(files)).toContain('notes/Work Stuff/週次レビュー Q4 計画.md')
  })

  it('writes front matter without leaking notebook tags', () => {
    expect(note).toContain('tags: ["work-stuff", "q4-plan"]')
    expect(note).toContain('notebook: "Work Stuff"')
    expect(note).not.toContain('nb:')
    expect(note).toContain('title: "週次レビュー: Q4 / 計画?"')
    expect(note).toContain('dotstell_id: "n1"')
  })

  it('keeps wikilinks resolvable, including to a deleted note', () => {
    expect(note).toContain('[[Roadmap]]')
    expect(note).toContain('[[Deleted note]]')
  })

  it('converts task lists, tables and highlights', () => {
    expect(note).toContain('- [x] done thing')
    expect(note).toContain('- [ ] todo thing')
    expect(note).toContain('| Risk | Owner \\| who |')
    expect(note).toContain('| Slip | A<br><br>B |')
    expect(note).toContain('==hi==')
  })

  it('moves embedded images to real files and leaves remote ones alone', () => {
    expect(note).not.toContain('base64')
    expect(note).toMatch(/!\[shot\]\(\.\.\/\.\.\/attachments\/.+\.png\)/)
    expect(note).toContain('![remote](https://example.com/a.png)')
    const attachment = Object.keys(files).find(p => p.startsWith('attachments/'))!
    expect(Array.from((files[attachment].content as Uint8Array).slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47])
  })

  it('keeps colliding titles as separate files', () => {
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['notes/Roadmap.md', 'notes/roadmap (2).md']))
  })

  it('links sub-notes to their parent and people by path', () => {
    expect(text(files, 'notes/Roadmap.md')).toContain('parent: "[[週次レビュー Q4 計画]]"')
    expect(note).toContain('person: "[[people/Aiko Tanaka|Aiko Tanaka]]"')
    expect(note).toContain('"task: Ship export"')
  })

  it('exports plain text, empty-title and checklist notes', () => {
    expect(text(files, 'notes/Roadmap.md')).toContain('plain text, no markup')
    expect(text(files, 'notes/Untitled.md')).toContain('- [x] milk')
    expect(text(files, 'notes/Untitled.md')).toContain('- [ ] eggs')
  })

  it('caps very long titles and handles reserved person names', () => {
    expect(Object.keys(files).some(p => p.startsWith('notes/aaaa') && p.length < 140)).toBe(true)
    expect(Object.keys(files)).toContain('people/CON_.md')
  })

  it('lists the notes and tasks linked to a person', () => {
    const person = text(files, 'people/Aiko Tanaka.md')
    expect(person).toContain('- [[週次レビュー Q4 計画]]')
    expect(person).toContain('- [ ] Ship export')
  })

  it('escapes CSV and HTML', () => {
    expect(text(files, 'tasks.csv')).toContain('"Say ""hi"", ok"')
    expect(text(files, 'tasks.csv').charCodeAt(0)).toBe(0xfeff)
    const html = text(files, 'bookmarks.html')
    expect(html).toContain('MDN &lt;docs&gt; &amp; more')
    expect(html).toContain('HREF="https://developer.mozilla.org/?a=1&amp;b=2"')
  })

  it('includes a complete JSON backup', () => {
    const json = JSON.parse(text(files, 'dotstell-export.json'))
    expect(json.format).toBe('dotstell-export')
    expect(json.counts).toEqual({ notes: 5, people: 2, tasks: 2, bookmarks: 1, notebooks: 1, links: 3 })
    expect(json.notes[0].content).toContain('data-wikilink')
  })

  it('survives an empty account', () => {
    const empty = buildExport({ notes: [], people: [], tasks: [], bookmarks: [], notebooks: [], links: [] })
    expect(empty.summary.notes).toBe(0)
    expect(text(empty.files, 'tasks.md')).toBe('# Tasks\n')
  })
})

describe('zipExport', () => {
  it('round-trips every file under one root folder', () => {
    const { files } = buildExport(data)
    const unzipped = unzipSync(zipExport(files, 'root'))
    expect(Object.keys(unzipped).every(p => p.startsWith('root/'))).toBe(true)
    expect(Object.keys(unzipped)).toHaveLength(Object.keys(files).length)
    const path = 'notes/Work Stuff/週次レビュー Q4 計画.md'
    expect(strFromU8(unzipped[`root/${path}`])).toBe(text(files, path))
  })
})
