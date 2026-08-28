import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'
import { complete, validateConfig } from '@/lib/ai/client'
import { AIConfig, AIMessage } from '@/lib/ai/types'

/**
 * POST /api/ai/title
 * Body: { config, content, hint? }
 * Returns: { title: string }
 *
 * Generates a concise, descriptive title from note content.
 * `hint` is an optional partial title the user started typing — the model
 * uses it as a direction rather than overwriting it.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-title:${user.id}`, 30, 60_000)
  if (rl) return rl

  let body!: { config: AIConfig; content: string; hint?: string }
  try { body: { config: AIConfig; content: string; hint?: string } = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  const configError = validateConfig(body.config)
  if (configError) return NextResponse.json({ error: configError }, { status: 400 })

  // Strip HTML tags and collapse whitespace for clean model input
  const plainText = body.content
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 2000)  // cap at 2k chars — title models don't need the full note

  if (plainText.length < 10) {
    return NextResponse.json({ error: 'Not enough content to suggest a title' }, { status: 400 })
  }

  const hintLine = body.hint
    ? `\nThe user has started typing: "${body.hint}" — complete or improve it in the same direction.`
    : ''

  const messages: AIMessage[] = [
    {
      role:    'system',
      content: `You are a title generator. Given note content, produce ONE concise, specific title (3–8 words).
Rules:
- No quotes, no punctuation at the end, no "Note about" or "Notes on" prefix
- Capture the most specific and useful aspect, not just the topic category
- If the note is a meeting or decision, lead with the outcome or decision
- Return ONLY the title — nothing else${hintLine}`,
    },
    {
      role:    'user',
      content: plainText,
    },
  ]

  try {
    const title = await complete(body.config, messages)
    // Strip any quotes the model might wrap around the title
    const clean = title.replace(/^["']|["']$/g, '').trim()
    return NextResponse.json({ title: clean })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Title generation failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
