import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')

  let query = supabase.from('people').select('*').eq('user_id', user.id).order('name')
  if (q) {
    // Escape LIKE metacharacters before embedding in ilike pattern
    const safe = q.slice(0, 200).replace(/%/g, '\\%').replace(/_/g, '\\_')
    query = query.ilike('name', `%${safe}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = rateLimit(`people-post:${user.id}`, 30, 60_000)
  if (rl) return rl

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
  }
  if (body.name.length > 200) {
    return NextResponse.json({ error: 'name must be 200 characters or fewer' }, { status: 400 })
  }
  if (body.role && typeof body.role === 'string' && body.role.length > 200) {
    return NextResponse.json({ error: 'role must be 200 characters or fewer' }, { status: 400 })
  }
  if (body.company && typeof body.company === 'string' && body.company.length > 200) {
    return NextResponse.json({ error: 'company must be 200 characters or fewer' }, { status: 400 })
  }
  if (body.email && typeof body.email === 'string' && body.email.length > 254) {
    return NextResponse.json({ error: 'email must be 254 characters or fewer' }, { status: 400 })
  }
  if (body.phone && typeof body.phone === 'string' && body.phone.length > 50) {
    return NextResponse.json({ error: 'phone must be 50 characters or fewer' }, { status: 400 })
  }
  if (body.notes && typeof body.notes === 'string' && body.notes.length > 5000) {
    return NextResponse.json({ error: 'notes must be 5000 characters or fewer' }, { status: 400 })
  }
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags)) return NextResponse.json({ error: 'tags must be an array' }, { status: 400 })
    if (body.tags.length > 20) return NextResponse.json({ error: 'tags array must contain 20 items or fewer' }, { status: 400 })
    if (body.tags.some((t: unknown) => typeof t !== 'string' || t.length > 50)) {
      return NextResponse.json({ error: 'each tag must be a string of 50 characters or fewer' }, { status: 400 })
    }
  }
  // Validate avatar_url scheme: must be http(s) only (blocks javascript:, data: etc.)
  if (body.avatar_url !== undefined && body.avatar_url !== null && body.avatar_url !== '') {
    if (typeof body.avatar_url !== 'string' || body.avatar_url.length > 2000) {
      return NextResponse.json({ error: 'avatar_url must be a string of 2000 characters or fewer' }, { status: 400 })
    }
    try {
      const parsed = new URL(body.avatar_url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error()
    } catch {
      return NextResponse.json({ error: 'Invalid avatar_url — must be http or https' }, { status: 400 })
    }
  }
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
