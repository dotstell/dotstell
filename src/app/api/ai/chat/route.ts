import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'
import { streamChat, validateServerConfig } from '@/lib/ai/client'
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
  const configError = validateServerConfig(body.config)
  if (configError) return NextResponse.json({ error: configError }, { status: 400 })

  const messages: AIMessage[] = body.messages ?? []

  // Prepend RAG context as a system message when provided (e.g. from semantic search results)
  if (body.context) {
    messages.unshift({
      role:    'system',
      content: `You are a helpful assistant. Use the following context from the user's knowledge base to answer their questions. Only use information from the context when relevant — you can still answer general questions from your own knowledge.\n\nContext:\n${body.context}`,
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
