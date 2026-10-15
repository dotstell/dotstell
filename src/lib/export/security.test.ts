import { describe, it, expect } from 'vitest'
import { strFromU8 } from 'fflate'
import { buildExport } from './build'
import type { ExportData } from './types'

const day = (d: number) => new Date(Date.UTC(2026, 0, d)).toISOString()

const baseNote = {
  tags: [], person_id: null, parent_id: null, sort_order: 0, pinned: false, color: null, checklist_items: null,
  type: 'markdown' as const, created_at: day(1), updated_at: day(1),
}
const bookmark = {
  description: null, favicon_url: null, tags: [], reading_time: null, hostname: null,
  last_visited_at: null, visit_count: null, created_at: day(1), updated_at: day(1),
}

const hostile: ExportData = {
  notebooks: [],
  links: [],
  people: [{
    id: 'p1', name: '+cmd|calc', role: '\tTab', company: '-2+3', email: null, phone: null, avatar_url: null,
    tags: [], last_interaction: null, created_at: day(1), updated_at: day(1),
  }],
  tasks: [{
    id: 't1', title: '=HYPERLINK("http://evil","click")', description: '@SUM(1+1)', status: 'todo', priority: 'high',
    due_date: null, person_id: null, tags: [], created_at: day(1), updated_at: day(1),
  }],
  bookmarks: [
    { ...bookmark, id: 'b1', title: 'Bookmarklet', url: 'javascript:alert(1)' },
    { ...bookmark, id: 'b2', title: 'Paren', url: 'https://x.com/a_(b)' },
    { ...bookmark, id: 'b3', title: 'Fine', url: 'https://example.com/' },
  ],
  notes: [{
    ...baseNote, id: 'h1', title: 'Hostile',
    content: '<p><a href="javascript:alert(1)">click</a> <a href="https://ok.example/">ok</a></p>',
  }],
}

const { files } = buildExport(hostile, new Date('2026-10-16T00:00:00Z'))
const text = (path: string) => {
  const f = files[path]
  if (!f) throw new Error(`missing ${path}`)
  return typeof f.content === 'string' ? f.content : strFromU8(f.content)
}

describe('export of hostile content', () => {
  it('stops spreadsheet formulas in CSV cells', () => {
    const csv = text('tasks.csv')
    expect(csv).toContain("'=HYPERLINK")
    expect(csv).toContain("'@SUM")
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m)
  })
  it('does not export javascript: bookmarks as clickable', () => {
    expect(text('bookmarks.html')).not.toContain('javascript:')
    expect(text('bookmarks.md')).not.toContain('](javascript:')
    expect(text('bookmarks.html')).toContain('https://example.com/')
  })
  it('keeps parentheses in a bookmark URL from ending the Markdown link', () => {
    expect(text('bookmarks.md')).toContain('(https://x.com/a_%28b%29)')
  })
  it('turns unsafe links in notes into plain text', () => {
    const path = Object.keys(files).find(p => p.startsWith('notes/'))!
    const body = text(path)
    expect(body).not.toContain('javascript:')
    expect(body).toContain('click')
    expect(body).toContain('[ok](https://ok.example/)')
  })
})
