import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')

  // nullsFirst: false — tasks with no due date sink to the bottom; soonest deadline rises to top
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
  const rl = rateLimit(`tasks-post:${user.id}`, 60, 60_000)
  if (rl) return rl

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  if (!body.title || typeof body.title !== 'string') {
    return NextResponse.json({ error: 'Invalid title' }, { status: 400 })
  }
  // Validate before insert — DB has CHECK constraints too, but API validation gives a cleaner 400 error message
  const VALID_STATUS   = ['todo', 'in_progress', 'done', 'cancelled']
  const VALID_PRIORITY = ['low', 'medium', 'high', 'urgent']
  if (body.status   && !VALID_STATUS.includes(body.status))   return NextResponse.json({ error: 'Invalid status' },   { status: 400 })
  if (body.priority && !VALID_PRIORITY.includes(body.priority)) return NextResponse.json({ error: 'Invalid priority' }, { status: 400 })
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
