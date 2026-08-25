import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { lookup } from 'dns/promises'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url).searchParams.get('url')
  if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 })

  // Block non-http(s) schemes and private/internal IP ranges (SSRF protection)
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }
    const host = parsed.hostname.toLowerCase()
    const isPrivate =
      host === 'localhost' ||
      host === '0.0.0.0' ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||     // link-local / AWS metadata
      /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host) ||  // CGNAT
      /^::1$/.test(host) ||
      /^fc00:/i.test(host) ||
      /^fd[0-9a-f]{2}:/i.test(host) || // ULA IPv6
      /^::ffff:127\./i.test(host) ||   // IPv4-mapped loopback
      /^::ffff:10\./i.test(host) ||    // IPv4-mapped RFC-1918
      /^::ffff:192\.168\./i.test(host) ||
      /^::ffff:172\.(1[6-9]|2\d|3[01])\./i.test(host) ||
      /^::ffff:169\.254\./i.test(host) ||
      host.endsWith('.internal') ||
      host.endsWith('.local')
    if (isPrivate) return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })

    // Resolve hostname to IP before fetching to prevent DNS rebinding
    try {
      const resolved = await lookup(parsed.hostname)
      const ip = resolved.address
      const isResolvedPrivate =
        /^127\./.test(ip) || ip === '::1' ||
        /^10\./.test(ip) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
        /^192\.168\./.test(ip) ||
        /^169\.254\./.test(ip) ||
        /^fc00:/i.test(ip) || /^fd[0-9a-f]{2}:/i.test(ip) ||
        ip === '0.0.0.0'
      if (isResolvedPrivate) return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Dotstell/1.0; +https://dotstell.app)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      // 'error' prevents SSRF via open redirect — a URL that passes the DNS check
      // could redirect to an internal IP. This drops the response instead of following.
      redirect: 'error',
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) return NextResponse.json(fallback(url))

    // Cap response body at 2 MB to prevent OOM on large pages / malicious streams
    const contentLength = Number(res.headers.get('content-length') ?? 0)
    if (contentLength > 2_000_000) return NextResponse.json(fallback(url))

    const html = await res.text()
    if (html.length > 2_000_000) return NextResponse.json(fallback(url))
    const origin = new URL(url).origin
    const hostname = new URL(url).hostname

    const title = extract(html, [
      /<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i,
      /<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i,
      /<title[^>]*>([^<]{1,200})<\/title>/i,
    ])

    const description = extract(html, [
      /<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i,
      /<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i,
      /<meta[^>]+name="description"[^>]+content="([^"]+)"/i,
      /<meta[^>]+content="([^"]+)"[^>]+name="description"/i,
    ])

    const favicon = extractFavicon(html, origin) ?? `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`

    // Rough reading time — strip script/style block bodies first (tag-only stripping
    // would include their text content and vastly overstate reading time for SPAs).
    const bodyText = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
    const wordCount = bodyText.split(' ').filter(Boolean).length
    const readingTime = Math.max(1, Math.round(wordCount / 200))

    return NextResponse.json({
      title: decode(title) ?? hostname,
      description: decode(description) ?? '',
      favicon_url: favicon,
      reading_time: readingTime,
      hostname,
    })
  } catch {
    return NextResponse.json(fallback(url))
  }
}

function extract(html: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const m = html.match(pattern)
    if (m?.[1]?.trim()) return m[1].trim()
  }
  return null
}

function extractFavicon(html: string, origin: string): string | null {
  const patterns = [
    /<link[^>]+rel="shortcut icon"[^>]+href="([^"]+)"/i,
    /<link[^>]+href="([^"]+)"[^>]+rel="shortcut icon"/i,
    /<link[^>]+rel="icon"[^>]+href="([^"]+)"/i,
    /<link[^>]+href="([^"]+)"[^>]+rel="icon"/i,
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m?.[1]) {
      const href = m[1].trim()
      if (href.startsWith('http')) return href
      if (href.startsWith('//')) return 'https:' + href
      if (href.startsWith('/')) return origin + href
      return origin + '/' + href
    }
  }
  return null
}

function decode(str: string | null): string | null {
  if (!str) return null
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&nbsp;/g, ' ')
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
