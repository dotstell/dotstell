import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ParsedBookmark {
  title: string
  url: string
  description: string
  tags: string[]
}

interface SkippedEntry {
  url: string
  reason: string
}

function parseNetscapeHTML(html: string): { bookmarks: ParsedBookmark[]; skipped: SkippedEntry[] } {
  const bookmarks: ParsedBookmark[] = []
  const skipped: SkippedEntry[] = []

  const tokenPattern = /<(\/DL|DL|DT)[^>]*>|<H3[^>]*>(.*?)<\/H3>|<A\s+[^>]*HREF="([^"]*)"[^>]*>(.*?)<\/A>/gi
  const folderStack: string[] = []
  let match: RegExpExecArray | null

  while ((match = tokenPattern.exec(html)) !== null) {
    const [, tagName, h3Text, href, aText] = match

    if (tagName) {
      if (tagName.toUpperCase() === '/DL') folderStack.pop()
      continue
    }

    if (h3Text !== undefined) {
      const name = h3Text.replace(/<[^>]+>/g, '').trim()
      if (name) folderStack.push(name)
      continue
    }

    if (href && aText !== undefined) {
      const url = href.trim()
      const title = aText.replace(/<[^>]+>/g, '').trim()

      // Track skipped with reasons
      if (!url) { skipped.push({ url: title || '(empty)', reason: 'Empty URL' }); continue }
      if (url.startsWith('javascript:')) { skipped.push({ url, reason: 'JavaScript link' }); continue }
      if (url.startsWith('place:')) { skipped.push({ url, reason: 'Firefox internal link' }); continue }
      if (url.length > 2000) { skipped.push({ url: url.slice(0, 80) + '…', reason: 'URL too long' }); continue }

      try {
        new URL(url)
      } catch {
        skipped.push({ url, reason: 'Invalid URL format' })
        continue
      }

      const tags = [...new Set(
        folderStack
          .map(f => f.toLowerCase().trim())
          .filter(f => f.length > 0 && !['bookmarks bar', 'other bookmarks', 'mobile bookmarks', 'bookmarks menu'].includes(f))
      )]

      bookmarks.push({ title: title || url, url, description: '', tags })
    }
  }

  return { bookmarks, skipped }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { html } = body as { html: string }
  if (!html) return NextResponse.json({ error: 'Missing html' }, { status: 400 })

  const { bookmarks: parsed, skipped } = parseNetscapeHTML(html)
  if (parsed.length === 0) {
    return NextResponse.json({
      error: 'No valid bookmarks found',
      skipped_count: skipped.length,
      skip_reasons: summariseReasons(skipped),
    }, { status: 400 })
  }

  // Get existing URLs for this user to detect duplicates
  const { data: existing } = await supabase
    .from('bookmarks')
    .select('url')
    .eq('user_id', user.id)

  const existingUrls = new Set((existing ?? []).map(b => b.url))
  const newBookmarks    = parsed.filter(b => !existingUrls.has(b.url))
  const duplicateCount  = parsed.length - newBookmarks.length

  const BATCH = 500
  let imported = 0

  for (let i = 0; i < newBookmarks.length; i += BATCH) {
    const batch = newBookmarks.slice(i, i + BATCH).map(b => ({
      user_id: user.id,
      title: b.title.slice(0, 500),
      url: b.url.slice(0, 2000),
      description: b.description,
      tags: b.tags,
    }))

    const { data, error } = await supabase
      .from('bookmarks')
      .insert(batch)
      .select('id')

    if (!error) imported += data?.length ?? batch.length
  }

  return NextResponse.json({
    imported,
    duplicates: duplicateCount,
    skipped_invalid: skipped.length,
    total_in_file: parsed.length + skipped.length,
    skip_reasons: summariseReasons(skipped),
  })
}

function summariseReasons(skipped: SkippedEntry[]): Record<string, number> {
  const counts: Record<string, number> = {}
  skipped.forEach(s => { counts[s.reason] = (counts[s.reason] ?? 0) + 1 })
  return counts
}
