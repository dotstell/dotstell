/**
 * Build an `ilike` pattern for a PostgREST `.or()` filter from free text. The text is matched literally:
 * LIKE wildcards are escaped, and the value is double-quoted so commas, parentheses and dots in it can't
 * end the condition early or add conditions of their own.
 */
export function ilikeContains(text: string, maxLength = 200): string {
  const literal = text.slice(0, maxLength).replace(/[\\%_]/g, '\\$&')
  const quoted = `%${literal}%`.replace(/[\\"]/g, '\\$&')
  return `"${quoted}"`
}
