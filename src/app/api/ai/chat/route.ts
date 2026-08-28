import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'
import { streamChat, validateConfig } from '@/lib/ai/client'
import { AIConfig, AIMessage } from '@/lib/ai/types'

/**
 * POST /api/ai/chat
 * Body: `{ config: AIConfig, messages: AIMessage[], context?: string }`
 * Returns a `text/event-stream` of normalised delta chunks `{ delta?, done?, error? }`.
 * When `context` is provided it is prepended as a system message (wrapped in XML tags
 * to prevent prompt injection from user-generated note/task content).
 */
export async function POST(req: NextRequest): Promise<Response | NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-chat:${user.id}`, 60, 60_000)
  if (rl) return rl

  let body: { config: AIConfig; messages: AIMessage[]; context?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const configError = validateConfig(body.config)
  if (configError) return NextResponse.json({ error: configError }, { status: 400 })

  const messages: AIMessage[] = body.messages ?? []
  if (messages.length > 50) return NextResponse.json({ error: 'Too many messages in history (max 50)' }, { status: 400 })

  // Cap each user-supplied message to prevent oversized payloads
  const cappedMessages = messages.map(m => ({ ...m, content: typeof m.content === 'string' ? m.content.slice(0, 8000) : m.content }))

  if (body.context) {
    // Wrap user-supplied context in XML tags to prevent injected content from overriding instructions.
    // Escape any </context> sequences within the content itself so they can't break out of the tag.
    const safeContext = body.context.replace(/<\/context>/gi, '</ context>')
    cappedMessages.unshift({
      role:    'system',
      content: `You are a helpful personal assistant with access to the user's knowledge base.\n\nFormatting rules:\n- Use markdown: **bold** for labels, numbered or bullet lists for multiple items\n- For tasks: show title in bold, then Status, Priority, Due Date as sub-bullets\n- Write field values in title case (e.g. "In Progress" not "in_progress", "High" not "high")\n- Be concise and structured\n\nCite specific notes, bookmarks, or tasks by name when relevant. You may also answer from your own knowledge when the context is not relevant.\n\n<context>\n${safeContext}\n</context>`,
    })
  } else {
    cappedMessages.unshift({
      role:    'system',
      content: 'You are a helpful personal assistant. Answer clearly and concisely. Use markdown formatting where appropriate.',
    })
  }

  try {
    const stream = await streamChat(body.config, cappedMessages)
    return new Response(stream, {
      headers: {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI request failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
