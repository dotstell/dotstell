import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'

// Stateless preview — parses the HTML file and returns folder/count stats without
// writing anything to the database. The client shows this data in a confirmation UI
// before the user commits to the actual import via /bookmarks/bulk-import.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = rateLimit(`bookmarks-preview-import:${user.id}`, 10, 60_000)
  if (rl) return rl

  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Payload too large (max 10 MB)' }, { status: 413 })
  }
  let _parsed: Record<string, unknown>
  try { _parsed = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  const { html } = _parsed
  if (!html || html.length > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Payload too large (max 10 MB)' }, { status: 413 })
  }

  // Count how many bookmarks land in each deepest folder
  const folderCounts = new Map<string, number>()
  const IGNORE = new Set(['bookmarks bar', 'other bookmarks', 'mobile bookmarks', 'bookmarks menu'])

  const tokenPattern = /<(\/DL|DL|DT)[^>]*>|<H3[^>]*>(.*?)<\/H3>|<A\s+[^>]*HREF="([^"]*)"[^>]*>(.*?)<\/A>/gi
  const folderStack: string[] = []
  let match: RegExpExecArray | null

  while ((match = tokenPattern.exec(html)) !== null) {
    const [, tagName, h3Text, href] = match
    if (tagName) {
      if (tagName.toUpperCase() === '/DL') folderStack.pop()
      continue
    }
    if (h3Text !== undefined) {
      const name = h3Text.replace(/<[^>]+>/g, '').trim()
      if (name) folderStack.push(name)
      continue
    }
    if (href) {
      const meaningful = folderStack.map(f => f.toLowerCase().trim()).filter(f => f && !IGNORE.has(f))
      const tag = meaningful[meaningful.length - 1] ?? '(uncategorised)'
      folderCounts.set(tag, (folderCounts.get(tag) ?? 0) + 1)
    }
  }

  const folders = [...folderCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([folder, count]) => ({ folder, count }))

  return NextResponse.json({ folders, total_folders: folders.length })
}
