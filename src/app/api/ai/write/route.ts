import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'
import { complete, validateConfig } from '@/lib/ai/client'
import { buildWriteMessages } from '@/lib/ai/write-prompts'
import { errorStatus } from '@/lib/ai/error'

// Provider calls allow up to 30s (see lib/ai/providers/*), but Vercel's default function
// limit is well under that -- the platform kills the invocation first and returns a raw
// non-JSON 502/504 that no error handling in this file can catch or explain. Raising the
// ceiling above the provider timeout means a slow model surfaces as our own readable
// "timed out" error instead of a bare gateway error.
export const maxDuration = 60

// POST /api/ai/write
// Body: { config, mode, format?, intent?, title?, content? }
// Returns: { result: string } — markdown
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-write:${user.id}`, 20, 60_000)
  if (rl) return rl

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }

  const configError = validateConfig(body.config)
  if (configError) return NextResponse.json({ error: configError }, { status: 400 })

  const built = buildWriteMessages(body)
  if ('error' in built) return NextResponse.json({ error: built.error }, { status: 400 })
  const { messages } = built

  try {
    const result = await complete(body.config, messages)
    return NextResponse.json({ result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Writing failed'
    return NextResponse.json({ error: msg }, { status: errorStatus(err) })
  }
}
