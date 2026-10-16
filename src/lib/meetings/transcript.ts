/** The largest transcript we will read; anything longer is cut off and the caller is told. */
export const MAX_TRANSCRIPT_CHARS = 400_000

export type TranscriptFormat = 'vtt' | 'srt' | 'zoom-audio' | 'zoom-chat' | 'text'

export interface ParsedTranscript {
  /** One line per speaker turn, as "Name: what they said" (or just the text when no speaker is known). */
  text: string
  speakers: string[]
  format: TranscriptFormat
  /** True when the input was longer than MAX_TRANSCRIPT_CHARS and the end was dropped. */
  truncated: boolean
}

interface Turn {
  speaker: string | null
  text: string
}

const TIMESTAMP_LINE = /^(?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->\s*(?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}/
const ZOOM_AUDIO_HEADER = /^\[([^\]\n]{1,60})\]\s+(\d{1,2}:\d{2}:\d{2})\s*$/
const ZOOM_CHAT_LINE = /^(\d{1,2}:\d{2}:\d{2})\s+From\s+(.{1,60}?)\s+(?:to\s+.{1,60}?\s*)?:\s*(.*)$/
const VOICE_TAG = /^<v(?:\.[^\s>]*)?\s+([^>]{1,60})>/
const SPEAKER_PREFIX = /^([^:：\n]{1,40}?)\s*[:：]\s+(\S.*)$/

const stripTags = (s: string) => s.replace(/<[^>]*>/g, '')
const collapse = (s: string) => s.replace(/\s+/g, ' ').trim()

/** A plausible person name: short, not a sentence, no digits-only or URL-like prefix. */
function looksLikeName(s: string): boolean {
  const name = s.trim()
  if (!name || name.length > 40) return false
  if (/\d{3,}|https?|\/\//i.test(name)) return false
  return name.split(/\s+/).length <= 4
}

function detectFormat(lines: string[]): TranscriptFormat {
  const head = lines.slice(0, 40)
  if (head.some(l => /^WEBVTT/.test(l.trim()))) return 'vtt'
  const stamp = lines.find(l => TIMESTAMP_LINE.test(l.trim()))
  if (stamp) return stamp.includes(',') ? 'srt' : 'vtt' // SubRip writes milliseconds after a comma, WebVTT after a dot
  if (head.some(l => ZOOM_AUDIO_HEADER.test(l.trim()))) return 'zoom-audio'
  if (head.some(l => ZOOM_CHAT_LINE.test(l.trim()))) return 'zoom-chat'
  return 'text'
}

/** Cue formats (WebVTT from Zoom, Teams and Meet; SubRip). */
function parseCues(lines: string[]): Turn[] {
  const turns: Turn[] = []
  let inCue = false
  let skipBlock = false
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { inCue = false; skipBlock = false; continue }
    if (skipBlock) continue
    if (/^(WEBVTT|NOTE|STYLE|REGION)\b/.test(line) && !inCue) { skipBlock = true; continue }
    if (TIMESTAMP_LINE.test(line)) { inCue = true; continue }
    if (!inCue) continue // cue numbers and identifiers sit before the timestamp line

    let speaker: string | null = null
    let body = line
    const voice = VOICE_TAG.exec(body)
    if (voice) { speaker = collapse(voice[1]); body = body.slice(voice[0].length) }
    body = collapse(stripTags(body))
    if (!speaker) {
      const prefix = SPEAKER_PREFIX.exec(body)
      if (prefix && looksLikeName(prefix[1])) { speaker = collapse(prefix[1]); body = prefix[2] }
    }
    if (body) turns.push({ speaker, text: body })
  }
  return turns
}

/** Zoom's "audio_transcript.txt": a "[Name] 10:03:21" header line, then what was said. */
function parseZoomAudio(lines: string[]): Turn[] {
  const turns: Turn[] = []
  let speaker: string | null = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const header = ZOOM_AUDIO_HEADER.exec(line)
    if (header) { speaker = collapse(header[1]); continue }
    turns.push({ speaker, text: collapse(line) })
  }
  return turns
}

function parseZoomChat(lines: string[]): Turn[] {
  const turns: Turn[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const m = ZOOM_CHAT_LINE.exec(line)
    if (m) { if (m[3]) turns.push({ speaker: collapse(m[2]), text: collapse(m[3]) }) }
    else if (turns.length) turns[turns.length - 1].text += ' ' + collapse(line) // a chat message that wrapped
  }
  return turns
}

/** Free text: keep the lines as they are, but note who speaks when "Name: ..." prefixes repeat. */
function parsePlain(lines: string[]): Turn[] {
  const rows = lines.map(l => l.trim()).filter(Boolean)
  const counts = new Map<string, number>()
  for (const row of rows) {
    const m = SPEAKER_PREFIX.exec(row)
    if (m && looksLikeName(m[1])) counts.set(m[1].trim(), (counts.get(m[1].trim()) ?? 0) + 1)
  }
  // A prefix that appears once is more likely "Note: ..." than a speaker.
  const names = new Set([...counts].filter(([, n]) => n >= 2).map(([name]) => name))
  return rows.map(row => {
    const m = SPEAKER_PREFIX.exec(row)
    return m && names.has(m[1].trim()) ? { speaker: m[1].trim(), text: collapse(m[2]) } : { speaker: null, text: collapse(row) }
  })
}

/** Join consecutive turns by the same speaker, so a sentence split over several cues reads as one. */
function mergeTurns(turns: Turn[]): Turn[] {
  const out: Turn[] = []
  for (const t of turns) {
    const last = out[out.length - 1]
    if (last && t.speaker !== null && last.speaker === t.speaker) last.text += ' ' + t.text
    else out.push({ ...t })
  }
  return out
}

/**
 * Turns a pasted or uploaded transcript into plain "Speaker: text" lines. Understands WebVTT and SubRip (Zoom,
 * Teams, Google Meet), Zoom's audio transcript and chat files, and ordinary text. The input is untrusted:
 * markup is stripped and the result is plain text only.
 */
export function parseTranscript(raw: string): ParsedTranscript {
  let input = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  const truncated = input.length > MAX_TRANSCRIPT_CHARS
  if (truncated) input = input.slice(0, MAX_TRANSCRIPT_CHARS)

  const lines = input.split('\n')
  const format = detectFormat(lines)
  const turns = mergeTurns(
    format === 'vtt' || format === 'srt' ? parseCues(lines)
      : format === 'zoom-audio' ? parseZoomAudio(lines)
        : format === 'zoom-chat' ? parseZoomChat(lines)
          : parsePlain(lines),
  )

  const speakers: string[] = []
  for (const t of turns) if (t.speaker && !speakers.includes(t.speaker)) speakers.push(t.speaker)
  const text = turns.map(t => (t.speaker ? `${t.speaker}: ${t.text}` : t.text)).join('\n')
  return { text, speakers: speakers.slice(0, 50), format, truncated }
}

/**
 * Splits a transcript into pieces of at most `maxChars`, on line boundaries, so each can be sent to the model on
 * its own. A single line longer than the limit is cut at a sentence end where possible.
 */
export function chunkTranscript(text: string, maxChars = 9000): string[] {
  const chunks: string[] = []
  let current = ''
  const flush = () => { if (current) { chunks.push(current); current = '' } }

  for (const line of text.split('\n')) {
    if (!line) continue
    if (line.length > maxChars) {
      flush()
      let rest = line
      while (rest.length > maxChars) {
        const window = rest.slice(0, maxChars)
        const cut = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '))
        const at = cut > maxChars / 2 ? cut + 1 : maxChars
        chunks.push(rest.slice(0, at).trim())
        rest = rest.slice(at).trim()
      }
      current = rest
      continue
    }
    if (current && current.length + 1 + line.length > maxChars) flush()
    current = current ? current + '\n' + line : line
  }
  flush()
  return chunks
}
