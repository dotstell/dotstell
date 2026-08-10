import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')

  let query = supabase.from('tasks').select('*, person:people(id,name)').eq('user_id', user.id).order('due_date', { ascending: true, nullsFirst: false })

  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { data, error } = await supabase.from('tasks').insert({
    user_id:     user.id,
    title:       body.title,
    description: body.description,
    status:      body.status,
    priority:    body.priority,
    due_date:    body.due_date,
    tags:        body.tags,
    person_id:   body.person_id,
  }).select('*, person:people(id,name)').single()
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
