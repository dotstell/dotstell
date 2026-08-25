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

  const body: { config: AIConfig; limit?: number } = await req.json()
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

  // Use pgvector cosine similarity to find the most similar notes, excluding itself
  const { data: related } = await supabase.rpc('match_notes', {
    query_embedding: note.embedding,
    user_id_param:   user.id,
    match_count:     limit + 1, // +1 because the source note itself will appear
    match_threshold: 0.4,       // higher threshold for "related" than "search" (0.3)
  })

  if (!related) return NextResponse.json([])

  // Filter out the source note and cap at requested limit
  const filtered = related
    .filter((n: { id: string }) => n.id !== noteId)
    .slice(0, limit)
    .map((n: { id: string; title: string; similarity: number }) => ({
      id:         n.id,
      title:      n.title || 'Untitled',
      similarity: Math.round(n.similarity * 100),
    }))

  return NextResponse.json(filtered)
}
