import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/notes/:id/backlinks
// Returns notes that contain a [[wikilink]] pointing to this note.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Find all knowledge_links where target = this note and label = __wikilink__
  const { data: links, error } = await supabase
    .from('knowledge_links')
    .select('source_id')
    .eq('user_id', user.id)
    .eq('target_id', id)
    .eq('target_type', 'note')
    .eq('label', '__wikilink__')

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  if (!links || links.length === 0) return NextResponse.json([])

  const sourceIds = links.map(l => l.source_id)

  const { data: notes, error: notesErr } = await supabase
    .from('notes')
    .select('id, title, updated_at')
    .eq('user_id', user.id)
    .in('id', sourceIds)
    .order('updated_at', { ascending: false })

  if (notesErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return NextResponse.json(notes ?? [])
}
