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

/**
 * Last line of defence before saving, shared by client and server: does this HTML still contain
 * anything that can run? The importer escapes such input, so a hit means something was tampered with.
 */
export function containsActiveContent(html: string): boolean {
  return (
    /<\s*(script|iframe|object|embed|link|meta|base|form|style|svg|math)\b/i.test(html) ||
    /<[^>]*\son[a-z]+\s*=/i.test(html) ||
    /<[^>]*\s(href|src|xlink:href|action|formaction)\s*=\s*["']?\s*(javascript|vbscript|data:text)/i.test(html) ||
    /<img[^>]*\ssrc\s*=\s*["']?\s*data:(?!image\/(png|jpe?g|gif|webp|bmp|avif|svg\+xml);base64,)/i.test(html)
  )
}
