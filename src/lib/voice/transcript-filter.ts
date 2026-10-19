/**
 * Phrases a speech model makes up when it is given near-silence (they come from the subtitles it learned from).
 * They are only dropped when little was actually said, so a real "thank you" in a sentence is kept.
 */
const PHANTOM = new Set([
  'thank you', 'thanks', 'thank you for watching', 'thanks for watching', 'thank you so much for watching',
  'you', 'bye', 'bye bye', 'goodbye', 'see you next time', 'subtitles by the amara org community',
  'ご視聴ありがとうございました', 'ありがとうございました', '字幕由amara org社群提供',
])

/** Up to this much voice in a piece counts as "little was said". */
const SHORT_SPEECH_MS = 2500

const normalise = (text: string) =>
  text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()

/**
 * Cleans the text a speech service returned for one piece of audio. Returns an empty string for text that is not
 * speech: nothing but punctuation, a phrase invented for silence, or the context hint echoed back.
 */
export function cleanTranscript(text: string, opts: { speechMs: number; context?: string }): string {
  const trimmed = text.trim()
  const plain = normalise(trimmed)
  if (!plain) return ''
  if (opts.speechMs <= SHORT_SPEECH_MS && PHANTOM.has(plain)) return ''
  const context = normalise(opts.context ?? '')
  if (context && plain.length > 8 && context.endsWith(plain)) return ''
  return trimmed
}

/** The two-letter language code a speech service expects, from a locale such as en-US. */
export function languageCode(locale: string): string | undefined {
  const code = locale.split('-')[0].toLowerCase()
  return /^[a-z]{2}$/.test(code) ? code : undefined
}
