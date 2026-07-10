import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ParsedBookmark {
  title: string
  url: string
  description: string
  tags: string[]
}

function parseNetscapeHTML(html: string): ParsedBookmark[] {
  const bookmarks: ParsedBookmark[] = []
  // Match <A HREF="..." ...>Title</A> — standard Netscape bookmark format
  const linkPattern = /<a\s+[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gi
  let match: RegExpExecArray | null

  while ((match = linkPattern.exec(html)) !== null) {
    const url = match[1].trim()
    const title = match[2].replace(/<[^>]+>/g, '').trim()
    if (!url || url.startsWith('javascript:') || url === 'place:') continue
    try { new URL(url) } catch { continue }
    bookmarks.push({ title: title || url, url, description: '', tags: [] })
  }

  return bookmarks
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { html } = body as { html: string }
  if (!html) return NextResponse.json({ error: 'Missing html' }, { status: 400 })

  const parsed = parseNetscapeHTML(html)
  if (parsed.length === 0) return NextResponse.json({ error: 'No bookmarks found in file' }, { status: 400 })

  // Insert in batches of 50
  const BATCH = 50
  let imported = 0
  let skipped = 0

  for (let i = 0; i < parsed.length; i += BATCH) {
    const batch = parsed.slice(i, i + BATCH).map(b => ({
      user_id: user.id,
      title: b.title.slice(0, 500),
      url: b.url.slice(0, 2000),
      description: b.description,
      tags: b.tags,
    }))

    const { data, error } = await supabase
      .from('bookmarks')
      .upsert(batch, { onConflict: 'user_id,url', ignoreDuplicates: true })
      .select('id')

    if (!error) imported += data?.length ?? batch.length
    else skipped += batch.length
  }

  return NextResponse.json({ imported, skipped, total: parsed.length })
}
