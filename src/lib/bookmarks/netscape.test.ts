import { describe, it, expect } from 'vitest'
import { tokenizeNetscape } from './netscape'

const chrome = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://a.example/" ADD_DATE="1" ICON="data:image/png;base64,AAAA">A &amp; B</A>
        <DT><H3 ADD_DATE="2">Dev</H3>
        <DL><p>
            <DT><a href="https://b.example/?x=1&y=2">B <b>bold</b></a>
            <DD>a description line
            <DT><A NAME="no href">skipped</A>
        </DL><p>
    </DL><p>
</DL><p>`

describe('tokenizeNetscape', () => {
  it('reads folders, nesting and links in order', () => {
    const t = tokenizeNetscape(chrome)
    expect(t).toEqual([
      { kind: 'tag', name: 'DL' },
      { kind: 'tag', name: 'DT' },
      { kind: 'h3', text: 'Bookmarks bar' },
      { kind: 'tag', name: 'DL' },
      { kind: 'tag', name: 'DT' },
      { kind: 'a', href: 'https://a.example/', text: 'A &amp; B' },
      { kind: 'tag', name: 'DT' },
      { kind: 'h3', text: 'Dev' },
      { kind: 'tag', name: 'DL' },
      { kind: 'tag', name: 'DT' },
      { kind: 'a', href: 'https://b.example/?x=1&y=2', text: 'B bold' },
      { kind: 'tag', name: 'DT' },
      { kind: 'tag', name: '/DL' },
      { kind: 'tag', name: '/DL' },
      { kind: 'tag', name: '/DL' },
    ])
  })

  it('does not treat <abbr> or <a> without an href as links', () => {
    expect(tokenizeNetscape('<abbr title="x">y</abbr><A NAME="n">z</A>')).toEqual([])
  })

  it('ignores a link that is never closed instead of swallowing the file', () => {
    const t = tokenizeNetscape('<DT><A HREF="https://x.example/">never closed<DT><A HREF="https://y.example/">ok</A>')
    expect(t.filter(x => x.kind === 'a')).toEqual([{ kind: 'a', href: 'https://y.example/', text: 'ok' }])
  })

  it('stays fast on hostile files (linear time)', () => {
    const cases: [string, string][] = [
      ['repeated <A', '<A '.repeat(3_000_000)],
      ['unclosed anchors with href', '<A HREF="x">'.repeat(800_000)],
      ['unclosed <H3', '<H3>'.repeat(2_000_000)],
      ['lone <', '<'.repeat(9_000_000)],
      ['many unclosed then one closer', '<A HREF="x">'.repeat(500_000) + '</A>'],
    ]
    for (const [label, input] of cases) {
      const start = performance.now()
      tokenizeNetscape(input)
      expect(performance.now() - start, label).toBeLessThan(2500)
    }
  })
})
