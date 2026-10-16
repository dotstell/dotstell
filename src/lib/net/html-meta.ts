// Reads page metadata from untrusted HTML in one pass. The earlier regexes such as
// /<meta[^>]+content="..."/ restart from every "<meta", so a page made of thousands of unclosed
// tags made them quadratic. Here each tag is found with indexOf and the scan always moves forward.

const MAX_TAG_LENGTH = 4000
const ATTR = /([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g

type Attrs = Record<string, string>

function parseAttrs(tag: string): Attrs {
  const attrs: Attrs = {}
  ATTR.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ATTR.exec(tag))) attrs[m[1].toLowerCase()] ??= m[2] ?? m[3] ?? m[4] ?? ''
  return attrs
}

/** Attributes of every `<name ...>` tag, in order. */
export function findTags(html: string, name: string): Attrs[] {
  const lower = html.toLowerCase()
  const needle = `<${name}`
  const found: Attrs[] = []
  let i = 0
  while ((i = lower.indexOf(needle, i)) !== -1) {
    const next = lower.charCodeAt(i + needle.length)
    // "<metadata>" is not "<meta ...>": the name must end here.
    if (!(next === 32 || next === 9 || next === 10 || next === 13 || next === 47 || next === 62)) { i += needle.length; continue }
    const end = html.indexOf('>', i)
    if (end === -1) break
    found.push(parseAttrs(html.slice(i, Math.min(end, i + MAX_TAG_LENGTH))))
    i = end + 1
  }
  return found
}

export function findTitle(html: string): string | null {
  const lower = html.toLowerCase()
  const start = lower.indexOf('<title')
  if (start === -1) return null
  const open = html.indexOf('>', start)
  if (open === -1) return null
  const close = lower.indexOf('</title', open)
  const text = html.slice(open + 1, close === -1 ? open + 201 : Math.min(close, open + 201)).trim()
  return text || null
}

/** Words of visible text, skipping script and style bodies, without a backtracking regex. */
export function countWords(html: string): number {
  const lower = html.toLowerCase()
  let words = 0
  let inWord = false
  for (let i = 0; i < html.length; i++) {
    const ch = html.charCodeAt(i)
    if (ch === 60 /* < */) {
      const skip = lower.startsWith('<script', i) ? '</script' : lower.startsWith('<style', i) ? '</style' : null
      if (skip) {
        const close = lower.indexOf(skip, i)
        if (close === -1) break
        i = close
      }
      const end = html.indexOf('>', i)
      if (end === -1) break
      i = end
      inWord = false
      continue
    }
    const space = ch === 32 || ch === 9 || ch === 10 || ch === 13
    if (!space && !inWord) words++
    inWord = !space
  }
  return words
}
