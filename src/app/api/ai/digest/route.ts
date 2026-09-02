import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'
import { complete, validateConfig } from '@/lib/ai/client'
import { AIConfig, AIMessage } from '@/lib/ai/types'

// POST /api/ai/digest
// Body: { config, period: 'day' | 'week' }
// Returns: { digest: string } — an AI-generated summary of recent note activity
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-digest:${user.id}`, 10, 60_000)
  if (rl) return rl

  let body!: { config: AIConfig; period?: 'day' | 'week' }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  const configError = validateConfig(body.config)
  if (configError) return NextResponse.json({ error: configError }, { status: 400 })

  const period = body.period ?? 'week'
  const since  = new Date()
  if (period === 'day')  since.setDate(since.getDate() - 1)
  else                   since.setDate(since.getDate() - 7)

  const { data: notes } = await supabase
    .from('notes')
    .select('title, content, updated_at, tags')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .gte('updated_at', since.toISOString())
    .order('updated_at', { ascending: false })
    .limit(30)

  if (!notes?.length) {
    return NextResponse.json({ digest: `No notes were updated in the last ${period === 'day' ? '24 hours' : '7 days'}.` })
  }

  const { data: openTasks } = await supabase
    .from('tasks')
    .select('title, status, priority, due_date')
    .eq('user_id', user.id)
    .neq('status', 'done')
    .order('due_date', { ascending: true, nullsFirst: false })
    .limit(10)

  const { data: recentBookmarks } = await supabase
    .from('bookmarks')
    .select('title, url, tags')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const { count: untaggedCount } = await supabase
    .from('notes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .eq('tags', '{}')

  const now = new Date()
  const overdueTasks = (openTasks ?? []).filter(t => t.due_date && new Date(t.due_date) < now)
  const inProgressTasks = (openTasks ?? []).filter(t => t.status === 'in_progress')

  const noteList = notes.map(n =>
    `• ${n.title || 'Untitled'} (updated ${new Date(n.updated_at).toLocaleDateString()}): ${
      n.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300)
    }`
  ).join('\n')

  const taskSection = overdueTasks.length > 0
    ? `\n\nOverdue tasks (${overdueTasks.length}): ${overdueTasks.map(t => `"${t.title}" (${t.priority}, was due ${new Date(t.due_date!).toLocaleDateString()})`).join(', ')}`
    : inProgressTasks.length > 0
    ? `\n\nIn-progress tasks: ${inProgressTasks.map(t => `"${t.title}"`).join(', ')}`
    : ''
  const bookmarkSection = (recentBookmarks ?? []).length > 0
    ? `\n\nRecently saved bookmarks: ${(recentBookmarks ?? []).map(b => b.title || b.url).join(' | ')}`
    : ''
  const organizeNote = (untaggedCount ?? 0) > 0 ? `\n\n${untaggedCount} notes need organizing (no tags yet).` : ''

  const messages: AIMessage[] = [
    {
      role:    'system',
      content: `You are a personal knowledge assistant. Generate a morning briefing that covers the user's notes, tasks, and bookmarks as a structured daily digest.

FORMAT — follow exactly:
- Start directly with the content. No preamble like "Here is your digest".
- Use 3–6 bullet points. Each bullet: "**Topic name:** one sentence insight."
- After the bullets, add a "### Key Action Items" section with 2–4 numbered items.
- No closing remarks, sign-offs, or meta commentary.
- Use markdown bold (**text**) only for topic names at the start of each bullet.`,
    },
    {
      role:    'user',
      content: `Here are the notes I worked on in the last ${period === 'day' ? '24 hours' : 'week'}:\n\n${noteList}${taskSection}${bookmarkSection}${organizeNote}`,
    },
  ]

  try {
    const digest = await complete(body.config, messages)
    return NextResponse.json({ digest, noteCount: notes.length, period })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Digest generation failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
