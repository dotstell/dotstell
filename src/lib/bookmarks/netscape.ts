// Tokeniser for the Netscape bookmark file that Chrome, Firefox, Safari and Edge export.
//
// The files are untrusted input of up to 10 MB. The regex this replaces
// (/<A\s+[^>]*HREF="..."[^>]*>(.*?)<\/A>/) restarted its search at every "<A", so a file made of
// repeated "<A " took time proportional to the square of its size. Here the positions of every
// opening and closing tag are found once, and the scan only ever moves forward through them, so
// the time is proportional to the size of the file.

export type NetscapeToken =
  | { kind: 'tag'; name: 'DL' | '/DL' | 'DT' }
  | { kind: 'h3'; text: string }
  | { kind: 'a'; href: string; text: string }

const MAX_OPEN_TAG = 8000
const MAX_TEXT = 2000
const HREF = /\bhref\s*=\s*"([^"]*)"/i

/** Positions of `needle` in `text`; for an opening tag the next character must end the name. */
function positions(text: string, needle: string, endsName: boolean): number[] {
  const out: number[] = []
  let at = 0
  while ((at = text.indexOf(needle, at)) !== -1) {
    const next = text.charCodeAt(at + needle.length)
    if (!endsName || next === 32 || next === 9 || next === 10 || next === 13 || next === 62 || next === 47) out.push(at)
    at += needle.length
  }
  return out
}

/** First entry >= `from`, moving only forward. */
class Forward {
  private n = 0
  constructor(private readonly list: number[]) {}
  at(from: number): number {
    while (this.n < this.list.length && this.list[this.n] < from) this.n++
    return this.n < this.list.length ? this.list[this.n] : -1
  }
}

export function tokenizeNetscape(html: string): NetscapeToken[] {
  const lower = html.toLowerCase()
  const closeA = new Forward(positions(lower, '</a', false))
  const openA = new Forward(positions(lower, '<a', true))
  const closeH3 = new Forward(positions(lower, '</h3', false))
  const openH3 = new Forward(positions(lower, '<h3', true))
  const tokens: NetscapeToken[] = []

  let i = 0
  while ((i = html.indexOf('<', i)) !== -1) {
    const closing = html.charCodeAt(i + 1) === 47
    const start = i + (closing ? 2 : 1)
    const stop = /[\s>/]/.exec(html.slice(start, start + 12))
    const base = lower.slice(start, stop ? start + stop.index : start + 12)
    const name = closing ? `/${base}` : base

    if (name === 'dl' || name === '/dl' || name === 'dt') {
      const end = html.indexOf('>', i)
      if (end === -1) break
      tokens.push({ kind: 'tag', name: name.toUpperCase() as 'DL' | '/DL' | 'DT' })
      i = end + 1
    } else if (name === 'h3' || name === 'a') {
      const open = html.indexOf('>', i)
      if (open === -1) break
      const [closes, opens, closer] = name === 'a' ? [closeA, openA, '</a'] as const : [closeH3, openH3, '</h3'] as const
      const close = closes.at(open)
      const nextOpen = opens.at(i + 1)
      // A tag that is not closed before the next one of its kind starts was never closed at all.
      if (close === -1 || (nextOpen !== -1 && nextOpen < close)) { i = open + 1; continue }

      const text = html.slice(open + 1, Math.min(close, open + 1 + MAX_TEXT)).replace(/<[^>]*>/g, '').trim()
      if (name === 'h3') {
        tokens.push({ kind: 'h3', text })
      } else {
        const href = open - i <= MAX_OPEN_TAG ? HREF.exec(html.slice(i, open))?.[1] : undefined
        if (href !== undefined) tokens.push({ kind: 'a', href, text })
      }
      i = close + closer.length
    } else {
      i++
    }
  }
  return tokens
}
