import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/wikilinks
// Body: { sourceNoteId: string, targetNoteIds: string[] }
// Syncs knowledge_links for wikilinks: deletes removed, inserts new.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sourceNoteId, targetNoteIds } = await req.json() as {
    sourceNoteId: string
    targetNoteIds: string[]
  }

  if (!sourceNoteId) return NextResponse.json({ error: 'sourceNoteId required' }, { status: 400 })
  if (!Array.isArray(targetNoteIds)) return NextResponse.json({ error: 'targetNoteIds must be an array' }, { status: 400 })
  if (targetNoteIds.length > 500) return NextResponse.json({ error: 'Too many targetNoteIds' }, { status: 400 })
  if (targetNoteIds.some(id => typeof id !== 'string')) {
    return NextResponse.json({ error: 'targetNoteIds must be strings' }, { status: 400 })
  }

  // Delete-then-insert (replace-all) sync: the editor sends the complete current
  // set of wikilinks, so stale edges are removed and new ones are added in one round trip.
  // label='__wikilink__' distinguishes these auto-tracked edges from user-created manual links.
  await supabase
    .from('knowledge_links')
    .delete()
    .eq('user_id', user.id)
    .eq('source_id', sourceNoteId)
    .eq('source_type', 'note')
    .eq('target_type', 'note')
    .eq('label', '__wikilink__')

  if (targetNoteIds.length === 0) return NextResponse.json({ ok: true })

  // Insert fresh edges
  const rows = targetNoteIds.map(tid => ({
    user_id:     user.id,
    source_id:   sourceNoteId,
    source_type: 'note',
    target_id:   tid,
    target_type: 'note',
    label:       '__wikilink__',
  }))

  const { error } = await supabase.from('knowledge_links').upsert(rows, {
    onConflict: 'user_id,source_id,target_id',
    ignoreDuplicates: false,
  })

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return NextResponse.json({ ok: true, count: rows.length })
}
