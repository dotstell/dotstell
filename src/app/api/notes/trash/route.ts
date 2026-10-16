import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detachActiveChildren } from '@/lib/notes/hierarchy'

const TRASH_TTL_DAYS = 30

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Auto-purge is triggered on every GET rather than a scheduled job — simpler
  // to operate (no cron required) and acceptable because trash is only checked
  // when the user explicitly opens the Trash view.
  // Auto-purge notes that have been in trash longer than the TTL
  const expiry = new Date(Date.now() - TRASH_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const { data: expired } = await supabase
    .from('notes')
    .select('id')
    .eq('user_id', user.id)
    .not('deleted_at', 'is', null)
    .lt('deleted_at', expiry)
    .limit(500)
  if (expired?.length) {
    const ids = expired.map(n => n.id)
    // Sub-notes the user kept working on must not be destroyed with their expired parent.
    await detachActiveChildren(supabase, user.id, ids)
    await supabase.from('notes').delete().eq('user_id', user.id).in('id', ids)
  }

  const { data, error } = await supabase
    .from('notes')
    .select('id, title, type, tags, deleted_at, updated_at, created_at')
    .eq('user_id', user.id)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Emptying the trash removes trashed notes only; active sub-notes of a trashed note are kept.
  for (;;) {
    const { data: batch, error: listError } = await supabase
      .from('notes')
      .select('id')
      .eq('user_id', user.id)
      .not('deleted_at', 'is', null)
      .limit(500)
    if (listError) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
    if (!batch?.length) break
    const ids = batch.map(n => n.id)
    await detachActiveChildren(supabase, user.id, ids)
    const { error: deleteError } = await supabase.from('notes').delete().eq('user_id', user.id).in('id', ids)
    if (deleteError) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
  return new NextResponse(null, { status: 204 })
}
