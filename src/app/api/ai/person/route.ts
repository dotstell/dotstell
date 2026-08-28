import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'
import { complete, validateConfig } from '@/lib/ai/client'
import { AIConfig, AIMessage } from '@/lib/ai/types'

/**
 * POST /api/ai/person
 * Body: { config, name }
 * Returns: { summary, sources: Array<{ id, title, type, updatedAt }> }
 *
 * Aggregates everything the user has written about a named person — across
 * notes and bookmarks — and produces a structured intelligence summary.
 * Uses a case-insensitive full-text search (ilike) rather than embeddings
 * so it works even when notes aren't indexed.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-person:${user.id}`, 20, 60_000)
  if (rl) return rl

  let body!: { config: AIConfig; name: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  const configError = validateConfig(body.config)
  if (configError) return NextResponse.json({ error: configError }, { status: 400 })

  const name = body.name?.trim()
  if (!name || name.length < 2) {
    return NextResponse.json({ error: 'Person name is required' }, { status: 400 })
  }

  // Search notes and bookmarks for mentions of the person
  const pattern = `%${name}%`
  const [notesRes, bookmarksRes] = await Promise.all([
    supabase
      .from('notes')
      .select('id, title, content, updated_at')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .or(`title.ilike.${pattern},content.ilike.${pattern}`)
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase
      .from('bookmarks')
      .select('id, title, description, url, updated_at')
      .eq('user_id', user.id)
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .order('updated_at', { ascending: false })
      .limit(10),
  ])

  const notes     = notesRes.data     ?? []
  const bookmarks = bookmarksRes.data ?? []

  if (notes.length === 0 && bookmarks.length === 0) {
    return NextResponse.json({
      summary: `No notes or bookmarks found that mention "${name}".`,
      sources: [],
    })
  }

  // Extract the most relevant passages — limit each source to 600 chars to stay within context
  const sources = [
    ...notes.map(n => ({
      id:        n.id,
      title:     n.title || 'Untitled',
      type:      'note' as const,
      updatedAt: n.updated_at,
      // Strip HTML for model input; keep enough context without the full note
      snippet: n.content
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 600),
    })),
    ...bookmarks.map(b => ({
      id:        b.id,
      title:     b.title || b.url,
      type:      'bookmark' as const,
      updatedAt: b.updated_at,
      snippet:   (b.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 400),
    })),
  ]

  const context = sources
    .map(s => `[${s.type.toUpperCase()} — ${s.title}]\n${s.snippet}`)
    .join('\n\n---\n\n')

  const messages: AIMessage[] = [
    {
      role:    'system',
      content: `You are a personal intelligence assistant. The user has notes and bookmarks about "${name}".
Produce a structured summary covering:
1. Who they are (role, company, relationship to the user — infer from context)
2. Key facts, decisions, or interactions
3. Open items or follow-ups if any
4. Overall relationship or status summary

Be concise (150–250 words). Use short paragraphs, not bullet walls. Write in second person ("You met…", "They mentioned…").
If the sources are thin, say so honestly rather than padding.`,
    },
    {
      role:    'user',
      content: `Everything I have about "${name}":\n\n${context}`,
    },
  ]

  try {
    const summary = await complete(body.config, messages)
    return NextResponse.json({
      summary,
      sources: sources.map(({ id, title, type, updatedAt }) => ({ id, title, type, updatedAt })),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Person summary failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
