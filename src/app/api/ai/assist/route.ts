import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'
import { streamChat, complete, validateConfig } from '@/lib/ai/client'
import { AIConfig, AIMessage, AssistOperation } from '@/lib/ai/types'

// POST /api/ai/assist
// Body: { config, operation, text, stream?, noteContext? }
// Returns: text/event-stream when stream=true, JSON { result } otherwise
// Inline AI assist — rewrite, expand, shorten, fix, outline, checklist, explain
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-assist:${user.id}`, 60, 60_000)
  if (rl) return rl

  const body: {
    config:       AIConfig
    operation:    AssistOperation
    text:         string
    stream?:      boolean
    noteContext?: string  // surrounding note content for 'explain' operations
  } = await req.json()

  const configError = validateConfig(body.config)
  if (configError) return NextResponse.json({ error: configError }, { status: 400 })

  if (!body.text?.trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 })

  const SYSTEM_PROMPTS: Record<AssistOperation, string> = {
    rewrite:   'You are a writing assistant. Rewrite the given text to be clearer and more engaging while preserving the original meaning. Return only the rewritten text, no preamble.',
    expand:    'You are a writing assistant. Expand the given text with more detail, examples, and context. Return only the expanded text.',
    shorten:   'You are a writing assistant. Make the given text more concise without losing essential meaning. Return only the shortened text.',
    fix:       'You are a writing assistant. Fix all grammar, spelling, and punctuation errors in the given text. Return only the corrected text.',
    outline:   'You are a writing assistant. Convert the given text into a well-structured outline using headings and bullet points. Return only the outline in markdown format.',
    checklist: 'You are a writing assistant. Extract all action items, tasks, and to-dos from the given text as a markdown checklist (- [ ] item). Return only the checklist.',
    explain:   'You are a knowledgeable assistant. Explain the selected text clearly and concisely. Use the provided context from the user\'s notes when relevant.',
  }

  const messages: AIMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS[body.operation] },
  ]

  // For 'explain', prepend the surrounding note context
  if (body.operation === 'explain' && body.noteContext) {
    messages.push({
      role:    'user',
      content: `Context from my notes:\n${body.noteContext.slice(0, 3000)}\n\nPlease explain this selected text:\n${body.text.slice(0, 2000)}`,
    })
  } else {
    messages.push({ role: 'user', content: body.text.slice(0, 6000) })
  }

  try {
    if (body.stream) {
      const stream = await streamChat(body.config, messages)
      return new Response(stream, {
        headers: {
          'Content-Type':  'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection':    'keep-alive',
        },
      })
    }
    const result = await complete(body.config, messages)
    return NextResponse.json({ result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'AI assist failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
