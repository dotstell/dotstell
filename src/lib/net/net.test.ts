import { describe, it, expect } from 'vitest'
import { isPublicAddress, safeFetchHtml } from './safe-fetch'
import { countWords, findTags, findTitle } from './html-meta'

describe('isPublicAddress', () => {
  it.each([
    '8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '100.128.0.1', '2606:4700:4700::1111', '2001:4860:4860::8888',
  ])('allows %s', ip => expect(isPublicAddress(ip)).toBe(true))

  it.each([
    '127.0.0.1', '127.255.255.254', '10.1.1.1', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '100.127.255.255', '0.0.0.0', '0.1.2.3', '224.0.0.1', '255.255.255.255', '198.18.0.1',
    '::', '::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:169.254.169.254', '::ffff:10.0.0.1', '::127.0.0.1',
    'fe80::1', 'fc00::1', 'fd12:3456::1', '64:ff9b::7f00:1', '2002:7f00:1::', 'ff02::1', '2001:db8::1',
    'not-an-ip', '',
  ])('refuses %s', ip => expect(isPublicAddress(ip)).toBe(false))
})

describe('safeFetchHtml refuses before connecting', () => {
  const never = async () => { throw new Error('must not resolve') }
  it.each([
    'http://localhost/', 'http://LOCALHOST:8080/', 'http://127.0.0.1/', 'http://[::1]/', 'http://2130706433/', 'http://0x7f.1/',
    'http://017700000001/', 'http://169.254.169.254/latest/meta-data/', 'http://[::ffff:127.0.0.1]/', 'http://metadata.internal/',
    'http://printer.local/', 'http://user:pw@example.com/', 'http://example.com:22/', 'http://example.com:6379/', 'ftp://example.com/',
    'file:///etc/passwd', 'javascript:alert(1)', 'not a url',
  ])('%s', async url => {
    expect(await safeFetchHtml(url, { resolve: never })).toBeNull()
  })

  it('refuses a name when ANY of its addresses is private', async () => {
    expect(await safeFetchHtml('http://rebind.example/', { resolve: async () => ['8.8.8.8', '127.0.0.1'] })).toBeNull()
    expect(await safeFetchHtml('http://rebind.example/', { resolve: async () => ['8.8.8.8', '::ffff:10.0.0.5'] })).toBeNull()
    expect(await safeFetchHtml('http://rebind.example/', { resolve: async () => [] })).toBeNull()
  })

  it('treats a failed lookup as unreachable', async () => {
    expect(await safeFetchHtml('http://nope.example/', { resolve: never })).toBeNull()
  })
})

describe('html-meta', () => {
  const html = `<html><head><title> Hello &amp; world </title>
    <meta property="og:title" content="OG title">
    <meta name='description' content='single quoted'>
    <metadata foo="bar">
    <link rel="shortcut icon" href="/fav.ico"></head><body><script>var a = "<b>not words</b>"</script><style>p{}</style>one two <b>three</b></body></html>`

  it('finds meta, link and title tags', () => {
    const metas = findTags(html, 'meta')
    expect(metas).toHaveLength(2)
    expect(metas[0]).toMatchObject({ property: 'og:title', content: 'OG title' })
    expect(metas[1]).toMatchObject({ name: 'description', content: 'single quoted' })
    expect(findTags(html, 'link')[0]).toMatchObject({ rel: 'shortcut icon', href: '/fav.ico' })
    expect(findTitle(html)).toBe('Hello &amp; world')
  })

  it('counts visible words only', () => {
    expect(countWords(html.slice(html.indexOf('<body')))).toBe(3)
  })

  it('stays fast on hostile pages (linear time)', () => {
    const cases: [string, string][] = [
      ['unclosed <meta', '<meta '.repeat(400_000)],
      ['lone <', '<'.repeat(1_000_000)],
      ['unclosed <script', '<script '.repeat(300_000)],
      ['unclosed <title', '<title>'.repeat(200_000)],
    ]
    for (const [label, input] of cases) {
      const start = performance.now()
      findTags(input, 'meta'); findTags(input, 'link'); findTitle(input); countWords(input)
      expect(performance.now() - start, label).toBeLessThan(1500)
    }
  })
})
