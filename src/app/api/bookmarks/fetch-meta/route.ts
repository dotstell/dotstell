import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'
import { safeFetchHtml } from '@/lib/net/safe-fetch'
import { countWords, findTags, findTitle } from '@/lib/net/html-meta'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Each call makes the server open a connection to a stranger's address, so it is limited.
  const rl = rateLimit(`fetch-meta:${user.id}`, 30, 60_000)
  if (rl) return rl

  const url = new URL(req.url).searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  let parsed: URL
  try { parsed = new URL(url) } catch { return NextResponse.json({ error: 'Invalid URL' }, { status: 400 }) }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  // Private and internal addresses, DNS tricks, redirects and oversized pages are all handled
  // in safeFetchHtml; anything it refuses simply gets the plain fallback.
  const page = await safeFetchHtml(url)
  if (!page) return NextResponse.json(fallback(url))

  const { html } = page
  const origin = parsed.origin
  const hostname = parsed.hostname

  const metas = findTags(html, 'meta')
  const meta = (key: 'property' | 'name', value: string) =>
    metas.find(m => m[key]?.toLowerCase() === value && m.content?.trim())?.content.trim() ?? null

  const title = meta('property', 'og:title') ?? findTitle(html)
  const description = meta('property', 'og:description') ?? meta('name', 'description')

  const icon = findTags(html, 'link').find(l => /(^|\s)(shortcut icon|icon)(\s|$)/i.test(l.rel ?? '') && l.href)
  const favicon = (icon ? absolute(icon.href.trim(), origin) : null) ?? `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`

  const readingTime = Math.max(1, Math.round(countWords(html) / 200))

  return NextResponse.json({
    title: decode(title) ?? hostname,
    description: decode(description) ?? '',
    favicon_url: favicon,
    reading_time: readingTime,
    hostname,
  })
}

function absolute(href: string, origin: string): string | null {
  if (/^https?:\/\//i.test(href)) return href
  if (href.startsWith('//')) return 'https:' + href
  if (href.startsWith('/')) return origin + href
  return /^[a-z][a-z0-9+.-]*:/i.test(href) ? null : origin + '/' + href
}

function decode(str: string | null): string | null {
  if (!str) return null
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0*39;/g, "'").replace(/&#x0*27;/gi, "'").replace(/&nbsp;/g, ' ')
    // Decode remaining numeric entities (&#NNN; and &#xHHH;)
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .trim()
}

function fallback(url: string) {
  try {
    const { hostname } = new URL(url)
    return {
      title: hostname,
      description: '',
      favicon_url: `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
      reading_time: null,
      hostname,
    }
  } catch {
    return { title: url, description: '', favicon_url: null, reading_time: null, hostname: url }
  }
}
