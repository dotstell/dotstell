import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The `.in()` filter puts every id in the request URL, so a batch stays small enough for it.
const MAX_PAIRS = 60

// Same sentinel the editor uses, so these edges behave exactly like wikilinks typed by hand.
const WIKILINK_LABEL = '__wikilink__'

// POST /api/import/links
// Body: { pairs: [sourceNoteId, targetNoteId][] }
// Records the wikilinks between imported notes. Sent after every note exists.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`import-links:${user.id}`, 240, 60_000)
  if (rl) return rl

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }

  const pairs: unknown = body.pairs
  if (!Array.isArray(pairs) || pairs.length === 0 || pairs.length > MAX_PAIRS) {
    return NextResponse.json({ error: `Send between 1 and ${MAX_PAIRS} pairs per request` }, { status: 400 })
  }
  for (const p of pairs) {
    if (!Array.isArray(p) || p.length !== 2 || !p.every(id => typeof id === 'string' && UUID.test(id))) {
      return NextResponse.json({ error: 'Invalid pair' }, { status: 400 })
    }
  }

  // Both ends must be this user's notes.
  const wanted = [...new Set((pairs as string[][]).flat())]
  const { data: owned, error: ownedError } = await supabase
    .from('notes').select('id').eq('user_id', user.id).in('id', wanted)
  if (ownedError) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  const mine = new Set((owned ?? []).map(r => r.id))

  const rows = (pairs as string[][])
    .filter(([s, t]) => s !== t && mine.has(s) && mine.has(t))
    .map(([s, t]) => ({
      user_id: user.id, source_id: s, source_type: 'note', target_id: t, target_type: 'note', label: WIKILINK_LABEL,
    }))

  if (rows.length) {
    const { error } = await supabase
      .from('knowledge_links')
      .upsert(rows, { onConflict: 'user_id,source_id,target_id', ignoreDuplicates: true })
    if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
  return NextResponse.json({ linked: rows.length })
}
