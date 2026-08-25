import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const q = new URL(req.url).searchParams.get('q') ?? ''
  // Minimum 2 characters prevents unbounded full-table ilike scans on every keystroke
  if (!q || q.length < 2) return NextResponse.json([])
  if (q.length > 200) return NextResponse.json([])

  // Escape % and _ so user input can't manipulate PostgREST filter patterns
  const safe = q.replace(/%/g, '\\%').replace(/_/g, '\\_')

  const [notes, people, bookmarks, tasks] = await Promise.all([
    supabase.from('notes').select('id,title,type,updated_at').eq('user_id', user.id).is('deleted_at', null).ilike('title', `%${safe}%`).limit(5),
    supabase.from('people').select('id,name,role').eq('user_id', user.id).ilike('name', `%${safe}%`).limit(5),
    supabase.from('bookmarks').select('id,title,url,description').eq('user_id', user.id)
      .ilike('title', `%${safe}%`).limit(5),
    supabase.from('tasks').select('id,title,status,priority').eq('user_id', user.id).ilike('title', `%${safe}%`).limit(5),
  ])

  // _type and _label normalise heterogeneous results so the UI doesn't need to
  // know which entity type each result came from to render it uniformly.
  const results = [
    ...(notes.data ?? []).map(n => ({ ...n, _type: 'note', _label: n.title })),
    ...(people.data ?? []).map(p => ({ ...p, _type: 'person', _label: p.name })),
    ...(bookmarks.data ?? []).map(b => ({ ...b, _type: 'bookmark', _label: b.title || b.url })),
    ...(tasks.data ?? []).map(t => ({ ...t, _type: 'task', _label: t.title })),
  ]

  return NextResponse.json(results)
}
