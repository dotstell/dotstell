import { describe, it, expect } from 'vitest'
import { containsActiveContent } from './safety'

describe('containsActiveContent: things that can run', () => {
  it.each([
    '<script>x</script>', '<SCRIPT SRC=//evil></SCRIPT>', '<p onclick="x">a</p>', '<a href="javascript:alert(1)">a</a>',
    '<iframe src="x"></iframe>', '<img src="data:text/html;base64,AA">', '<svg onload=x>', '<style>a{}</style>',
    '<object data=x>', '<embed src=x>', '<form action=x>', '<base href="//evil/">', '<meta http-equiv="refresh" content="0;url=//evil">',
    '<link rel=stylesheet href=//evil>', '<math><mi>x</mi></math>',
  ])('flags %s', html => expect(containsActiveContent(html)).toBe(true))

  it.each([
    // attributes glued to the tag without spaces, which the earlier regexes missed
    '<img/onerror=alert(1)>', '<img src="x"onerror=alert(1)>', '<img\nonerror=alert(1)>', '<a/href="javascript:x">y</a>',
    "<div onmouseover='x'>y</div>", '<body onload=x>',
    // the address written so that browsers still read javascript:
    '<a href=" javascript:alert(1)">y</a>', '<a href="java&#9;script:alert(1)">y</a>', '<a href="&#x0A;javascript:alert(1)">y</a>',
    '<a href="JaVaScRiPt:alert(1)">y</a>', '<a href="java\tscript:alert(1)">y</a>', '<a href="javascript&colon;alert(1)">y</a>',
    '<a href="vbscript:x">y</a>', '<a href="data:text/html,<b>x</b>">y</a>', '<form action="javascript:x"><button>', '<video src="data:video/mp4;base64,AA">',
    '<img src="data:image/gif,notbase64">',
  ])('flags %s', html => expect(containsActiveContent(html)).toBe(true))
})

describe('containsActiveContent: harmless content', () => {
  it.each([
    '<p>hello &lt;script&gt; onclick=1</p>', '<a href="https://x.com">a</a>', '<a href="mailto:a@b.co">a</a>', '<a href="#top">a</a>',
    '<a href="/relative/path?x=1&y=2">a</a>', '<img src="data:image/png;base64,AAAA">', '<img src="data:image/svg+xml;base64,AAAA">',
    '<code>a &lt; b onerror=x</code>', '<p>1 < 2 and 3 > 2, even a <b>bold</b> one</p>', 'text with a lone < and onclick=2',
    '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>done</p></div></li></ul>',
    '<a data-wikilink="true" data-note-id="1" data-note-title="X">[[X]]</a>', '<table><tbody><tr><td>one</td></tr></tbody></table>',
    '<!-- <script>in a comment</script> --><p>ok</p>', '<!DOCTYPE html><p>ok</p>', '<p title="onclick is just text">ok</p>', '<p>done</p',
  ])('allows %s', html => expect(containsActiveContent(html)).toBe(false))
})

describe('containsActiveContent: hostile input stays fast (linear time)', () => {
  const cases: [string, string][] = [
    ['2 MB of <', '<'.repeat(2_000_000)],
    ['<a repeated', '<a '.repeat(700_000)],
    ['<a x= repeated', '<a x="'.repeat(350_000)],
    ['<a on repeated', '<a ona'.repeat(350_000)],
    ['<!-- repeated', '<!--'.repeat(500_000)],
    ['entity soup in an address', `<a href="${'&#9;'.repeat(300_000)}x">y</a>`],
    ['2 MB of attributes', `<p ${'a=b '.repeat(500_000)}>x</p>`],
  ]
  it.each(cases)('%s', (_label, input) => {
    const start = performance.now()
    containsActiveContent(input)
    expect(performance.now() - start).toBeLessThan(1000)
  })
})
