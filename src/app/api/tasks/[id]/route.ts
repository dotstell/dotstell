import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).eq('user_id', user.id).single()
  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  const allowed: Record<string, unknown> = {}
  // Allowlist prevents mass-assignment — only these fields may be updated via PATCH
  const fields = ['title','description','status','priority','due_date','tags','person_id'] as const
  for (const f of fields) if (f in body) allowed[f] = body[f]
  // Ownership check: person_id must belong to the current user
  if ('person_id' in allowed && allowed.person_id) {
    const { data: person } = await supabase
      .from('people')
      .select('id')
      .eq('id', allowed.person_id as string)
      .eq('user_id', user.id)
      .single()
    if (!person) return NextResponse.json({ error: 'person_id not found' }, { status: 400 })
  }

  // Embed the linked person inline so the client doesn't need a follow-up GET /api/people/:id
  const { data, error } = await supabase.from('tasks').update(allowed).eq('id', id).eq('user_id', user.id).select('*, person:people(id,name)').single()
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
