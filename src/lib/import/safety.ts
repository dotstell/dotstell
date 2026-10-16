// Checks applied to everything that arrives in an import. Imported files are untrusted: they may be
// executables dressed up as notes, images that are really something else, or SVGs carrying scripts.

/** Extensions that are never read or stored. They are reported so the user knows they were refused. */
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'dll', 'msi', 'bat', 'cmd', 'com', 'scr', 'ps1', 'psm1', 'vbs', 'vbe', 'wsf', 'jar', 'apk',
  'app', 'dmg', 'pkg', 'deb', 'rpm', 'sh', 'bash', 'zsh', 'command', 'lnk', 'reg', 'hta', 'cpl',
  'js', 'mjs', 'jse', 'html', 'htm', 'xhtml', 'xml', 'php', 'py', 'rb', 'pl', 'so', 'bin', 'iso',
])

/** Archives inside the archive are not unpacked: nothing is extracted that the user cannot see. */
const NESTED_ARCHIVES = new Set(['zip', '7z', 'rar', 'tar', 'gz', 'tgz', 'bz2', 'xz'])

export type FileVerdict = 'markdown' | 'image' | 'blocked' | 'archive' | 'unsupported'

export const extensionOf = (path: string) => (path.split('.').pop() ?? '').toLowerCase()

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'])

export function classifyFile(path: string): FileVerdict {
  const ext = extensionOf(path)
  if (ext === 'md') return 'markdown'
  if (IMAGE_EXTENSIONS.has(ext)) return 'image'
  if (BLOCKED_EXTENSIONS.has(ext)) return 'blocked'
  if (NESTED_ARCHIVES.has(ext)) return 'archive'
  return 'unsupported'
}

/** A path that tries to leave the import (`../x`, `/etc/x`, `C:\x`) is refused, not normalised. */
export function hasUnsafePath(rawPath: string): boolean {
  const p = rawPath.replace(/\\/g, '/')
  return p.split('/').includes('..') || /^[a-zA-Z]:/.test(p) || p.includes('\u0000')
}

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v)

/** The real image type, judged by the bytes and not by the file name. */
export function sniffImage(b: Uint8Array): string | null {
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (startsWith(b, [0x47, 0x49, 0x46, 0x38])) return 'image/gif'
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp'
  if (startsWith(b, [0x42, 0x4d])) return 'image/bmp'
  if (startsWith(b, [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66], 4)) return 'image/avif'
  const head = new TextDecoder().decode(b.subarray(0, 512)).trimStart().toLowerCase()
  if (head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg'))) return 'image/svg+xml'
  return null
}

/** SVG can carry scripts and external references; only plain drawings are kept. */
export function isSafeSvg(b: Uint8Array): boolean {
  const text = new TextDecoder().decode(b)
  return !/<script|<foreignobject|<iframe|<embed|<object|\son[a-z]+\s*=|javascript:|data:text\/html|<!entity|<use[^>]+href\s*=\s*["']?(?!#)/i.test(text)
}

/** Text notes must be text. NUL bytes in the first chunk mean a binary file wearing a .md name. */
export function looksBinary(b: Uint8Array): boolean {
  const n = Math.min(b.length, 8192)
  for (let i = 0; i < n; i++) if (b[i] === 0) return true
  return false
}

const BLOCKED_TAGS = new Set(['script', 'iframe', 'object', 'embed', 'link', 'meta', 'base', 'form', 'style', 'svg', 'math'])
const URL_ATTRIBUTES = new Set(['href', 'src', 'xlink:href', 'action', 'formaction'])
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|gif|webp|bmp|avif|svg\+xml);base64,/i

const isSpace = (c: number) => c === 32 || c === 9 || c === 10 || c === 12 || c === 13
const isLetter = (c: number) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122)

/**
 * What a browser would make of an attribute value used as an address: character references are
 * decoded, then tabs, newlines and spaces (which browsers ignore inside a URL) are removed, so
 * " javascript:", "java&#9;script:" and "&#x0A;javascript:" all read as javascript:.
 */
function normaliseUrl(value: string): string {
  const head = value.slice(0, 200)
    .replace(/&#x([0-9a-f]+);?/gi, (_, h: string) => String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff)))
    .replace(/&#(\d+);?/g, (_, d: string) => String.fromCodePoint(Math.min(parseInt(d, 10), 0x10ffff)))
    .replace(/&(tab|newline|colon);?/gi, (_, n: string) => ({ tab: '\t', newline: '\n', colon: ':' })[n.toLowerCase() as 'tab'])
  // eslint-disable-next-line no-control-regex
  return head.replace(/[\u0000- \u007f]/g, '').toLowerCase()
}

function isUnsafeUrl(tag: string, attribute: string, value: string): boolean {
  const url = normaliseUrl(value)
  if (url.startsWith('javascript:') || url.startsWith('vbscript:')) return true
  if (url.startsWith('data:')) {
    // The one legitimate use: a picture embedded in an <img>.
    return !(tag === 'img' && attribute === 'src' && IMAGE_DATA_URL.test(url))
  }
  return false
}

/**
 * Last line of defence before saving, shared by client and server: does this HTML still contain
 * anything that can run? The importer escapes such input, so a hit means something was tampered with.
 *
 * It walks the markup once, tag by tag, the way a browser tokenises it, and never goes back. (Regexes
 * such as /<[^>]*\son[a-z]+=/ restart at every "<", so a note of 2 MB of "<" kept the server busy for
 * minutes.) Because it reads real attributes, "<img/onerror=x>" and `<img src="x"onerror=x>` are found
 * too, which the regexes missed.
 */
export function containsActiveContent(html: string): boolean {
  const n = html.length
  let i = 0
  while (i < n) {
    const lt = html.indexOf('<', i)
    if (lt === -1) return false
    const first = html.charCodeAt(lt + 1)
    const closing = first === 47
    // "<" followed by anything else is plain text to a browser.
    if (!isLetter(first) && !closing && first !== 33 && first !== 63) { i = lt + 1; continue }

    if (first === 33 && html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4)
      if (end === -1) return false
      i = end + 3
      continue
    }

    let j = lt + (closing ? 2 : 1)
    const nameStart = j
    while (j < n) {
      const c = html.charCodeAt(j)
      if (isSpace(c) || c === 62 || c === 47) break
      j++
    }
    const tag = html.slice(nameStart, j).toLowerCase()
    if (!closing && BLOCKED_TAGS.has(tag)) return true
    if (first === 33 || first === 63) {
      const end = html.indexOf('>', j)
      if (end === -1) return false
      i = end + 1
      continue
    }

    // Attributes, up to the closing ">".
    for (;;) {
      while (j < n && (isSpace(html.charCodeAt(j)) || html.charCodeAt(j) === 47)) j++
      if (j >= n) return false // an unfinished tag is dropped by browsers
      if (html.charCodeAt(j) === 62) { j++; break }

      const attrStart = j
      while (j < n) {
        const c = html.charCodeAt(j)
        if (isSpace(c) || c === 61 || c === 62 || c === 47) break
        j++
      }
      const attribute = html.slice(attrStart, j).toLowerCase()
      if (attribute === '') { j++; continue }

      let k = j
      while (k < n && isSpace(html.charCodeAt(k))) k++
      let value = ''
      if (html.charCodeAt(k) === 61) {
        k++
        while (k < n && isSpace(html.charCodeAt(k))) k++
        const quote = html.charCodeAt(k)
        if (quote === 34 || quote === 39) {
          const end = html.indexOf(String.fromCharCode(quote), k + 1)
          if (end === -1) return false
          value = html.slice(k + 1, end)
          k = end + 1
        } else {
          const valueStart = k
          while (k < n && !isSpace(html.charCodeAt(k)) && html.charCodeAt(k) !== 62) k++
          value = html.slice(valueStart, k)
        }
        j = k
      }

      if (attribute.startsWith('on')) return true
      if (URL_ATTRIBUTES.has(attribute) && isUnsafeUrl(tag, attribute, value)) return true
    }
    i = j
  }
  return false
}
