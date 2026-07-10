import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = new URL(req.url).searchParams.get('q') ?? ''
  if (!q || q.length < 2) return NextResponse.json([])

  const [notes, people, bookmarks, tasks] = await Promise.all([
    supabase.from('notes').select('id,title,type,updated_at').eq('user_id', user.id).ilike('title', `%${q}%`).limit(5),
    supabase.from('people').select('id,name,role').eq('user_id', user.id).ilike('name', `%${q}%`).limit(5),
    supabase.from('bookmarks').select('id,title,url').eq('user_id', user.id).or(`title.ilike.%${q}%,url.ilike.%${q}%`).limit(5),
    supabase.from('tasks').select('id,title,status,priority').eq('user_id', user.id).ilike('title', `%${q}%`).limit(5),
  ])

  const results = [
    ...(notes.data ?? []).map(n => ({ ...n, _type: 'note', _label: n.title })),
    ...(people.data ?? []).map(p => ({ ...p, _type: 'person', _label: p.name })),
    ...(bookmarks.data ?? []).map(b => ({ ...b, _type: 'bookmark', _label: b.title || b.url })),
    ...(tasks.data ?? []).map(t => ({ ...t, _type: 'task', _label: t.title })),
  ]

  return NextResponse.json(results)
}
