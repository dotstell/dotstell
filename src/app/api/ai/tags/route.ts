import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'
import { complete, validateServerConfig } from '@/lib/ai/client'
import { AIConfig, AIMessage } from '@/lib/ai/types'

/**
 * POST /api/ai/tags
 * Body: { config, content, title?, existingTags? }
 * Returns: { tags: string[] }
 *
 * Suggests 3–6 tags for a note based on its content.
 * Already-applied tags are excluded from suggestions so the model
 * never returns tags the user has already chosen.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-tags:${user.id}`, 30, 60_000)
  if (rl) return rl

  const body: {
    config:        AIConfig
    content:       string
    title?:        string
    existingTags?: string[]
  } = await req.json()

  const configError = validateServerConfig(body.config)
  if (configError) return NextResponse.json({ error: configError }, { status: 400 })

  const plainText = body.content
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 3000)

  if (plainText.length < 20) {
    return NextResponse.json({ error: 'Not enough content to suggest tags' }, { status: 400 })
  }

  const existingLine = body.existingTags?.length
    ? `\nAlready-applied tags (do NOT suggest these): ${body.existingTags.join(', ')}`
    : ''

  const titleLine = body.title
    ? `Title: ${body.title}\n`
    : ''

  const messages: AIMessage[] = [
    {
      role:    'system',
      content: `You are a tagging assistant. Given note content, suggest 3–6 relevant tags.
Rules:
- Tags are lowercase, kebab-case (e.g. "machine-learning", "product-design", "meeting-notes")
- Be specific: "react-hooks" beats "programming"; "q3-planning" beats "work"
- Return ONLY a JSON array of strings, no explanation: ["tag-one", "tag-two", "tag-three"]${existingLine}`,
    },
    {
      role:    'user',
      content: `${titleLine}${plainText}`,
    },
  ]

  try {
    const raw = await complete(body.config, messages)
    // Parse the JSON array — strip any markdown fences the model might wrap it in
    const cleaned = raw.replace(/```[a-z]*\n?/g, '').trim()
    const parsed  = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) throw new Error('Model did not return an array')
    const tags = parsed
      .filter((t): t is string => typeof t === 'string')
      .map(t => t.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
      .filter(t => t.length > 0 && t.length < 40)
      // Exclude already-applied tags from the response
      .filter(t => !body.existingTags?.includes(t))
    return NextResponse.json({ tags })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Tag generation failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
