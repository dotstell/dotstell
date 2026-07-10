import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ParsedBookmark {
  title: string
  url: string
  description: string
  tags: string[]
}

/**
 * Parses Netscape bookmark HTML (Chrome, Firefox, Edge, Safari export format).
 *
 * The format nests bookmarks inside <DL> lists with <H3> folder names:
 *
 *   <DT><H3>Work</H3>
 *   <DL>
 *     <DT><A HREF="https://...">Title</A>
 *     <DT><H3>Sub folder</H3>
 *     <DL>
 *       <DT><A HREF="https://...">Title</A>
 *     </DL>
 *   </DL>
 *
 * We walk the HTML as a flat token stream tracking which folders are currently
 * open. Each bookmark inherits ALL ancestor folder names as tags.
 */
function parseNetscapeHTML(html: string): ParsedBookmark[] {
  const bookmarks: ParsedBookmark[] = []

  // Tokenise: pull out H3 opens, DL opens/closes, and A tags in order
  const tokenPattern = /<(\/DL|DL|DT)[^>]*>|<H3[^>]*>(.*?)<\/H3>|<A\s+[^>]*HREF="([^"]*)"[^>]*>(.*?)<\/A>/gi
  const folderStack: string[] = []
  let match: RegExpExecArray | null

  while ((match = tokenPattern.exec(html)) !== null) {
    const [full, tagName, h3Text, href, aText] = match

    if (tagName) {
      const tag = tagName.toUpperCase()
      if (tag === 'DL') {
        // Opening a new nested list — the folder name was pushed just before
      } else if (tag === '/DL') {
        // Closing a nested list — pop the most recent folder
        folderStack.pop()
      }
      continue
    }

    if (h3Text !== undefined) {
      // A folder header — push its name, it applies to the next <DL>
      const name = h3Text.replace(/<[^>]+>/g, '').trim()
      if (name) folderStack.push(name)
      continue
    }

    if (href && aText !== undefined) {
      const url = href.trim()
      const title = aText.replace(/<[^>]+>/g, '').trim()
      if (!url || url.startsWith('javascript:') || url.startsWith('place:')) continue
      try { new URL(url) } catch { continue }

      // Convert folder names to lowercase tags, deduplicate
      const tags = [...new Set(
        folderStack
          .map(f => f.toLowerCase().trim())
          .filter(f => f.length > 0 && f !== 'bookmarks bar' && f !== 'other bookmarks' && f !== 'mobile bookmarks')
      )]

      bookmarks.push({ title: title || url, url, description: '', tags })
    }
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
      .upsert(batch, { onConflict: 'user_id,url', ignoreDuplicates: false })
      .select('id')

    if (!error) imported += data?.length ?? batch.length
    else skipped += batch.length
  }

  return NextResponse.json({ imported, skipped, total: parsed.length })
}
