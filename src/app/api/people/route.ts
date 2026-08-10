import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')

  let query = supabase.from('people').select('*').eq('user_id', user.id).order('name')
  if (q) query = query.ilike('name', `%${q}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase.from('people').insert({
    user_id:    user.id,
    name:       body.name,
    role:       body.role,
    company:    body.company,
    email:      body.email,
    phone:      body.phone,
    tags:       body.tags,
    notes:      body.notes,
    avatar_url: body.avatar_url,
  }).select().single()
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
