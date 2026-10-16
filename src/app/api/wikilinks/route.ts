import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// POST /api/wikilinks
// Body: { sourceNoteId: string, targetNoteIds: string[] }
// Syncs knowledge_links for wikilinks: deletes removed, inserts new.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let _parsed!: Record<string, unknown>
  try { _parsed = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  const { sourceNoteId, targetNoteIds } = _parsed as {
    sourceNoteId: string
    targetNoteIds: string[]
  }

  if (!sourceNoteId) return NextResponse.json({ error: 'sourceNoteId required' }, { status: 400 })

  // Verify the source note belongs to the authenticated user (ownership check)
  const { data: srcNote } = await supabase.from('notes').select('id').eq('id', sourceNoteId).eq('user_id', user.id).single()
  if (!srcNote) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!Array.isArray(targetNoteIds)) return NextResponse.json({ error: 'targetNoteIds must be an array' }, { status: 400 })
  if (targetNoteIds.length > 500) return NextResponse.json({ error: 'Too many targetNoteIds' }, { status: 400 })
  if (targetNoteIds.some(id => typeof id !== 'string')) {
    return NextResponse.json({ error: 'targetNoteIds must be strings' }, { status: 400 })
  }

  // The editor sends the complete current set of wikilinks. Edges are kept in step by saving the new
  // set FIRST and removing stale ones afterwards, so a failed save never leaves the note without its
  // links (deleting first lost them all when the insert was rejected).
  // label='__wikilink__' distinguishes these auto-tracked edges from user-created manual links.
  const wanted = [...new Set(targetNoteIds)].filter(id => UUID.test(id) && id !== sourceNoteId)

  // Only notes that belong to this user can be linked to.
  const owned = new Set<string>()
  for (let i = 0; i < wanted.length; i += 100) {
    const { data } = await supabase.from('notes').select('id').eq('user_id', user.id).in('id', wanted.slice(i, i + 100))
    for (const row of data ?? []) owned.add(row.id)
  }
  const targets = wanted.filter(id => owned.has(id))

  if (targets.length) {
    const rows = targets.map(tid => ({
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
  }

  let stale = supabase
    .from('knowledge_links')
    .delete()
    .eq('user_id', user.id)
    .eq('source_id', sourceNoteId)
    .eq('source_type', 'note')
    .eq('target_type', 'note')
    .eq('label', '__wikilink__')
  if (targets.length) stale = stale.not('target_id', 'in', `(${targets.join(',')})`)
  const { error: deleteError } = await stale
  if (deleteError) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })

  return NextResponse.json({ ok: true, count: targets.length })
}
