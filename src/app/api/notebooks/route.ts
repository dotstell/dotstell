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

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  const { name, color, icon, sort_order } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const payload: Record<string, unknown> = {
    user_id: user.id,
    name: name.trim(),
    color: color ?? null,
    icon: icon ?? '📓',
    sort_order: sort_order ?? 0,
  }

  const { data, error } = await supabase
    .from('notebooks')
    .insert(payload)
    .select()
    .single()

  if (error) {
    // Postgres unique violation (user_id, name) — surface as 409 so the client can show a clear message
    if (error.code === '23505') return NextResponse.json({ error: 'A notebook with this name already exists.' }, { status: 409 })
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
