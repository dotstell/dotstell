import { createHash, randomBytes } from 'node:crypto'

/** Marks a token as belonging to dotstell, so secret scanners and people can recognise one that leaked. */
export const TOKEN_PREFIX = 'dst_'

export const DEFAULT_TOKEN_DAYS = 90
export const MAX_TOKEN_DAYS = 365
export const MAX_ACTIVE_TOKENS = 10

/** 4-character prefix plus 32 random bytes in base64url: 256 bits of randomness, 47 characters. */
const TOKEN_PATTERN = /^dst_[A-Za-z0-9_-]{43}$/

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/**
 * Creates a new token. Only the hash and a short display prefix are stored; the token itself is shown to the user once.
 * A fast hash is enough because the token is random, not a password a person chose.
 */
export function generateToken(): { token: string; hash: string; prefix: string } {
  const token = TOKEN_PREFIX + randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token), prefix: token.slice(0, 8) }
}

/** Cheap shape check so obviously wrong values never reach the database. */
export function looksLikeToken(value: string): boolean {
  return TOKEN_PATTERN.test(value)
}

/** Reads a bearer token from an Authorization header, or null. */
export function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(\S+)$/i)
  return match && looksLikeToken(match[1]) ? match[1] : null
}
