import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'

// POST /api/ai/auto-link
// Body: { noteId }
// Scans the note's plain-text content for mentions of other note titles that
// aren't already wikilinked, and returns the discovered suggestions.
// This is a text-matching approach (no LLM needed) — fast and works without embeddings.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-autolink:${user.id}`, 30, 60_000)
  if (rl) return rl

  let _parsed: Record<string, unknown>
  try { _parsed = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  const { noteId } = _parsed
  if (!noteId) return NextResponse.json({ error: 'noteId required' }, { status: 400 })

  // Fetch the source note's content
  const { data: sourceNote } = await supabase
    .from('notes')
    .select('id, title, content')
    .eq('id', noteId)
    .eq('user_id', user.id)
    .single()
  if (!sourceNote) return NextResponse.json({ error: 'Note not found' }, { status: 404 })

  // Fetch all other non-deleted notes to scan for title mentions
  const { data: allNotes } = await supabase
    .from('notes')
    .select('id, title')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .neq('id', noteId)
    .not('title', 'is', null)
    .neq('title', '')
    .limit(500)

  if (!allNotes?.length) return NextResponse.json([])

  // Strip HTML to get plain text for matching
  const plainText = sourceNote.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase()

  // Find titles that appear in the content but aren't already wikilinked
  // A wikilink in the HTML looks like data-wikilink, so we check the raw HTML for existing links
  const existingWikiLinks = new Set<string>()
  const wikilinkMatches = sourceNote.content.matchAll(/data-note-id="([^"]+)"/g)
  for (const m of wikilinkMatches) existingWikiLinks.add(m[1])

  const suggestions = allNotes
    .filter(n => {
      if (existingWikiLinks.has(n.id)) return false  // already wikilinked
      if (!n.title || n.title.length < 3) return false  // skip very short titles (too many false positives)
      // Whole-word match only — avoid partial matches (e.g. "Note" matching "Notebook")
      const pattern = new RegExp(`\\b${n.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').toLowerCase()}\\b`)
      return pattern.test(plainText)
    })
    .slice(0, 10)  // cap at 10 suggestions
    .map(n => ({ id: n.id, title: n.title }))

  return NextResponse.json(suggestions)
}
