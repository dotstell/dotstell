// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { marked } from 'marked'
import { sanitizeHtml } from './sanitize-html'

const md = (s: string) => sanitizeHtml(marked(s, { gfm: true }) as string, 'markdown')
const doc = (s: string) => sanitizeHtml(s, 'document')

describe('markdown profile: the browser-proven exploits', () => {
  it.each([
    ['plain', '<a href="javascript:window.__x=1">c</a>'],
    ['leading space', '<a href=" javascript:window.__x=1">c</a>'],
    ['tab inside the word', '<a href="java&#9;script:window.__x=1">c</a>'],
    ['leading newline', '<a href="&#x0A;javascript:window.__x=1">c</a>'],
    ['mixed case', '<a href="JaVaScRiPt:window.__x=1">c</a>'],
    ['vbscript', '<a href="vbscript:x">c</a>'],
    ['data html', '<a href="data:text/html;base64,PHNjcmlwdD4=">c</a>'],
    ['svg link', '<svg><a xlink:href="javascript:window.__x=1"><text>c</text></a></svg>'],
    ['math link', '<math><a href="javascript:x">c</a></math>'],
    ['markdown link', '[c](javascript:alert(1))'],
    ['markdown link with space', '[c]( javascript:alert(1))'],
  ])('%s leaves no script address', (_n, input) => {
    const out = md(input)
    expect(out.toLowerCase()).not.toMatch(/javascript:|vbscript:|data:text/)
    expect(out).not.toMatch(/<svg|<math/i)
  })

  it('removes dangerous elements and attributes', () => {
    const out = md('<script>alert(1)</script><style>a{}</style><iframe src=x></iframe><base href="//evil/"><meta http-equiv=refresh content="0;url=//e"><form action=x><input name=a></form><img src=x onerror=alert(1)><p onclick="x" style="color:red" class="c" id="i">t</p>')
    expect(out).not.toMatch(/<script|<style|<iframe|<base|<meta|<form|<img|onerror|onclick|style=|class=|id=/i)
    expect(out).toContain('<p>t</p>')
  })
})

describe('markdown profile: normal AI output still renders', () => {
  const out = md([
    '# Title', '', 'Some **bold**, *italic*, `code` and a [link](https://example.com/a?b=1&c=2).', '',
    '- one', '- two', '', '1. first', '2. second', '', '- [x] done', '- [ ] todo', '', '> quote', '',
    '```js', 'const a = 1 < 2', '```', '', '| A | B |', '|---|---|', '| 1 | 2 |', '', '![image](https://example.com/p.png)',
  ].join('\n'))

  it('keeps the formatting', () => {
    for (const piece of ['<h1>Title</h1>', '<strong>bold</strong>', '<em>italic</em>', '<code>code</code>', '<ul>', '<ol>', '<blockquote>', '<table>', '<th>A</th>', '<td>2</td>', 'type="checkbox"', 'language-js']) {
      expect(out, piece).toContain(piece)
    }
    expect(out).toContain('const a = 1 &lt; 2')
  })
  it('opens real links safely', () => {
    expect(out).toContain('href="https://example.com/a?b=1&amp;c=2"')
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).toContain('target="_blank"')
  })
  it('does not load remote images in chat output (tracking pixels)', () => {
    expect(out).not.toContain('<img')
  })
})

describe('document profile (print view)', () => {
  it('keeps note content: images, colours and tables', () => {
    const out = doc('<p style="color: #ff0000; text-align: center">hi</p><img src="https://x.example/p.png" alt="a"><img src="data:image/png;base64,AAAA"><table><tr><td colspan="2">x</td></tr></table><a href="https://x.example/">l</a><a href="/rel">r</a><a href="#top">t</a>')
    expect(out).toContain('style="color: #ff0000; text-align: center"')
    expect(out).toContain('src="https://x.example/p.png"')
    expect(out).toContain('src="data:image/png;base64,AAAA"')
    expect(out).toContain('colspan="2"')
    expect(out).toContain('href="/rel"')
    expect(out).toContain('href="#top"')
  })
  it('refuses what the old print sanitiser let through', () => {
    const out = doc('<a href="javascript:x">a</a><a href=" javascript:x">b</a><form action="javascript:x"><button>go</button></form><base href="//evil/"><meta http-equiv="refresh" content="0;url=//evil"><style>@import "//evil"</style><img src="data:image/svg+xml;base64,AAAA"><img src="javascript:x"><p style="background:url(javascript:x);position:fixed;color:red">p</p>')
    expect(out.toLowerCase()).not.toMatch(/javascript:|<form|<base|<meta|<style|<img|position|url\(/)
    expect(out).toContain('color: red')
  })
})

describe('robustness', () => {
  it('survives 5,000 levels of nesting', () => {
    expect(() => doc('<div>'.repeat(5000) + 'x' + '</div>'.repeat(5000))).not.toThrow()
  })
  it('handles a large document quickly', () => {
    const big = '<p>text <b>bold</b> <a href="https://e.example/">l</a></p>'.repeat(20_000)
    const start = performance.now()
    sanitizeHtml(big, 'document')
    expect(performance.now() - start).toBeLessThan(4000)
  })
})
