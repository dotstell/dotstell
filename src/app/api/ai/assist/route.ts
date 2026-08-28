import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'
import { streamChat, complete, validateConfig } from '@/lib/ai/client'
import { AIConfig, AIMessage, AssistOperation, ASSIST_LABELS } from '@/lib/ai/types'

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }

  const configError = validateConfig(body.config)
  if (configError) return NextResponse.json({ error: configError }, { status: 400 })

  if (!body.text?.trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 })
  if (!body.operation || !(body.operation in ASSIST_LABELS)) {
    return NextResponse.json({ error: `Unknown operation: ${body.operation}` }, { status: 400 })
  }

  // Word count of the selected text — used to calibrate expected output length
  const wordCount  = body.text.trim().split(/\s+/).length
  const lengthHint = wordCount <= 20  ? `The selected text is very short (≈${wordCount} words). Keep your output similarly brief.`
                   : wordCount <= 80  ? `The selected text is short (≈${wordCount} words). Match roughly the same length.`
                   : wordCount <= 300 ? `The selected text is medium length (≈${wordCount} words). Stay within a similar range.`
                   : `The selected text is long (≈${wordCount} words). A thorough response is appropriate.`

  const BASE = 'Return ONLY the result — no introduction, no explanation, no "here is the rewritten text:", no extra commentary. Just the content itself.'

  const SYSTEM_PROMPTS: Record<AssistOperation, string> = {
    rewrite:   `You are a writing assistant. Rewrite the text to be clearer and more engaging, preserving the original meaning and tone. ${lengthHint} ${BASE}`,
    expand:    `You are a writing assistant. Expand the text with relevant detail, examples, or context. Do not triple the length — add what genuinely improves it. ${BASE}`,
    shorten:   `You are a writing assistant. Make the text more concise without losing essential meaning. Aim for roughly half the original length. ${BASE}`,
    fix:       `You are a writing assistant. Fix all grammar, spelling, and punctuation errors. Do not rephrase or change the meaning — only correct errors. ${lengthHint} ${BASE}`,
    outline:   `You are a writing assistant. Convert the text into a structured outline using markdown headings and bullet points. ${BASE}`,
    checklist: `You are a writing assistant. Extract every action item, task, or to-do as a markdown checklist (- [ ] item). One item per line. ${BASE}`,
    explain:   `You are a knowledgeable assistant. Explain the selected text clearly and concisely in 2–4 sentences. Use the user's note context when relevant. ${BASE}`,
  }

  const messages: AIMessage[] = [
    { role: 'system', content: SYSTEM_PROMPTS[body.operation as AssistOperation] },
  ]

  if (body.operation === 'explain' && body.noteContext) {
    messages.push({
      role:    'user',
      content: `Context from my notes:\n${body.noteContext.slice(0, 3000)}\n\nExplain this:\n${body.text.slice(0, 2000)}`,
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
