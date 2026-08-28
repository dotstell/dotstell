import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let _parsed!: Record<string, unknown>
  try { _parsed = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  const { ids } = _parsed as { ids: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No ids provided' }, { status: 400 })
  }
  if (ids.length > 1000) {
    return NextResponse.json({ error: 'Too many ids (max 1000)' }, { status: 400 })
  }

  const { error, count } = await supabase
    .from('bookmarks')
    .delete({ count: 'exact' })
    .eq('user_id', user.id)
    .in('id', ids)

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return NextResponse.json({ deleted: count ?? ids.length })
}
