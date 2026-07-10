import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Rename a tag across all bookmarks
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { oldTag, newTag } = await req.json()
  if (!oldTag || !newTag) return NextResponse.json({ error: 'Missing oldTag or newTag' }, { status: 400 })

  // Fetch all bookmarks that have the old tag
  const { data: bookmarks, error } = await supabase
    .from('bookmarks')
    .select('id, tags')
    .eq('user_id', user.id)
    .contains('tags', [oldTag])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!bookmarks || bookmarks.length === 0) return NextResponse.json({ updated: 0 })

  // Update each bookmark's tags array
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

  const { tag } = await req.json()
  if (!tag) return NextResponse.json({ error: 'Missing tag' }, { status: 400 })

  const { data: bookmarks, error } = await supabase
    .from('bookmarks')
    .select('id, tags')
    .eq('user_id', user.id)
    .contains('tags', [tag])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!bookmarks || bookmarks.length === 0) return NextResponse.json({ updated: 0 })

  let updated = 0
  for (const b of bookmarks) {
    const newTags = b.tags.filter((t: string) => t !== tag)
    const { error: ue } = await supabase.from('bookmarks').update({ tags: newTags }).eq('id', b.id).eq('user_id', user.id)
    if (!ue) updated++
  }

  return NextResponse.json({ updated })
}
