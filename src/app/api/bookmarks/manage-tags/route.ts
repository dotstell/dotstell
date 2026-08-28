import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Rename a tag across all bookmarks
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let _parsed!: Record<string, unknown>
  try { _parsed = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  const { oldTag, newTag } = _parsed
  if (!oldTag || !newTag) return NextResponse.json({ error: 'Missing oldTag or newTag' }, { status: 400 })
  if (typeof oldTag !== 'string' || typeof newTag !== 'string') {
    return NextResponse.json({ error: 'Tags must be strings' }, { status: 400 })
  }
  if (oldTag.length > 100 || newTag.length > 100) {
    return NextResponse.json({ error: 'Tag name too long (max 100 chars)' }, { status: 400 })
  }

  // Fetch bookmarks with the old tag. The .limit(500) caps round-trips for large
  // libraries — a user with many bookmarks sharing one tag would otherwise issue
  // N sequential UPDATEs. Users needing to rename across more than 500 bookmarks
  // can re-run; a future Postgres RPC would do this in one query.
  const { data: bookmarks, error } = await supabase
    .from('bookmarks')
    .select('id, tags')
    .eq('user_id', user.id)
    .contains('tags', [oldTag])
    .limit(500)

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  if (!bookmarks || bookmarks.length === 0) return NextResponse.json({ updated: 0 })

  // Update each bookmark individually — Supabase/Postgres has no native array-element replace,
  // so a bulk UPDATE WHERE tags @> [oldTag] cannot atomically swap one element in each row.
  const updates = bookmarks.map(b => ({
    id: b.id,
    tags: [...new Set(b.tags.map((t: string) => t === oldTag ? newTag.toLowerCase().trim() : t))],
  }))

  let updated = 0
  for (const u of updates) {
    const { error: ue } = await supabase.from('bookmarks').update({ tags: u.tags }).eq('id', u.id).eq('user_id', user.id)
    if (!ue) updated++
  }

  return NextResponse.json({ updated })
}

// Delete a tag from all bookmarks
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let _parsed!: Record<string, unknown>
  try { _parsed = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  const { tag } = _parsed
  if (!tag) return NextResponse.json({ error: 'Missing tag' }, { status: 400 })

  // Same 500-row cap as PATCH — see comment above
  const { data: bookmarks, error } = await supabase
    .from('bookmarks')
    .select('id, tags')
    .eq('user_id', user.id)
    .contains('tags', [tag])
    .limit(500)

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  if (!bookmarks || bookmarks.length === 0) return NextResponse.json({ updated: 0 })

  let updated = 0
  for (const b of bookmarks) {
    const newTags = b.tags.filter((t: string) => t !== tag)
    const { error: ue } = await supabase.from('bookmarks').update({ tags: newTags }).eq('id', b.id).eq('user_id', user.id)
    if (!ue) updated++
  }

  return NextResponse.json({ updated })
}
