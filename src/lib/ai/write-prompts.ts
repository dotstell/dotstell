import type { AIMessage } from './types'

export type DraftFormat   = 'outline' | 'meeting' | 'daily' | 'research' | 'ooo' | 'proposal' | 'status' | 'email' | 'custom'
export type ImproveFormat = 'improve_english' | 'formal' | 'concise' | 'expand' | 'rewrite'

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

export interface WriteRequest {
  mode?: string
  format?: string
  intent?: string
  title?: string
  content?: string
}

/** The messages for an AI Write request, or an error message when the request is not valid. */
export function buildWriteMessages(body: WriteRequest): { messages: AIMessage[] } | { error: string } {
  if (body.mode === 'draft') {
    const format = (body.format ?? 'custom') as DraftFormat
    if (format !== 'custom' && !(format in DRAFT_PROMPTS)) return { error: `Unknown draft format: ${format}` }
    const intent = body.intent?.slice(0, 500) ?? ''
    const title  = body.title?.slice(0, 200)  ?? ''
    const formatInstruction = format === 'custom'
      ? `Write content based on this intent: "${intent || 'a general note'}". Choose the most fitting structure and format.`
      : DRAFT_PROMPTS[format]

    const titleContext  = title  ? ` The note title is: "${title}".`                            : ''
    const intentContext = intent && format !== 'custom'
      ? ` Additional context from the user: "${intent}".` : ''

    return {
      messages: [
        {
          role:    'system',
          content: `You are a professional writing assistant. ${formatInstruction}${titleContext}${intentContext}

IMPORTANT: Output ONLY the document content in markdown. No preamble, no "Here is your...", no closing remarks. Start directly with the content. Use markdown formatting: ## headings, - bullet lists, **bold** for key terms, > for important callouts.`,
        },
        {
          role:    'user',
          content: intent
            ? `Write this: ${intent}${title ? ` (titled "${title}")` : ''}`
            : `Generate a ${format === 'custom' ? 'note' : format}${title ? ` titled "${title}"` : ''}`,
        },
      ],
    }
  }

  const format = (body.format ?? 'improve_english') as ImproveFormat
  if (!(format in IMPROVE_PROMPTS)) return { error: `Unknown improve format: ${format}` }
  if (!body.content?.trim()) return { error: 'content is required for improve mode' }
  return {
    messages: [
      {
        role:    'system',
        content: `You are a professional editor. ${IMPROVE_PROMPTS[format]}

IMPORTANT: Return ONLY the improved content in markdown. No preamble, explanation, or meta-commentary.`,
      },
      { role: 'user', content: body.content.slice(0, 12_000) },
    ],
  }
}
