import { describe, it, expect } from 'vitest'
import { strToU8 } from 'fflate'
import { buildExport } from './export/build'
import { planImport } from './import/plan'
import { parseVcf } from './import/contacts'
import type { ExportData } from './export/types'

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const day = new Date(Date.UTC(2026, 0, 1)).toISOString()

const exportWith = (content: string): ExportData => ({
  notebooks: [], people: [], tasks: [], bookmarks: [], links: [],
  notes: [{
    id: 'n1', title: 'Pics', type: 'markdown', content, tags: [], person_id: null, parent_id: null, sort_order: 0,
    pinned: false, color: null, checklist_items: null, created_at: day, updated_at: day,
  }],
})

describe('export with unusual images', () => {
  it('keeps going when an image is not valid base64', () => {
    const html = `<p>before</p><p><img src="data:image/png;base64,${PNG}" alt="ok"></p><p><img src="data:image/png;base64,@@@@!" alt="bad"></p><p>after</p>`
    const { files, summary } = buildExport(exportWith(html), new Date('2026-10-16T00:00:00Z'))
    expect(files['notes/Pics.md']).toBeDefined()
    expect(summary.attachments).toBe(1)
  })

  it('never lets an odd image type into a file name', () => {
    const html = `<p><img src="data:image/p.n.g..x;base64,${PNG}" alt="a"></p><p><img src="data:image/${'z'.repeat(40)};base64,${PNG}" alt="b"></p>`
    const { files } = buildExport(exportWith(html), new Date('2026-10-16T00:00:00Z'))
    for (const path of Object.keys(files).filter(p => p.startsWith('attachments/'))) {
      expect(path).toMatch(/^attachments\/[^/]+\.[a-z0-9]{1,5}$/)
    }
  })
})

describe('large import inputs', () => {
  it('reads a vCard with thousands of folded quoted-printable lines quickly', () => {
    // Every line but the last ends in "=", the quoted-printable soft line break.
    const lines = Array.from({ length: 20_000 }, (_, i) => (i < 19_999 ? 'aa=' : 'aa')).join('\r\n')
    const vcf = `BEGIN:VCARD\r\nVERSION:2.1\r\nFN:Ada\r\nEMAIL:ada@example.com\r\nNOTE;ENCODING=QUOTED-PRINTABLE:${lines}\r\nEND:VCARD\r\n`
    const start = Date.now()
    const contacts = parseVcf(vcf, () => {})
    expect(Date.now() - start).toBeLessThan(2000)
    expect(contacts[0].name).toBe('Ada')
  })

  it('imports a Keep note with a very long text', () => {
    const textContent = Array.from({ length: 150_000 }, () => 'a').join('\n')
    const json = JSON.stringify({ title: 'Long', textContent, isTrashed: false, userEditedTimestampUsec: 1, createdTimestampUsec: 1 })
    const plan = planImport([{ path: 'Takeout/Keep/Long.json', data: strToU8(json) }], { newId: () => 'id1' })
    expect(plan.notes.find(n => n.title === 'Long')).toBeDefined()
  })
})
