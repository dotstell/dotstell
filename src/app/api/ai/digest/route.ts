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

  try {
    const [{ data: notes }, { data: openTasks }, { data: recentBookmarks }] = await Promise.all([
      supabase
        .from('notes')
        .select('title, content, updated_at, tags')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .gte('updated_at', since.toISOString())
        .order('updated_at', { ascending: false })
        .limit(30),
      supabase
        .from('tasks')
        .select('title, status, priority, due_date')
        .eq('user_id', user.id)
        .neq('status', 'done')
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(10),
      supabase
        .from('bookmarks')
        .select('title, url, tags')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const hasContent = (notes?.length ?? 0) > 0 || (openTasks?.length ?? 0) > 0 || (recentBookmarks?.length ?? 0) > 0
    if (!hasContent) {
      return NextResponse.json({ empty: true, period })
    }

    const { count: untaggedCount } = await supabase
      .from('notes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .eq('tags', '{}')

    const now = new Date()
    const overdueTasks = (openTasks ?? []).filter(t => t.due_date && new Date(t.due_date) < now)
    const inProgressTasks = (openTasks ?? []).filter(t => t.status === 'in_progress')

    const noteList = (notes ?? []).map(n =>
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
        content: `You are a personal knowledge assistant. Generate an AI digest from the user's notes, tasks, and bookmarks.

FORMAT — replace the labels with real subjects from the data:
**Project Alpha:** Three new risk metrics added this week covering deployment scope.
**Team Sync:** Strategy doc needs completion before Thursday's meeting.
**Research:** Background reading saved as bookmarks, no notes written yet.
[scale with the data: 1 line for a quiet day, as many as needed for a busy one]

Key Action Items
1. Concrete action derived from the data.
2. Another concrete action.
[real next steps only — include as few as 1 or as many as needed]

RULES:
- Replace the **bold label** with the actual subject from the data — never write "Topic" as the label.
- One line per distinct topic. Group closely related notes into one line.
- The "Key Action Items" section must always appear.
- No intro sentence, no closing remarks.`,
      },
      {
        role:    'user',
        content: `Here are the notes I worked on in the last ${period === 'day' ? '24 hours' : 'week'}:\n\n${noteList}${taskSection}${bookmarkSection}${organizeNote}`,
      },
    ]

    const digest = await complete(body.config, messages)
    return NextResponse.json({ digest, noteCount: notes?.length ?? 0, period })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Digest generation failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
