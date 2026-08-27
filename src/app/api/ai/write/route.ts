import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'
import { complete, validateConfig } from '@/lib/ai/client'
import { AIConfig, AIMessage } from '@/lib/ai/types'

type DraftFormat   = 'outline' | 'meeting' | 'daily' | 'research' | 'ooo' | 'proposal' | 'status' | 'email' | 'custom'
type ImproveFormat = 'improve_english' | 'formal' | 'concise' | 'expand' | 'rewrite'

const DRAFT_PROMPTS: Record<DraftFormat, string> = {
  outline:  'Create a well-structured outline with a main topic heading (# Title), ## section headings, and - bullet points under each. Use **bold** for key concepts.',
  meeting:  'Create a meeting notes template with these sections: ## Agenda, ## Attendees (bullet list with name placeholders), ## Discussion Notes, ## Decisions Made, ## Action Items (numbered list with [Owner] and [Due date] placeholders). Add brief placeholder text under each heading.',
  daily:    "Create a daily log entry with: ## Today's Focus (3 bullets), ## Completed (bullet list), ## Blockers (bullet list), ## Learnings, ## Tomorrow's Priority (3 bullets). Use concise bullet points.",
  research: 'Create a structured research note with: ## Background, ## Key Findings (bullet list with **bold** terms), ## Analysis, ## Open Questions, ## Sources (numbered list). Add brief placeholder text under each heading.',
  ooo:      'Write a professional Out of Office email. Include: Subject line (on its own line starting with "Subject:"), greeting, clearly stated absence date range (use [START DATE] and [END DATE] placeholders), who to contact in the meantime ([COLLEAGUE NAME] and [CONTACT EMAIL] placeholders), and a warm professional closing.',
  proposal: 'Create a project proposal with: ## Overview (2–3 sentence intro), ## Problem Statement, ## Proposed Solution, ## Goals & Success Metrics (bullet list), ## Timeline (bullet list with phases), ## Resources Required, ## Risks & Mitigations. Use headings and bullets throughout.',
  status:   'Create a status report with: ## Summary (1–2 sentences), ## Progress This Week (bullet list with **bold** milestones), ## Key Metrics (bullet list), ## Blockers & Risks, ## Next Steps (numbered). Use concise bullets and **bold** for key results.',
  email:    'Write a professional business email. Include: Subject line (starting with "Subject:"), polite greeting, concise body paragraphs, a clear call to action, and a professional closing. Use [RECIPIENT], [SENDER], and [TOPIC] placeholders.',
  custom:   '',
}

const IMPROVE_PROMPTS: Record<ImproveFormat, string> = {
  improve_english: 'Correct grammar, spelling, and punctuation. Improve sentence flow, clarity, and readability. Preserve all original meaning, structure, and formatting. Return only the corrected content.',
  formal:          'Rewrite in a polished, professional tone suitable for business or academic communication. Eliminate informal language, contractions where formal usage is clearer, and casual phrasing. Preserve all information and heading structure. Return only the rewritten content.',
  concise:         'Make this significantly more concise. Remove filler words, redundancy, repetition, and unnecessary detail while preserving every key point and fact. Tighten every sentence. Return only the condensed content.',
  expand:          'Expand this with supporting detail, concrete examples, and additional context for each key point. Maintain the existing structure and headings. Do not add unrelated topics. Return only the expanded content.',
  rewrite:         'Fully rewrite this for maximum clarity, logical flow, and well-structured organisation. Use proper ## headings, - bullets, and **bold** for key terms. Preserve all information. Return only the rewritten content.',
}

// POST /api/ai/write
// Body: { config, mode, format?, intent?, title?, content? }
// Returns: { result: string } — markdown
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-write:${user.id}`, 20, 60_000)
  if (rl) return rl

  const body: {
    config:    AIConfig
    mode:      'draft' | 'improve'
    format?:   DraftFormat | ImproveFormat
    intent?:   string
    title?:    string
    content?:  string
  } = await req.json()

  const configError = validateConfig(body.config)
  if (configError) return NextResponse.json({ error: configError }, { status: 400 })

  try {
    let messages: AIMessage[]

    if (body.mode === 'draft') {
      const format = (body.format ?? 'custom') as DraftFormat
      const formatInstruction = format === 'custom'
        ? `Write content based on this intent: "${body.intent ?? 'a general note'}". Choose the most fitting structure and format.`
        : DRAFT_PROMPTS[format]

      const titleContext  = body.title  ? ` The note title is: "${body.title}".`         : ''
      const intentContext = body.intent && format !== 'custom'
        ? ` Additional context from the user: "${body.intent}".` : ''

      messages = [
        {
          role:    'system',
          content: `You are a professional writing assistant. ${formatInstruction}${titleContext}${intentContext}\n\nIMPORTANT: Output ONLY the document content in markdown. No preamble, no "Here is your...", no closing remarks. Start directly with the content. Use markdown formatting: ## headings, - bullet lists, **bold** for key terms, > for important callouts.`,
        },
        {
          role:    'user',
          content: body.intent
            ? `Write this: ${body.intent}${body.title ? ` (titled "${body.title}")` : ''}`
            : `Generate a ${format === 'custom' ? 'note' : format}${body.title ? ` titled "${body.title}"` : ''}`,
        },
      ]
    } else {
      const format = (body.format ?? 'improve_english') as ImproveFormat
      if (!body.content?.trim()) return NextResponse.json({ error: 'content is required for improve mode' }, { status: 400 })

      messages = [
        {
          role:    'system',
          content: `You are a professional editor. ${IMPROVE_PROMPTS[format]}\n\nIMPORTANT: Return ONLY the improved content in markdown. No preamble, explanation, or meta-commentary.`,
        },
        {
          role:    'user',
          content: body.content,
        },
      ]
    }

    const result = await complete(body.config, messages)
    return NextResponse.json({ result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Writing failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
