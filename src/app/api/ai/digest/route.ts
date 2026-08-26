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

  const body: { config: AIConfig; period?: 'day' | 'week' } = await req.json()
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

  const noteList = notes.map(n =>
    `• ${n.title || 'Untitled'} (updated ${new Date(n.updated_at).toLocaleDateString()}): ${
      n.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300)
    }`
  ).join('\n')

  const messages: AIMessage[] = [
    {
      role:    'system',
      content: 'You are a personal knowledge assistant. Create a concise digest of the user\'s recent note activity. Highlight key themes, important topics, and any action items. Use 3–6 bullet points or short paragraphs. Be insightful, not just descriptive.',
    },
    {
      role:    'user',
      content: `Here are the notes I worked on in the last ${period === 'day' ? '24 hours' : 'week'}:\n\n${noteList}`,
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
