import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detachActiveChildren } from '@/lib/notes/hierarchy'

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only allow permanent deletion of notes that are already in trash
  const { data: existing } = await supabase
    .from('notes')
    .select('deleted_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!existing.deleted_at) return NextResponse.json({ error: 'Note is not in trash' }, { status: 400 })

  // Keep any sub-notes that are still active instead of letting the database cascade-delete them.
  await detachActiveChildren(supabase, user.id, [id])

  const { error } = await supabase.from('notes').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
