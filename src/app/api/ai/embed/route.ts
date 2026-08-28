import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'
import { embed, validateConfig } from '@/lib/ai/client'
import { AIConfig } from '@/lib/ai/types'

// POST /api/ai/embed
// Body: { config, entityType, entityId }
// Generates an embedding for the entity's content and stores it in the DB.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-embed:${user.id}`, 120, 60_000)
  if (rl) return rl

  const body: { config: AIConfig; entityType: 'note' | 'bookmark' | 'task'; entityId: string } = await req.json()
  const configError = validateConfig(body.config)
  if (configError) return NextResponse.json({ error: configError }, { status: 400 })

  if (!body.entityType || !body.entityId) {
    return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 })
  }

  try {
    let text = ''

    if (body.entityType === 'note') {
      const { data: note } = await supabase
        .from('notes')
        .select('title, content')
        .eq('id', body.entityId)
        .eq('user_id', user.id)
        .single()
      if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })
      // Strip HTML tags — embed plain text only (shorter, cheaper, more accurate)
      text = `${note.title}\n${note.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`
    } else if (body.entityType === 'bookmark') {
      const { data: bm } = await supabase
        .from('bookmarks')
        .select('title, description')
        .eq('id', body.entityId)
        .eq('user_id', user.id)
        .single()
      if (!bm) return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 })
      text = `${bm.title}\n${bm.description ?? ''}`
    } else {
      const { data: task } = await supabase
        .from('tasks')
        .select('title, description, status, priority, due_date, tags')
        .eq('id', body.entityId)
        .eq('user_id', user.id)
        .single()
      if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
      text = buildTaskEmbedText(task)
    }

    // Truncate to ~8000 chars — most embedding models cap context around 8192 tokens
    const truncated = text.slice(0, 8000)
    const result    = await embed(body.config, truncated)

    const table = body.entityType === 'note' ? 'notes' : body.entityType === 'bookmark' ? 'bookmarks' : 'tasks'
    const { error } = await supabase
      .from(table)
      .update({ embedding: result.embedding, embedding_model: result.model })
      .eq('id', body.entityId)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: 'Failed to store embedding' }, { status: 500 })
    return NextResponse.json({ ok: true, model: result.model, dimension: result.embedding.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Embedding failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

// PUT /api/ai/embed — bulk embed all un-indexed entities for the user
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-embed-bulk:${user.id}`, 5, 60_000)
  if (rl) return rl

  const body: { config: AIConfig } = await req.json()
  const configError = validateConfig(body.config)
  if (configError) return NextResponse.json({ error: configError }, { status: 400 })

  // Fetch IDs of entities without embeddings (limit 100 per type per bulk run to avoid timeout)
  const [
    { data: notes },     { data: bookmarks },     { data: tasks },
    { count: totalNotes }, { count: totalBookmarks }, { count: totalTasks },
  ] = await Promise.all([
    supabase.from('notes').select('id').eq('user_id', user.id).is('embedding', null).is('deleted_at', null).limit(100),
    supabase.from('bookmarks').select('id').eq('user_id', user.id).is('embedding', null).limit(100),
    supabase.from('tasks').select('id').eq('user_id', user.id).is('embedding', null).limit(100),
    supabase.from('notes').select('*', { count: 'exact', head: true }).eq('user_id', user.id).is('deleted_at', null),
    supabase.from('bookmarks').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
  ])

  const noteIds     = (notes     ?? []).map(n => n.id)
  const bookmarkIds = (bookmarks ?? []).map(b => b.id)
  const taskIds     = (tasks     ?? []).map(t => t.id)
  const grandTotal  = (totalNotes ?? 0) + (totalBookmarks ?? 0) + (totalTasks ?? 0)

  // Embed sequentially to avoid rate-limit bursts on the upstream provider
  let succeeded  = 0
  let failed     = 0
  let firstError = ''

  for (const id of noteIds) {
    try {
      await embedEntity(supabase, body.config, 'note', id, user.id)
      succeeded++
    } catch (e) {
      failed++
      if (!firstError) firstError = e instanceof Error ? e.message : String(e)
    }
  }
  for (const id of bookmarkIds) {
    try {
      await embedEntity(supabase, body.config, 'bookmark', id, user.id)
      succeeded++
    } catch (e) {
      failed++
      if (!firstError) firstError = e instanceof Error ? e.message : String(e)
    }
  }
  for (const id of taskIds) {
    try {
      await embedEntity(supabase, body.config, 'task', id, user.id)
      succeeded++
    } catch (e) {
      failed++
      if (!firstError) firstError = e instanceof Error ? e.message : String(e)
    }
  }

  return NextResponse.json({
    succeeded,
    failed,
    total:      noteIds.length + bookmarkIds.length + taskIds.length,
    grandTotal,
    firstError: firstError || undefined,
  })
}

// Shared helper used by both the single-entity and bulk endpoints
async function embedEntity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  config: AIConfig,
  type: 'note' | 'bookmark' | 'task',
  id: string,
  userId: string,
) {
  let text  = ''
  let table = ''

  if (type === 'note') {
    const { data } = await supabase.from('notes').select('title, content').eq('id', id).eq('user_id', userId).single()
    if (!data) throw new Error('not found')
    text  = `${data.title}\n${data.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`.slice(0, 8000)
    table = 'notes'
  } else if (type === 'bookmark') {
    const { data } = await supabase.from('bookmarks').select('title, description').eq('id', id).eq('user_id', userId).single()
    if (!data) throw new Error('not found')
    text  = `${data.title}\n${data.description ?? ''}`.slice(0, 8000)
    table = 'bookmarks'
  } else {
    const { data } = await supabase.from('tasks').select('title, description, status, priority, due_date, tags').eq('id', id).eq('user_id', userId).single()
    if (!data) throw new Error('not found')
    text  = buildTaskEmbedText(data).slice(0, 8000)
    table = 'tasks'
  }

  const result = await embed(config, text)
  const { error: dbError } = await supabase
    .from(table)
    .update({ embedding: result.embedding, embedding_model: result.model })
    .eq('id', id)
    .eq('user_id', userId)
  if (dbError) throw new Error(`DB update failed: ${dbError.message}`)
}

// Build a semantically rich embed string for a task.
// Includes status/priority/due_date so the model can match queries like
// "what's high priority?" or "what's due this week?" via embedding similarity.
function buildTaskEmbedText(task: {
  title:       string
  description: string | null
  status:      string
  priority:    string
  due_date:    string | null
  tags:        string[]
}): string {
  const parts = [task.title]
  if (task.description?.trim()) parts.push(task.description.trim())
  const meta = [`Status: ${task.status}`, `Priority: ${task.priority}`]
  if (task.due_date) meta.push(`Due: ${task.due_date.split('T')[0]}`)
  if (task.tags?.length) meta.push(task.tags.join(', '))
  parts.push(meta.join(' · '))
  return parts.join('\n')
}
