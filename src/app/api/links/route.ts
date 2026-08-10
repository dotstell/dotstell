import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const source_id = searchParams.get('source_id')
  const target_id = searchParams.get('target_id')

  let query = supabase.from('knowledge_links').select('*').eq('user_id', user.id)
  if (source_id) query = query.eq('source_id', source_id)
  if (target_id) query = query.eq('target_id', target_id)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.source_id || !body.target_id) {
    return NextResponse.json({ error: 'source_id and target_id required' }, { status: 400 })
  }
  const { data, error } = await supabase.from('knowledge_links').upsert({
    user_id:     user.id,
    source_id:   body.source_id,
    source_type: body.source_type,
    target_id:   body.target_id,
    target_type: body.target_type,
    label:       body.label,
  }, { onConflict: 'user_id,source_id,target_id' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.source_id || !body.target_id) {
    return NextResponse.json({ error: 'source_id and target_id required' }, { status: 400 })
  }
  const { error } = await supabase.from('knowledge_links').delete()
    .eq('user_id', user.id)
    .eq('source_id', body.source_id)
    .eq('target_id', body.target_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
