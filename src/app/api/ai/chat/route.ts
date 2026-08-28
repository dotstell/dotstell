import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'
import { streamChat, validateConfig } from '@/lib/ai/client'
import { AIConfig, AIMessage } from '@/lib/ai/types'

// POST /api/ai/chat
// Body: { config, messages, context? }
// Returns: text/event-stream (SSE) — normalised delta chunks
// context is optional injected RAG context prepended as a system message
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-chat:${user.id}`, 60, 60_000)
  if (rl) return rl

  const body: { config: AIConfig; messages: AIMessage[]; context?: string } = await req.json()
  const configError = validateConfig(body.config)
  if (configError) return NextResponse.json({ error: configError }, { status: 400 })

  const messages: AIMessage[] = body.messages ?? []

  if (body.context) {
    // Wrap user-supplied context in XML tags to prevent injected content from overriding instructions.
    messages.unshift({
      role:    'system',
      content: `You are a helpful personal assistant with access to the user's knowledge base.\n\nFormatting rules:\n- Use markdown: **bold** for labels, numbered or bullet lists for multiple items\n- For tasks: show title in bold, then Status, Priority, Due Date as sub-bullets\n- Write field values in title case (e.g. "In Progress" not "in_progress", "High" not "high")\n- Be concise and structured\n\nCite specific notes, bookmarks, or tasks by name when relevant. You may also answer from your own knowledge when the context is not relevant.\n\n<context>\n${body.context}\n</context>`,
    })
  } else {
    messages.unshift({
      role:    'system',
      content: 'You are a helpful personal assistant. Answer clearly and concisely. Use markdown formatting where appropriate.',
    })
  }

  try {
    const stream = await streamChat(body.config, messages)
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
