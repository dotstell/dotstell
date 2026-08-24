import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed: Record<string, unknown> = {}
  // Allowlist prevents arbitrary column writes (e.g. user_id override)
  const fields = ['title','url','description','favicon_url','reading_time','hostname','tags','last_visited_at','visit_count'] as const
  for (const f of fields) if (f in body) allowed[f] = body[f]
  // .eq('user_id') is defense-in-depth alongside RLS — ensures even a misconfigured client cannot overwrite another user's bookmark
  const { data, error } = await supabase.from('bookmarks').update(allowed).eq('id', id).eq('user_id', user.id).select().single()
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('bookmarks').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
