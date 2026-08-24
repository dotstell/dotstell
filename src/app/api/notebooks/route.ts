import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('notebooks')
    .select('id, name, color, icon, sort_order, created_at, updated_at')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, color, icon, sort_order, id } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const payload: Record<string, unknown> = {
    user_id: user.id,
    name: name.trim(),
    color: color ?? null,
    icon: icon ?? '📓',
    sort_order: sort_order ?? 0,
  }
  // Only accept a client-supplied id when the migration flag is present.
  // Without this guard any authenticated user could specify arbitrary UUIDs.
  if (id && body._migrate === true) {
    // Strict UUID v4 format: 8-4-4-4-12 hex groups — rejects loose strings that pass the old [a-f0-9-]{36} check
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    payload.id = id
  }

  const { data, error } = await supabase
    .from('notebooks')
    .insert(payload)
    .select()
    .single()

  if (error) {
    // Postgres unique violation (user_id, name) — surface as 409 so the client can show a clear message
    if (error.code === '23505') return NextResponse.json({ error: 'A notebook with this name already exists.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
