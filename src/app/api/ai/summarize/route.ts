import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'
import { complete, validateConfig } from '@/lib/ai/client'
import { AIConfig, AIMessage } from '@/lib/ai/types'

// POST /api/ai/summarize
// Body: { config, entityType, entityId } | { config, text, title? }
// Returns: { summary: string }
// Supports note, bookmark, notebook (all notes in notebook), and raw text input.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-summarize:${user.id}`, 30, 60_000)
  if (rl) return rl

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }

  const configError = validateConfig(body.config)
  if (configError) return NextResponse.json({ error: configError }, { status: 400 })

  const mode = body.mode ?? 'bullets'

  const modeInstruction: Record<string, string> = {
    short:    'Provide a 1–2 sentence summary. No preamble.',
    bullets:  'Provide a summary as 3–5 bullet points. Start each bullet with "- " (hyphen space). Use **bold** for key terms. End with a single "> " blockquote line for the most important takeaway. No preamble or closing remarks.',
    detailed: 'Provide a detailed summary using: ## headings for sections, - bullet points for lists, **bold** for key terms, and "> " blockquote for the single most important insight.',
  }

  try {
    let content = ''
    let title   = body.title ?? ''

    if (body.text) {
      content = body.text.slice(0, 12_000)
    } else if (body.entityType === 'note' && body.entityId) {
      const { data: note } = await supabase
        .from('notes')
        .select('title, content')
        .eq('id', body.entityId)
        .eq('user_id', user.id)
        .single()
      if (!note) return NextResponse.json({ error: 'Note not found' }, { status: 404 })
      title   = note.title
      content = note.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 12_000)
    } else if (body.entityType === 'bookmark' && body.entityId) {
      const { data: bm } = await supabase
        .from('bookmarks')
        .select('title, description, url')
        .eq('id', body.entityId)
        .eq('user_id', user.id)
        .single()
      if (!bm) return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 })
      title   = bm.title
      content = `${bm.title}\nURL: ${bm.url}\n${bm.description ?? ''}`
    } else if (body.entityType === 'notebook' && body.entityId) {
      // Fetch all notes tagged with the notebook's tag
      const { data: nb } = await supabase
        .from('notebooks')
        .select('name')
        .eq('id', body.entityId)
        .eq('user_id', user.id)
        .single()
      if (!nb) return NextResponse.json({ error: 'Notebook not found' }, { status: 404 })
      const nbTag = `nb:${nb.name.toLowerCase().replace(/\s+/g, '-')}`
      const { data: notes } = await supabase
        .from('notes')
        .select('title, content')
        .eq('user_id', user.id)
        .contains('tags', [nbTag])
        .is('deleted_at', null)
        .limit(20)
      if (!notes?.length) return NextResponse.json({ summary: 'No notes in this notebook yet.' })
      title   = `Notebook: ${nb.name}`
      content = notes.map(n =>
        `## ${n.title || 'Untitled'}\n${n.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1000)}`
      ).join('\n\n').slice(0, 14_000)
    } else {
      return NextResponse.json({ error: 'Provide entityType+entityId or text' }, { status: 400 })
    }

    if (!content.trim()) return NextResponse.json({ summary: 'No content to summarize.' })

    const messages: AIMessage[] = [
      {
        role:    'system',
        content: `You are a precise summarizer. ${modeInstruction[mode]} Extract only information present in the input. Always use markdown syntax — never use bullet characters like • or *.`,
      },
      {
        role:    'user',
        content: title ? `Summarize the following (titled "${title}"):\n\n${content}` : `Summarize the following:\n\n${content}`,
      },
    ]

    const summary = await complete(body.config, messages)
    return NextResponse.json({ summary })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Summarization failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
