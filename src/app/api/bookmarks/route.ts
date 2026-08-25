import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')

  let query = supabase.from('bookmarks').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
  if (q) {
    // Escape % and _ so user input can't manipulate PostgREST ilike wildcard patterns
    const safe = q.slice(0, 200).replace(/%/g, '\\%').replace(/_/g, '\\_')
    query = query.or(`title.ilike.%${safe}%,url.ilike.%${safe}%,description.ilike.%${safe}%`)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = rateLimit(`bookmarks-post:${user.id}`, 60, 60_000)
  if (rl) return rl

  const body = await req.json()

  // Validate URL: must be present, a string, and http(s) only (blocks javascript:, data: etc.)
  if (!body.url || typeof body.url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }
  try {
    const parsed = new URL(body.url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error()
  } catch {
    return NextResponse.json({ error: 'Invalid URL — must be http or https' }, { status: 400 })
  }

  const { data, error } = await supabase.from('bookmarks').insert({
    user_id:      user.id,
    title:        body.title,
    url:          body.url,
    description:  body.description,
    favicon_url:  body.favicon_url,
    reading_time: body.reading_time,
    hostname:     body.hostname,
    tags:         body.tags,
  }).select().single()
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
