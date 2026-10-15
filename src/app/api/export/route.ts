import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'

// Explicit column lists: `select('*')` would also ship the 768-float embedding vectors, which
// are large, useless outside dotstell, and would blow past the response size limit.
const COLUMNS = {
  notes:     'id, title, content, type, checklist_items, tags, person_id, parent_id, sort_order, pinned, color, created_at, updated_at',
  people:    'id, name, role, company, email, phone, avatar_url, tags, last_interaction, created_at, updated_at',
  tasks:     'id, title, description, status, priority, due_date, person_id, tags, created_at, updated_at',
  bookmarks: 'id, title, url, description, favicon_url, tags, reading_time, hostname, last_visited_at, visit_count, created_at, updated_at',
  notebooks: 'id, name, color, icon, sort_order, created_at',
  links:     'id, source_id, source_type, target_id, target_type, label, created_at',
} as const

type Entity = keyof typeof COLUMNS

const MAX_PAGE = 100

// GET /api/export?entity=notes&offset=0&limit=50
// Returns one page of the signed-in user's data: { rows, hasMore }.
//
// Paged on purpose. The list endpoints return everything in one response, but Supabase caps a
// query at 1000 rows and the hosting platform caps a response body at a few MB, so a single
// "give me everything" call would silently drop notes for a large account. The client walks
// the pages and assembles the archive itself.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`export:${user.id}`, 600, 60_000)
  if (rl) return rl

  const { searchParams } = new URL(req.url)
  const entity = searchParams.get('entity') as Entity | null
  if (!entity || !(entity in COLUMNS)) {
    return NextResponse.json({ error: 'Unknown entity' }, { status: 400 })
  }

  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10) || 0)
  const limit  = Math.min(MAX_PAGE, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10) || 50))

  // The column list is chosen at runtime, which the generated query types cannot follow.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  let query = db
    .from(entity === 'links' ? 'knowledge_links' : entity)
    .select(COLUMNS[entity])
    .eq('user_id', user.id)

  // The trash is deliberately not part of an export.
  if (entity === 'notes') query = query.is('deleted_at', null)

  // A unique, stable sort key: offset paging over a non-unique order can repeat or skip rows
  // when two rows share a timestamp.
  const { data, error } = await query
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })

  const rows = data ?? []
  return NextResponse.json({ rows, hasMore: rows.length === limit })
}
