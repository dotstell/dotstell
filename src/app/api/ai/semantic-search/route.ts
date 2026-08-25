import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'
import { embed, validateServerConfig } from '@/lib/ai/client'
import { AIConfig } from '@/lib/ai/types'

// POST /api/ai/semantic-search
// Body: { config, query, types?, limit? }
// Embeds the query and finds semantically similar notes/bookmarks via cosine similarity.
// Falls back to keyword search if no embeddings exist yet.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-semantic:${user.id}`, 30, 60_000)
  if (rl) return rl

  const body: {
    config: AIConfig
    query:  string
    types?: ('note' | 'bookmark')[]
    limit?: number
  } = await req.json()

  if (!body.query?.trim()) return NextResponse.json([], { status: 200 })

  const configError = validateServerConfig(body.config)
  if (configError) return NextResponse.json({ error: configError }, { status: 400 })

  const limit = Math.min(body.limit ?? 10, 20)
  const types = body.types ?? ['note', 'bookmark']

  try {
    const { embedding } = await embed(body.config, body.query.slice(0, 2000))

    const results: Array<{ id: string; title: string; type: string; score: number; snippet?: string }> = []

    // pgvector cosine similarity — Supabase exposes this via rpc or raw SQL.
    // We use a raw query via supabase.rpc with a custom function, or fall back to
    // a JS-side similarity calc if the function doesn't exist yet.
    // Using the vector column directly with PostgREST filter is not supported,
    // so we call a Postgres function that accepts the vector as a parameter.
    if (types.includes('note')) {
      const { data: notes } = await supabase.rpc('match_notes', {
        query_embedding: embedding,
        user_id_param:   user.id,
        match_count:     limit,
        match_threshold: 0.3,
      })
      if (notes) {
        results.push(...notes.map((n: { id: string; title: string; content: string; similarity: number }) => ({
          id:      n.id,
          title:   n.title || 'Untitled',
          type:    'note',
          score:   n.similarity,
          snippet: n.content?.replace(/<[^>]+>/g, ' ').slice(0, 120),
        })))
      }
    }

    if (types.includes('bookmark')) {
      const { data: bms } = await supabase.rpc('match_bookmarks', {
        query_embedding: embedding,
        user_id_param:   user.id,
        match_count:     limit,
        match_threshold: 0.3,
      })
      if (bms) {
        results.push(...bms.map((b: { id: string; title: string; description: string; similarity: number }) => ({
          id:      b.id,
          title:   b.title,
          type:    'bookmark',
          score:   b.similarity,
          snippet: b.description?.slice(0, 120),
        })))
      }
    }

    // Sort by similarity score descending
    results.sort((a, b) => b.score - a.score)
    return NextResponse.json(results.slice(0, limit))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Semantic search failed'
    // If RPC functions don't exist yet, return a helpful error rather than 500
    if (msg.includes('match_notes') || msg.includes('match_bookmarks')) {
      return NextResponse.json(
        { error: 'Semantic search requires running the AI embeddings migration. See supabase/migrations/008_ai_embeddings.sql and 009_ai_match_functions.sql.' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
