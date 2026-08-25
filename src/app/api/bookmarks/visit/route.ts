import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  // Read-then-increment: PostgREST has no atomic column increment (no UPDATE SET col = col + 1),
  // so we fetch the current count first. Race condition is acceptable here — visit counts are
  // a soft metric, not a financial counter.
  const { data: current } = await supabase
    .from('bookmarks')
    .select('visit_count')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase
    .from('bookmarks')
    .update({
      last_visited_at: new Date().toISOString(),
      visit_count: (current?.visit_count ?? 0) + 1,
    })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
