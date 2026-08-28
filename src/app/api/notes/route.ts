import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type      = searchParams.get('type')
  const person_id = searchParams.get('person_id')
  const parent_id = searchParams.get('parent_id')
  const q         = searchParams.get('q')
  const root_only = searchParams.get('root_only') // 'true' = only top-level notes
  const sort      = searchParams.get('sort')      // 'manual' = pinned first, then sort_order

  // Exclude soft-deleted notes from all normal queries
  let query = supabase.from('notes').select('*').eq('user_id', user.id).is('deleted_at', null)
  if (sort === 'manual') {
    query = query.order('pinned', { ascending: false }).order('sort_order', { ascending: true }).order('updated_at', { ascending: false })
  } else {
    query = query.order('updated_at', { ascending: false })
  }

  if (type)      query = query.eq('type', type)
  if (person_id) query = query.eq('person_id', person_id)
  if (parent_id) query = query.eq('parent_id', parent_id)
  if (root_only === 'true') query = query.is('parent_id', null)
  if (q) {
    const safe = q.slice(0, 200).replace(/%/g, '\\%').replace(/_/g, '\\_')
    query = query.or(`title.ilike.%${safe}%,content.ilike.%${safe}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })

  // Attach sub-note counts in a separate query rather than a JOIN: Supabase's
  // PostgREST .select() with aggregates requires specific schema setup, and a
  // second flat query + in-memory group-by is simpler and fast enough at this scale.
  if (root_only === 'true' && data && data.length > 0) {
    const ids = data.map((n: { id: string }) => n.id)
    const { data: subs } = await supabase
      .from('notes')
      .select('parent_id')
      .in('parent_id', ids)
      .eq('user_id', user.id)
      .is('deleted_at', null)

    const countMap: Record<string, number> = {}
    for (const s of (subs ?? [])) {
      if (s.parent_id) countMap[s.parent_id] = (countMap[s.parent_id] ?? 0) + 1
    }
    const enriched = data.map((n: { id: string }) => ({ ...n, sub_notes_count: countMap[n.id] ?? 0 }))
    return NextResponse.json(enriched)
  }

  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = rateLimit(`notes-post:${user.id}`, 30, 60_000)
  if (rl) return rl

  let body!
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  if (typeof body.title !== 'string') {
    return NextResponse.json({ error: 'Invalid title' }, { status: 400 })
  }
  if (typeof body.content === 'string' && body.content.length > 2_000_000) {
    return NextResponse.json({ error: 'Content too large (max 2 MB)' }, { status: 413 })
  }
  const { data, error } = await supabase.from('notes').insert({
    user_id:         user.id,
    title:           body.title,
    content:         body.content,
    type:            body.type,
    checklist_items: body.checklist_items,
    tags:            body.tags,
    person_id:       body.person_id,
    parent_id:       body.parent_id,
  }).select().single()
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
