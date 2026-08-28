import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'
import { AIConfig } from '@/lib/ai/types'

// GET /api/ai/related/[noteId]?limit=5
// Body (POST): { config } — needed to provide embedding config for on-demand generation
// Returns semantically related notes using the stored embedding vector.
// If the note has no embedding yet, returns an empty array (client should trigger /api/ai/embed first).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ noteId: string }> },
) {
  const { noteId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-related:${user.id}`, 60, 60_000)
  if (rl) return rl

  let body!: { config: AIConfig; limit?: number }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  const limit = Math.min(body.limit ?? 5, 10)

  // Fetch the source note's embedding
  const { data: note } = await supabase
    .from('notes')
    .select('embedding')
    .eq('id', noteId)
    .eq('user_id', user.id)
    .single()

  if (!note?.embedding) {
    // No embedding yet — caller should POST to /api/ai/embed first
    return NextResponse.json([])
  }

  // Run note and task similarity searches in parallel using the same embedding
  const [notesResult, tasksResult] = await Promise.all([
    supabase.rpc('match_notes', {
      query_embedding: note.embedding,
      user_id_param:   user.id,
      match_count:     limit + 1, // +1 because the source note itself will appear
      match_threshold: 0.4,
    }),
    supabase.rpc('match_tasks', {
      query_embedding: note.embedding,
      user_id_param:   user.id,
      match_count:     limit,
      match_threshold: 0.4,
    }).then(r => r, () => ({ data: null, error: null })), // graceful degradation if migration not yet applied
  ])
  const relatedNotes = notesResult.data
  const relatedTasks = tasksResult.data

  const notes = (relatedNotes ?? [])
    .filter((n: { id: string }) => n.id !== noteId)
    .map((n: { id: string; title: string; similarity: number }) => ({
      id:         n.id,
      title:      n.title || 'Untitled',
      type:       'note' as const,
      similarity: Math.round(n.similarity * 100),
    }))

  const tasks = ((relatedTasks ?? []) as { id: string; title: string; similarity: number }[])
    .map((t) => ({
      id:         t.id,
      title:      t.title || 'Untitled',
      type:       'task' as const,
      similarity: Math.round(t.similarity * 100),
    }))

  const combined = [...notes, ...tasks]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)

  return NextResponse.json(combined)
}
