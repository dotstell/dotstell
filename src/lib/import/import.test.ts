import { describe, it, expect } from 'vitest'
import { strToU8, unzipSync } from 'fflate'
import { splitFrontMatter, toIsoDate, toStringList } from './frontmatter'
import { extractInlineTags } from './markdown'
import { containsActiveContent } from './safety'
import { planMarkdownImport, type VaultFile } from './vault'
import { buildExport } from '../export/build'
import { zipExport } from '../export/zip'
import type { ExportData } from '../export/types'

const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), c => c.charCodeAt(0))

const file = (path: string, text: string): VaultFile => ({ path, data: strToU8(text) })
let counter = 0
const plan = (files: VaultFile[], maxImageBytes?: number) => {
  counter = 0
  return planMarkdownImport(files, { newId: () => `id${++counter}`, maxImageBytes })
}
const byTitle = (p: ReturnType<typeof plan>, title: string) => p.notes.find(n => n.title === title)!

describe('front matter', () => {
  it('splits properties from the body', () => {
    const r = splitFrontMatter('---\ntitle: Hello\ntags: [a, b]\n---\n\nBody')
    expect(r.data).toEqual({ title: 'Hello', tags: ['a', 'b'] })
    expect(r.body).toBe('\nBody')
  })
  it('handles CRLF and a byte-order mark', () => {
    expect(splitFrontMatter('\uFEFF---\r\ntitle: x\r\n---\r\nhi').data).toEqual({ title: 'x' })
  })
  it('ignores a --- that is not at the very start', () => {
    expect(splitFrontMatter('text\n---\na: 1\n---\n').data).toEqual({})
  })
  it('keeps the text when the YAML is broken', () => {
    const r = splitFrontMatter('---\nfoo: [unclosed\n---\nbody')
    expect(r.error).toBeTruthy()
    expect(r.body).toContain('body')
    expect(r.body).toContain('foo: [unclosed')
  })
  it('normalises tag lists and dates', () => {
    expect(toStringList('#a, b  #c')).toEqual(['a', 'b', 'c'])
    expect(toStringList(['#x', 3])).toEqual(['x', '3'])
    expect(toIsoDate('2026-01-02')).toBe('2026-01-02T00:00:00.000Z')
    expect(toIsoDate('not a date')).toBeNull()
  })
})

describe('inline tags', () => {
  it('finds tags but not headings, code, urls or bare numbers', () => {
    const md = '# Heading\nWork on #project/alpha and #日本語.\n`#incode`\nhttps://x.com/#anchor\nissue #123\n```\n#fenced\n```\n'
    expect(extractInlineTags(md).sort()).toEqual(['project/alpha', '日本語'].sort())
  })
})

describe('planMarkdownImport', () => {
  const vault = [
    file('MyVault/.obsidian/app.json', '{}'),
    file('MyVault/.DS_Store', 'x'),
    file('MyVault/Inbox.md', 'Top level #idea'),
    file('MyVault/Projects/Alpha.md',
      '---\ntags: [work]\naliases: [The Alpha]\ncreated: 2026-01-05\npinned: true\n---\n' +
      'See [[Beta|the beta]], [[Beta#Goals]], [[The Alpha]], [[Missing]] and [md link](Beta.md).\n\n' +
      '==marked== %%hidden%% text ^block1\n\n> [!warning] Careful\n> body\n\n' +
      '- [ ] open\n- [x] done\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n' +
      '![[pic.png|200]] and ![alt](../assets/pic.png) and ![[huge.png]]\n\n' +
      '<script>alert(1)</script>\n\nplain <u>ok</u> [bad](javascript:alert(1)) [good](https://example.com)\n'),
    file('MyVault/Projects/Beta.md', '# Beta\nback to [[Alpha]]'),
    file('MyVault/Other/Beta.md', 'a different Beta'),
    file('MyVault/assets/pic.png', ''),
    file('MyVault/notes.pdf', 'pdf'),
  ]
  // Real bytes for the images (strToU8('') above is a placeholder replaced here).
  vault.find(f => f.path.endsWith('pic.png'))!.data = PNG
  vault.push({ path: 'MyVault/assets/huge.png', data: Uint8Array.from({ length: 600 * 1024 }, (_, i) => PNG[i] ?? 0) })

  const result = plan(vault)
  const alpha = byTitle(result, 'Alpha')

  it('drops app folders, strips the wrapper folder and counts notes', () => {
    expect(result.notes.map(n => n.path).sort()).toEqual(['Inbox.md', 'Other/Beta.md', 'Projects/Alpha.md', 'Projects/Beta.md'])
  })

  it('turns top-level folders into notebooks', () => {
    expect(result.notebooks.sort()).toEqual(['Other', 'Projects'])
    expect(alpha.notebook).toBe('Projects')
    expect(byTitle(result, 'Inbox').notebook).toBeNull()
  })

  it('merges front matter and inline tags, and reads dates and pinned', () => {
    expect(alpha.tags).toEqual(['work'])
    expect(byTitle(result, 'Inbox').tags).toEqual(['idea'])
    expect(alpha.createdAt).toBe('2026-01-05T00:00:00.000Z')
    expect(alpha.pinned).toBe(true)
  })

  it('resolves wikilinks by name, alias and heading, preferring the nearest note', () => {
    const beta = result.notes.find(n => n.path === 'Projects/Beta.md')!
    expect(alpha.html).toContain(`data-note-id="${beta.id}"`)
    expect(alpha.html).not.toContain('other-beta')
    expect(alpha.html).toContain(`data-note-id="${alpha.id}"`) // alias [[The Alpha]] → itself
    expect(alpha.linkedIds).toEqual([beta.id])
    expect(byTitle(result, 'Beta').html).toBeDefined()
  })

  it('leaves unresolved links as visible text and reports them', () => {
    expect(alpha.html).toContain('[[Missing]]')
    expect(result.report.issues.join(' ')).toMatch(/1 link\(s\) point at notes that are not in this import/)
  })

  it('turns relative Markdown links to notes into wikilinks', () => {
    expect((alpha.html.match(/data-wikilink/g) ?? []).length).toBeGreaterThanOrEqual(4)
  })

  it('converts Obsidian syntax', () => {
    expect(alpha.html).toContain('<mark>marked</mark>')
    expect(alpha.html).not.toContain('hidden')
    expect(alpha.html).not.toContain('^block1')
    expect(alpha.html).toContain('<strong>Careful</strong>')
    expect(alpha.html).toContain('<table>')
  })

  it('uses the editor task-list structure', () => {
    expect(alpha.html).toContain('<ul data-type="taskList">')
    expect(alpha.html).toContain('<li data-type="taskItem" data-checked="false">')
    expect(alpha.html).toContain('<li data-type="taskItem" data-checked="true">')
    expect(alpha.html).not.toMatch(/<input[^>]*disabled/)
  })

  it('embeds images that exist and skips oversized ones', () => {
    expect((alpha.html.match(/<img src="data:image\/png;base64,/g) ?? []).length).toBe(2)
    expect(alpha.html).toContain('[image not imported: huge.png]')
    expect(result.report.images.embedded).toBe(2)
    expect(result.report.issues.join(' ')).toMatch(/1 image\(s\) over 500 KB/)
  })

  it('neutralises scripts and unsafe links but keeps safe formatting tags', () => {
    expect(alpha.html).not.toContain('<script')
    expect(alpha.html).toContain('&lt;script&gt;')
    expect(alpha.html).not.toContain('javascript:')
    expect(alpha.html).toContain('<u>ok</u>')
    expect(alpha.html).toContain('<a href="https://example.com">good</a>')
    expect(alpha.html).toContain('bad')
    expect(alpha.html).not.toContain('href="javascript')
  })

  it('reports files it did not import', () => {
    expect(result.report.issues.join(' ')).toMatch(/Unsupported files were skipped.*\.pdf ×1/)
  })
})

describe('Notion-style export', () => {
  const hash = '0a1b2c3d4e5f60718293a4b5c6d7e8f9'
  const hash2 = '9f8e7d6c5b4a39281706f5e4d3c2b1a0'
  const r = plan([
    file(`Export/Team wiki ${hash}/Roadmap ${hash2}.md`, `# Roadmap\n\nBack to [Team wiki](../Team%20wiki%20${hash}.md) and [self](Roadmap%20${hash2}.md)`),
    file(`Export/Team wiki ${hash}.md`, '# Team wiki\n\nSee [Roadmap](Team%20wiki%20' + hash + '/Roadmap%20' + hash2 + '.md)'),
  ])

  it('removes the id suffix from titles and notebook names', () => {
    expect(r.notes.map(n => n.title).sort()).toEqual(['Roadmap', 'Team wiki'])
    expect(r.notebooks).toEqual(['Team wiki'])
  })

  it('still resolves the relative links between the pages', () => {
    const wiki = byTitle(r, 'Team wiki')
    const road = byTitle(r, 'Roadmap')
    expect(wiki.html).toContain(`data-note-id="${road.id}"`)
    expect(road.html).toContain(`data-note-id="${wiki.id}"`)
  })
})

describe('parent links', () => {
  it('reads parent from front matter and breaks cycles', () => {
    const r = plan([
      file('a.md', '---\nparent: "[[b]]"\n---\n'),
      file('b.md', '---\nparent: "[[a]]"\n---\n'),
      file('c.md', '---\nparent: "[[c]]"\n---\n'),
    ])
    const parents = r.notes.map(n => n.parentId)
    expect(parents.filter(Boolean).length).toBe(1)
    expect(byTitle(r, 'c').parentId).toBeNull()
  })
})

describe('round trip with a dotstell export', () => {
  const day = (d: number) => new Date(Date.UTC(2026, 0, d)).toISOString()
  const base = { person_id: null, sort_order: 0, color: null, checklist_items: null }
  const data: ExportData = {
    notebooks: [{ id: 'nb1', name: 'Work Stuff', color: null, icon: null, sort_order: 0, created_at: day(1) }],
    people: [], tasks: [], bookmarks: [], links: [],
    notes: [
      { ...base, id: 'n1', title: '週次レビュー: Q4 / 計画?', type: 'markdown', pinned: true, parent_id: null, tags: ['q4 plan', 'nb:work-stuff'], created_at: day(1), updated_at: day(9),
        content: '<p>See <a data-wikilink="true" data-note-id="n2" data-note-title="Roadmap">[[Roadmap]]</a></p><ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>done</p></div></li></ul>' },
      { ...base, id: 'n2', title: 'Roadmap', type: 'plain', pinned: false, parent_id: 'n1', tags: [], created_at: day(2), updated_at: day(3), content: '<p>plain</p>' },
    ],
  }
  const { files } = buildExport(data)
  const unzipped = unzipSync(zipExport(files, 'dotstell-export-2026-10-16_14-30-05'))
  const vault: VaultFile[] = Object.entries(unzipped).map(([path, bytes]) => ({ path, data: bytes }))
  const result = plan(vault)

  it('imports only the notes from an export', () => {
    expect(result.notes).toHaveLength(2)
    expect(result.report.issues.join(' ')).toMatch(/looks like a dotstell export/)
  })

  it('restores titles, notebooks, tags, dates and pinned state', () => {
    const n = byTitle(result, '週次レビュー: Q4 / 計画?')
    expect(n.notebook).toBe('Work Stuff')
    expect(n.tags).toEqual(['q4-plan'])
    expect(n.createdAt).toBe(day(1))
    expect(n.updatedAt).toBe(day(9))
    expect(n.pinned).toBe(true)
  })

  it('restores wikilinks, sub-note nesting and task lists', () => {
    const n = byTitle(result, '週次レビュー: Q4 / 計画?')
    const road = byTitle(result, 'Roadmap')
    expect(n.html).toContain(`data-note-id="${road.id}"`)
    expect(n.linkedIds).toEqual([road.id])
    expect(road.parentId).toBe(n.id)
    expect(n.html).toContain('data-type="taskItem" data-checked="true"')
  })
})

describe('untrusted input', () => {
  const bytes = (...n: number[]) => Uint8Array.from(n)
  const evil = plan([
    file('v/ok.md', 'fine'),
    { path: 'v/setup.exe', data: bytes(0x4d, 0x5a, 0, 0) },
    { path: 'v/run.sh', data: strToU8('rm -rf /') },
    { path: 'v/page.html', data: strToU8('<script>1</script>') },
    { path: 'v/inner.zip', data: bytes(0x50, 0x4b, 3, 4) },
    { path: 'v/fake.png', data: strToU8('<html><script>alert(1)</script>') },
    { path: 'v/evil.svg', data: strToU8('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') },
    { path: 'v/good.svg', data: strToU8('<svg xmlns="http://www.w3.org/2000/svg"><circle r="1"/></svg>') },
    { path: 'v/binary.md', data: bytes(0x50, 0x4b, 0, 0, 1, 2) },
    { path: 'v/../../escape.md', data: strToU8('outside') },
    { path: 'C:/Windows/x.md', data: strToU8('abs') },
    file('v/notes.pdf', 'pdf'),
  ])
  const warnings = evil.report.warnings.join(' | ')

  it('imports only the harmless note', () => {
    expect(evil.notes.map(n => n.title)).toEqual(['ok'])
  })
  it('refuses programs and scripts and says so', () => {
    expect(warnings).toMatch(/\.exe ×1/)
    expect(warnings).toMatch(/\.sh ×1/)
    expect(warnings).toMatch(/\.html ×1/)
  })
  it('does not trust image file names or unsafe SVGs', () => {
    expect(warnings).toMatch(/1 file\(s\) with an image name are not valid images/)
    expect(warnings).toMatch(/1 SVG image\(s\) contain scripts/)
  })
  it('refuses binary files named .md, nested archives and escaping paths', () => {
    expect(warnings).toMatch(/not text files/)
    expect(warnings).toMatch(/zip or archive file\(s\) inside the import/)
    expect(warnings).toMatch(/2 file\(s\) with unsafe paths/)
  })
  it('reports unsupported-but-harmless files as plain notes, not warnings', () => {
    expect(evil.report.issues.join(' ')).toMatch(/\.pdf ×1/)
    expect(warnings).not.toMatch(/pdf/)
  })
  it('skips a note too large for the server instead of failing mid-import', () => {
    const r = plan([file('a.md', 'x'.repeat(2_000_000)), file('b.md', 'small')])
    expect(r.notes.map(n => n.title)).toEqual(['b'])
    expect(r.report.warnings.join(' ')).toMatch(/too large/)
  })
  it('tells the user when a note had its code made harmless', () => {
    const r = plan([file('u.md', 'x <script>alert(1)</script>'), file('v.md', '[a](javascript:alert(1))'), file('w.md', 'clean')])
    expect(r.notes).toHaveLength(3)
    expect(r.report.warnings.join(' ')).toMatch(/2 note\(s\) contained scripts or unsafe code/)
  })
  it('never lets importer output trip the server-side check', () => {
    const r = plan([file('a.md', '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1)) ![p](data:text/html;base64,AAAA)')])
    expect(containsActiveContent(r.notes[0].html)).toBe(false)
  })
})

describe('containsActiveContent', () => {
  it.each([
    '<script>x</script>', '<p onclick="x">a</p>', '<a href="javascript:alert(1)">a</a>',
    '<iframe src="x"></iframe>', '<img src="data:text/html;base64,AA">', '<svg onload=x>', '<style>a{}</style>',
  ])('flags %s', html => expect(containsActiveContent(html)).toBe(true))
  it.each([
    '<p>hello &lt;script&gt; onclick=1</p>', '<a href="https://x.com">a</a>',
    '<img src="data:image/png;base64,AAAA">', '<code>a &lt; b onerror=x</code>',
  ])('allows %s', html => expect(containsActiveContent(html)).toBe(false))
})
