/**
 * Turns what the browser's speech recognition heard into written text. The browser sends words with no punctuation
 * and no capital letters, so this reads spoken punctuation ("comma", "question mark", "new line") and capitalises
 * the start of sentences and the word "I". English only: other languages are returned unchanged.
 */

export interface FormatOptions {
  /** Read "comma", "question mark" and the like as punctuation. */
  spoken: boolean
  /** The dictation language, such as en-US. */
  lang: string
}

/** Words that, said before "period", mean it is a noun ("a time period") and not the punctuation mark. */
const NOUN_BEFORE_PERIOD = /\b(?:the|a|an|this|that|time|grace|trial|same|whole|long|short|each|one|first|last|next)$/i

const COMMANDS: [RegExp, string][] = [
  [/\s*\bquestion mark\b[,.?]*\s*/gi, '? '],
  [/\s*\bexclamation (?:mark|point)\b[,.!]*\s*/gi, '! '],
  [/\s*\bfull stop\b[,.]*\s*/gi, '. '],
  [/\s*\bcomma\b[,.]*\s*/gi, ', '],
  [/\s*\bnew (?:line|paragraph)\b[,.]*\s*/gi, '\n'],
]

/** "Period" is also an ordinary word, so it is only punctuation when it ends the phrase or is all that was said. */
function readPeriod(text: string): string {
  const match = /^([\s\S]*?)\s*\bperiod\b[,.]*\s*$/i.exec(text)
  if (!match) return text
  const before = match[1]
  if (before && NOUN_BEFORE_PERIOD.test(before)) return text
  return before + '. '
}

function readSpokenPunctuation(text: string): string {
  let out = readPeriod(text)
  for (const [pattern, mark] of COMMANDS) out = out.replace(pattern, mark)
  return out
}

const SENTENCE_END = /[.?!]\s*$/

/**
 * `text` is a dictated phrase and `before` is the text of the paragraph up to the place it will go, which decides
 * whether the phrase starts a sentence. A new line in the result is a "\n" for the editor to turn into a paragraph.
 */
export function formatDictation(text: string, before: string, opts: FormatOptions): string {
  if (!opts.lang.toLowerCase().startsWith('en')) return text
  const lead = /^\s*/.exec(text)![0]
  const trail = /\s*$/.exec(text)![0]
  let out = text.trim()
  // Only spaces are trimmed: a trailing newline is a line break that was asked for.
  if (opts.spoken) out = readSpokenPunctuation(out).replace(/^[ \t]+|[ \t]+$/g, '')
  if (!out) return out + trail

  out = out.replace(/([.?!]\s+|\n)(\p{Ll})/gu, (_all, edge: string, letter: string) => edge + letter.toUpperCase())
  if (!before.trim() || SENTENCE_END.test(before)) out = out.replace(/^(\p{Ll})/u, letter => letter.toUpperCase())
  out = out.replace(/\bi\b(?![.]\w)/g, 'I')
  return lead + out + trail
}
