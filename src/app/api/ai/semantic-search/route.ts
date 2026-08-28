import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'
import { embed, validateConfig } from '@/lib/ai/client'
import { AIConfig } from '@/lib/ai/types'

// POST /api/ai/semantic-search
// Body: { config, query, types?, limit? }
// Embeds the query and finds semantically similar content via pgvector cosine similarity.
// Returns results with a `body` field suitable for injecting as AI Chat RAG context.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-semantic:${user.id}`, 30, 60_000)
  if (rl) return rl

  let _parsed!: Record<string, unknown>
  try { _parsed = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  const { config, query, types, limit } = _parsed

  if (!body.query?.trim()) return NextResponse.json([], { status: 200 })

  const configError = validateConfig(body.config)
  if (configError) return NextResponse.json({ error: configError }, { status: 400 })

  const limit      = Math.min(body.limit ?? 10, 20)
  const validTypes = ['note', 'bookmark', 'task'] as const
  const types      = (body.types ?? [...validTypes]).filter(
    (t): t is typeof validTypes[number] => validTypes.includes(t as typeof validTypes[number])
  )

  try {
    const { embedding } = await embed(body.config, body.query.slice(0, 2000))

    const results: Array<{
      id:      string
      title:   string
      type:    string
      score:   number
      snippet: string  // short excerpt for search UI display
      body:    string  // full context string for AI Chat RAG injection
    }> = []

    if (types.includes('note')) {
      const { data: notes } = await supabase.rpc('match_notes', {
        query_embedding: embedding,
        user_id_param:   user.id,
        match_count:     limit,
        match_threshold: 0.3,
      })
      if (notes) {
        results.push(...notes.map((n: { id: string; title: string; content: string; similarity: number }) => {
          const plain = n.content?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() ?? ''
          return {
            id:      n.id,
            title:   n.title || 'Untitled',
            type:    'note',
            score:   n.similarity,
            snippet: plain.slice(0, 120),
            body:    plain.slice(0, 800),
          }
        }))
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
        results.push(...bms.map((b: { id: string; title: string; description: string; url: string; similarity: number }) => ({
          id:      b.id,
          title:   b.title,
          type:    'bookmark',
          score:   b.similarity,
          snippet: b.description?.slice(0, 120) ?? '',
          body:    b.description?.slice(0, 800) ?? b.url ?? '',
        })))
      }
    }

    if (types.includes('task')) {
      const { data: tasks } = await supabase.rpc('match_tasks', {
        query_embedding: embedding,
        user_id_param:   user.id,
        match_count:     limit,
        match_threshold: 0.3,
      })
      if (tasks) {
        results.push(...tasks.map((t: {
          id:          string
          title:       string
          description: string | null
          status:      string
          priority:    string
          due_date:    string | null
          tags:        string[] | null
          similarity:  number
        }) => {
          const meta = [`Status: ${t.status}`, `Priority: ${t.priority}`]
          if (t.due_date) meta.push(`Due: ${t.due_date.split('T')[0]}`)
          if (t.tags?.length) meta.push(t.tags.join(', '))
          const metaLine = meta.join(' · ')
          return {
            id:      t.id,
            title:   t.title,
            type:    'task',
            score:   t.similarity,
            snippet: metaLine,
            body:    [t.description?.trim(), metaLine].filter(Boolean).join('\n'),
          }
        }))
      }
    }

    // Sort by similarity score descending, return top N
    results.sort((a, b) => b.score - a.score)
    return NextResponse.json(results.slice(0, limit))
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Semantic search failed'
    if (msg.includes('match_notes') || msg.includes('match_bookmarks') || msg.includes('match_tasks')) {
      return NextResponse.json(
        { error: 'Semantic search requires running the AI embeddings migrations. See supabase/migrations/008_ai_embeddings.sql, 009_ai_match_functions.sql, and 010_tasks_embedding.sql.' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
