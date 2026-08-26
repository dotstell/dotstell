import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'
import { embed, validateConfig } from '@/lib/ai/client'
import { AIConfig } from '@/lib/ai/types'

// POST /api/ai/embed
// Body: { config, entityType, entityId }
// Generates an embedding for the entity's content and stores it in the DB.
// Called after a note/bookmark is saved and whenever the user manually triggers re-indexing.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-embed:${user.id}`, 120, 60_000)
  if (rl) return rl

  const body: { config: AIConfig; entityType: 'note' | 'bookmark'; entityId: string } = await req.json()
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
    } else {
      const { data: bm } = await supabase
        .from('bookmarks')
        .select('title, description')
        .eq('id', body.entityId)
        .eq('user_id', user.id)
        .single()
      if (!bm) return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 })
      text = `${bm.title}\n${bm.description ?? ''}`
    }

    // Truncate to ~8000 chars — most embedding models cap context around 8192 tokens
    const truncated = text.slice(0, 8000)
    const result    = await embed(body.config, truncated)

    const updateData = {
      embedding:       result.embedding,
      embedding_model: result.model,
    }

    const table = body.entityType === 'note' ? 'notes' : 'bookmarks'
    const { error } = await supabase
      .from(table)
      .update(updateData)
      .eq('id', body.entityId)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: 'Failed to store embedding' }, { status: 500 })
    return NextResponse.json({ ok: true, model: result.model, dimension: result.embedding.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Embedding failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

// POST /api/ai/embed/bulk — embed all un-indexed entities for the user
// Queues background embedding for notes and bookmarks missing embeddings.
export async function PUT(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-embed-bulk:${user.id}`, 5, 60_000)
  if (rl) return rl

  const body: { config: AIConfig } = await req.json()
  const configError = validateConfig(body.config)
  if (configError) return NextResponse.json({ error: configError }, { status: 400 })

  // Fetch IDs of entities without embeddings (limit 200 per bulk run to avoid timeout)
  const [{ data: notes }, { data: bookmarks }] = await Promise.all([
    supabase.from('notes').select('id').eq('user_id', user.id).is('embedding', null).is('deleted_at', null).limit(100),
    supabase.from('bookmarks').select('id').eq('user_id', user.id).is('embedding', null).limit(100),
  ])

  const noteIds     = (notes     ?? []).map(n => n.id)
  const bookmarkIds = (bookmarks ?? []).map(b => b.id)

  // Embed sequentially to avoid rate-limit bursts on the upstream provider
  let succeeded = 0
  let failed    = 0

  for (const id of noteIds) {
    try {
      await embedEntity(supabase, body.config, 'note', id, user.id)
      succeeded++
    } catch { failed++ }
  }
  for (const id of bookmarkIds) {
    try {
      await embedEntity(supabase, body.config, 'bookmark', id, user.id)
      succeeded++
    } catch { failed++ }
  }

  return NextResponse.json({ succeeded, failed, total: noteIds.length + bookmarkIds.length })
}

// Shared helper used by both the single-entity and bulk endpoints
async function embedEntity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  config: AIConfig,
  type: 'note' | 'bookmark',
  id: string,
  userId: string,
) {
  let text = ''

  if (type === 'note') {
    const { data } = await supabase.from('notes').select('title, content').eq('id', id).eq('user_id', userId).single()
    if (!data) throw new Error('not found')
    text = `${data.title}\n${data.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`.slice(0, 8000)
  } else {
    const { data } = await supabase.from('bookmarks').select('title, description').eq('id', id).eq('user_id', userId).single()
    if (!data) throw new Error('not found')
    text = `${data.title}\n${data.description ?? ''}`.slice(0, 8000)
  }

  const result = await embed(config, text)
  const { error: dbError } = await supabase
    .from(type === 'note' ? 'notes' : 'bookmarks')
    .update({ embedding: result.embedding, embedding_model: result.model })
    .eq('id', id)
    .eq('user_id', userId)
  if (dbError) throw new Error(`DB update failed: ${dbError.message}`)
}
