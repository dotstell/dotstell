// Characters that are illegal in file names on Windows, or that Obsidian treats as link syntax
// (# heading, ^ block, [ ] link brackets, | alias) and so would break a [[link]] to the file.
const UNSAFE = /[\\/:*?"<>|#^[\]\u0000-\u001f]/g

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

const MAX_LENGTH = 120

/** Turns an arbitrary title into a name that is safe on Windows, macOS, Linux and in Obsidian links. */
export function sanitizeFileName(raw: string, fallback = 'Untitled'): string {
  let name = raw.replace(UNSAFE, ' ').replace(/\s+/g, ' ').trim()
  // Windows silently strips trailing dots and spaces, which would make two names collide.
  name = name.replace(/[. ]+$/, '').replace(/^\.+/, '')
  if (name.length > MAX_LENGTH) name = name.slice(0, MAX_LENGTH).trim()
  if (!name) name = fallback
  if (WINDOWS_RESERVED.test(name)) name = `${name}_`
  return name
}

/**
 * Hands out names that are unique case-insensitively (macOS and Windows file systems treat
 * "Plan" and "plan" as the same file), appending " (2)", " (3)" … on collision.
 */
export function createNamer() {
  const used = new Set<string>()
  return function unique(raw: string, fallback?: string): string {
    const base = sanitizeFileName(raw, fallback)
    let candidate = base
    let n = 2
    while (used.has(candidate.toLowerCase())) candidate = `${base} (${n++})`
    used.add(candidate.toLowerCase())
    return candidate
  }
}

/** Percent-encodes each path segment so the path is a valid Markdown link target. */
export function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}
