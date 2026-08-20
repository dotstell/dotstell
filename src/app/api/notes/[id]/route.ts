import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.from('notes').select('*').eq('id', id).eq('user_id', user.id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = rateLimit(`notes-patch:${user.id}`, 120, 60_000)
  if (rl) return rl

  const body = await req.json()
  const allowed: Record<string, unknown> = {}
  const fields = ['title','content','type','tags','person_id','parent_id','pinned','sort_order','checklist_items','color'] as const
  for (const f of fields) if (f in body) allowed[f] = body[f]

  if ('color' in allowed) {
    const c = allowed.color
    if (c !== null && (typeof c !== 'string' || !/^#[0-9a-f]{6}$/i.test(c)))
      return NextResponse.json({ error: 'Invalid color value' }, { status: 400 })
  }

  const { data, error } = await supabase.from('notes').update(allowed).eq('id', id).eq('user_id', user.id).select().single()
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('notes').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
