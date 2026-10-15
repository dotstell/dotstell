import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'

const IMPORT_TAG = /^imported-[A-Za-z0-9-]{1,40}$/

// POST /api/import/undo
// Body: { importTag }
// Moves every note from one import to the trash. It is the soft delete the app already uses, so
// nothing is lost: the notes can still be restored from the trash. People created by the same import
// are removed (they have no trash); people who already existed never carry the import tag.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`import-undo:${user.id}`, 10, 60_000)
  if (rl) return rl

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  if (typeof body.importTag !== 'string' || !IMPORT_TAG.test(body.importTag)) {
    return NextResponse.json({ error: 'Invalid import tag' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .contains('tags', [body.importTag])
    .is('deleted_at', null)
    .select('id')

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })

  const { data: removed, error: peopleError } = await supabase
    .from('people')
    .delete()
    .eq('user_id', user.id)
    .contains('tags', [body.importTag])
    .select('id')
  if (peopleError) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })

  return NextResponse.json({ trashed: data?.length ?? 0, removedPeople: removed?.length ?? 0 })
}
