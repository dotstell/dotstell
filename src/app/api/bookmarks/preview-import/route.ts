import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { html } = await req.json()

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
