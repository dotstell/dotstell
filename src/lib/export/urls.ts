/** Links in exported files must be http(s), mailto or ftp; `javascript:` and similar become plain text. */
export function safeHref(url: string): string | null {
  try {
    const u = new URL(url.trim())
    if (!['http:', 'https:', 'mailto:', 'ftp:'].includes(u.protocol)) return null
    return u.href
  } catch {
    return null
  }
}
