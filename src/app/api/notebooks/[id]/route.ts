import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const allowed: Record<string, unknown> = {}
  if (body.name !== undefined) {
    if (typeof body.name !== 'string') return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
    const trimmed = body.name.trim()
    if (!trimmed) return NextResponse.json({ error: 'Name required' }, { status: 400 })
    allowed.name = trimmed
  }
  if (body.color !== undefined) allowed.color = body.color
  if (body.icon !== undefined) allowed.icon = body.icon
  if (body.sort_order !== undefined) allowed.sort_order = body.sort_order
  allowed.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('notebooks')
    .update(allowed)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('notebooks')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
