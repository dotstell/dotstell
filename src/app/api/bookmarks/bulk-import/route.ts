import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'

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

// Parses the Netscape Bookmark File Format exported by Chrome, Firefox, and Safari.
// Format spec: https://learn.microsoft.com/en-us/previous-versions/windows/internet-explorer/ie-developer/platform-apis/aa753582(v=vs.85)
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

      if (!url) { skipped.push({ url: title || '(empty)', reason: 'Empty URL' }); continue }
      if (url.startsWith('javascript:')) { skipped.push({ url, reason: 'JavaScript link' }); continue }
      if (url.startsWith('place:')) { skipped.push({ url, reason: 'Firefox internal link' }); continue }
      if (url.length > 2000) { skipped.push({ url: url.slice(0, 80) + '…', reason: 'URL too long' }); continue }

      try {
        const parsed = new URL(url)
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          skipped.push({ url, reason: 'Only http/https URLs are allowed' })
          continue
        }
      } catch {
        skipped.push({ url, reason: 'Invalid URL format' })
        continue
      }

      const IGNORE = new Set(['bookmarks bar', 'other bookmarks', 'mobile bookmarks', 'bookmarks menu'])

      const meaningfulFolders = folderStack
        .map(f => f.toLowerCase().trim())
        .filter(f => f.length > 0 && !IGNORE.has(f))

      // Use only the deepest (most specific) folder as the tag.
      // Using the full ancestor chain creates tag explosion:
      // "Work > Tools > VS Code" → 3 collections instead of 1.
      const tags = meaningfulFolders.length > 0
        ? [meaningfulFolders[meaningfulFolders.length - 1]]
        : []

      bookmarks.push({ title: title || url, url, description: '', tags })
    }
  }

  return { bookmarks, skipped }
}

// Fetch ALL existing URLs with pagination — Supabase default limit is 1000
async function fetchAllExistingUrls(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<Set<string>> {
  const urls = new Set<string>()
  const PAGE = 1000
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('url')
      .eq('user_id', userId)
      .range(from, from + PAGE - 1)

    if (error || !data || data.length === 0) break
    data.forEach(b => urls.add(b.url))
    if (data.length < PAGE) break
    from += PAGE
  }

  return urls
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = rateLimit(`bookmarks-bulk-import:${user.id}`, 5, 60_000)
  if (rl) return rl

  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Payload too large (max 10 MB)' }, { status: 413 })
  }
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  const { html, force, selectedTags } = body as { html: string; force?: boolean; selectedTags?: string[] }
  if (!html) return NextResponse.json({ error: 'Missing html' }, { status: 400 })
  if (html.length > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'HTML payload too large (max 10 MB)' }, { status: 413 })
  }

  const { bookmarks: allParsed, skipped } = parseNetscapeHTML(html)

  // Filter to only selected categories if provided
  const parsed = selectedTags && selectedTags.length > 0
    ? allParsed.filter(b => b.tags.some(t => selectedTags.includes(t)) || (b.tags.length === 0 && selectedTags.includes('__uncategorised__')))
    : allParsed
  if (parsed.length === 0) {
    return NextResponse.json({
      error: 'No valid bookmarks found',
      skipped_invalid: skipped.length,
      skip_reasons: summariseReasons(skipped),
    }, { status: 400 })
  }

  // Deduplicate within the file itself — same URL in multiple folders
  // Merge tags from all occurrences so no folder info is lost
  const urlMap = new Map<string, ParsedBookmark>()
  for (const b of parsed) {
    if (urlMap.has(b.url)) {
      const existing = urlMap.get(b.url)!
      existing.tags = [...new Set([...existing.tags, ...b.tags])]
    } else {
      urlMap.set(b.url, { ...b })
    }
  }
  const deduped = [...urlMap.values()]
  const inFileDuplicates = parsed.length - deduped.length

  // Fetch existing URLs with full pagination
  const existingUrls = force ? new Set<string>() : await fetchAllExistingUrls(supabase, user.id)
  const existing_count = existingUrls.size

  const newBookmarks   = deduped.filter(b => !existingUrls.has(b.url))
  const duplicateCount = deduped.length - newBookmarks.length

  const BATCH = 500
  let imported = 0
  let insert_errors = 0
  let first_error: string | null = null

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

    if (!error && data) {
      imported += data.length
    } else {
      insert_errors += batch.length
      if (!first_error && error) first_error = error.message
    }
  }

  return NextResponse.json({
    imported,
    duplicates: duplicateCount,
    in_file_duplicates: inFileDuplicates,
    skipped_invalid: skipped.length,
    total_in_file: parsed.length + skipped.length,
    existing_in_db: existing_count,
    insert_errors,
    first_error,
    skip_reasons: summariseReasons(skipped),
  })
}

function summariseReasons(skipped: SkippedEntry[]): Record<string, number> {
  const counts: Record<string, number> = {}
  skipped.forEach(s => { counts[s.reason] = (counts[s.reason] ?? 0) + 1 })
  return counts
}
