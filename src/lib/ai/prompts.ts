import { AIMessage, AssistOperation } from './types'

/** Build the message list for an inline-assist operation (rewrite, expand, fix, etc.). */
export function buildAssistMessages(
  operation:   AssistOperation,
  text:        string,
  noteContext?: string,
): AIMessage[] {
  const wordCount  = text.trim().split(/\s+/).length
  const lengthHint =
    wordCount <= 20  ? `The selected text is very short (≈${wordCount} words). Keep your output similarly brief.`
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
    { role: 'system', content: SYSTEM_PROMPTS[operation] },
  ]

  if (operation === 'explain' && noteContext) {
    messages.push({
      role:    'user',
      content: `Context from my notes:\n${noteContext.slice(0, 3000)}\n\nExplain this:\n${text.slice(0, 2000)}`,
    })
  } else {
    messages.push({ role: 'user', content: text.slice(0, 6000) })
  }

  return messages
}

/** Build the message list for a summarization request. */
export function buildSummarizeMessages(
  content: string,
  title?:  string,
  mode:    'short' | 'bullets' | 'detailed' = 'bullets',
): AIMessage[] {
  const modeInstruction: Record<string, string> = {
    short:    'Provide a 1–2 sentence summary.',
    bullets:  'Provide a summary as 3–5 concise bullet points.',
    detailed: 'Provide a detailed summary covering all key points.',
  }

  return [
    {
      role:    'system',
      content: `You are a precise summarizer. ${modeInstruction[mode]} Be concise and extract only the most important information. Do not add information not present in the input.`,
    },
    {
      role:    'user',
      content: title
        ? `Summarize the following (titled "${title}"):\n\n${content}`
        : `Summarize the following:\n\n${content}`,
    },
  ]
}

/** Build the message list for a title generation request. */
export function buildTitleMessages(content: string, hint?: string): AIMessage[] {
  const hintLine = hint
    ? `\nThe user has started typing: "${hint}" — complete or improve it in the same direction.`
    : ''

  return [
    {
      role:    'system',
      content: `You are a title generator. Given note content, produce ONE concise, specific title (3–8 words).
Rules:
- No quotes, no punctuation at the end, no "Note about" or "Notes on" prefix
- Capture the most specific and useful aspect, not just the topic category
- If the note is a meeting or decision, lead with the outcome or decision
- Return ONLY the title — nothing else${hintLine}`,
    },
    { role: 'user', content: content },
  ]
}

/** Build the message list for a tag suggestion request. */
export function buildTagMessages(
  content:       string,
  title?:        string,
  existingTags?: string[],
): AIMessage[] {
  const existingLine = existingTags?.length
    ? `\nAlready-applied tags (do NOT suggest these): ${existingTags.join(', ')}`
    : ''

  const titleLine = title ? `Title: ${title}\n` : ''

  return [
    {
      role:    'system',
      content: `You are a tagging assistant. Given note content, suggest 3–6 relevant tags.
Rules:
- Tags are lowercase, kebab-case (e.g. "machine-learning", "product-design", "meeting-notes")
- Be specific: "react-hooks" beats "programming"; "q3-planning" beats "work"
- Return ONLY a JSON array of strings, no explanation: ["tag-one", "tag-two", "tag-three"]${existingLine}`,
    },
    { role: 'user', content: `${titleLine}${content}` },
  ]
}
