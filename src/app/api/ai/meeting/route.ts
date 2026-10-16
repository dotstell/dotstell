import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'
import { complete, validateConfig } from '@/lib/ai/client'
import { AIConfig, AIMessage } from '@/lib/ai/types'
import { errorStatus } from '@/lib/ai/error'
import { parseDigest } from '@/lib/meetings/digest'
import { buildChunkMessages, buildCombineMessages } from '@/lib/meetings/prompts'

const MAX_PARTS = 40

/** Asks for a JSON reply, and asks again without JSON mode if the provider or model does not accept it. */
async function completeJson(config: AIConfig, messages: AIMessage[]): Promise<string> {
  try {
    return await complete(config, messages, { json: true, temperature: 0.1 })
  } catch (err) {
    if (errorStatus(err) !== 400) throw err
    return complete(config, messages)
  }
}

// Same reasoning as the other AI routes: let a slow model fail with our own readable error, not a bare gateway one.
export const maxDuration = 60

// POST /api/ai/meeting
// Body: { config, mode: 'chunk', text, index, total, title?, attendees? } | { config, mode: 'combine', parts }
// Returns: { digest }
// A long transcript is processed one chunk per request by the client, so each call stays within the time limit.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-meeting:${user.id}`, 60, 60_000)
  if (rl) return rl

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }

  const configError = validateConfig(body.config)
  if (configError) return NextResponse.json({ error: configError }, { status: 400 })

  let messages: AIMessage[]
  if (body.mode === 'chunk') {
    if (typeof body.text !== 'string' || !body.text.trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 })
    messages = buildChunkMessages(body)
  } else if (body.mode === 'combine') {
    if (!Array.isArray(body.parts) || body.parts.length === 0 || body.parts.length > MAX_PARTS) {
      return NextResponse.json({ error: 'parts must be a list of 1 to 40 results' }, { status: 400 })
    }
    const combine = buildCombineMessages(body.parts)
    if (!combine) return NextResponse.json({ error: 'No usable parts to combine' }, { status: 400 })
    messages = combine
  } else {
    return NextResponse.json({ error: 'mode must be chunk or combine' }, { status: 400 })
  }

  try {
    const reply = await completeJson(body.config, messages)
    const digest = parseDigest(reply)
    if (!digest) {
      return NextResponse.json({ error: 'The model did not return usable notes. Try again, or choose a larger model in AI Settings.' }, { status: 502 })
    }
    return NextResponse.json({ digest })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Meeting summary failed'
    return NextResponse.json({ error: msg }, { status: errorStatus(err) })
  }
}
