import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/notes/:id/unlinked-mentions
// Returns notes that mention this note's title in their content but do NOT
// have a formal [[wikilink]] edge pointing to it.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get the title of the note we're checking mentions for
  const { data: thisNote, error: noteErr } = await supabase
    .from('notes')
    .select('id, title')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (noteErr || !thisNote) return NextResponse.json([])

  const title = (thisNote.title ?? '').trim()
  if (!title || title.length < 2) return NextResponse.json([])

  // Get all notes that have a wikilink edge TO this note (already formally linked)
  const { data: formalLinks } = await supabase
    .from('knowledge_links')
    .select('source_id')
    .eq('user_id', user.id)
    .eq('target_id', id)
    .eq('target_type', 'note')
    .eq('label', '__wikilink__')

  const alreadyLinkedIds = new Set((formalLinks ?? []).map(l => l.source_id))
  alreadyLinkedIds.add(id) // exclude the note itself

  // Search for notes whose content or title mentions this note's title as plain text
  // Uses Supabase ilike — content is HTML so we search for the raw text occurrence
  const { data: mentioning, error: searchErr } = await supabase
    .from('notes')
    .select('id, title, updated_at, content')
    .eq('user_id', user.id)
    .ilike('content', `%${title}%`)
    .neq('id', id)
    .order('updated_at', { ascending: false })
    .limit(20)

  if (searchErr) return NextResponse.json([])

  // Filter: only include notes that aren't already formally linked
  // and strip the content field before returning
  const results = (mentioning ?? [])
    .filter(n => !alreadyLinkedIds.has(n.id))
    .map(({ id: nId, title: nTitle, updated_at }) => ({ id: nId, title: nTitle, updated_at }))

  return NextResponse.json(results)
}
