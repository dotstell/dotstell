// Slows down anyone guessing tokens. In memory like src/lib/ratelimit.ts: it resets on a cold start, which is
// acceptable because tokens carry 256 bits of randomness and guessing is not realistic; this limits noise and load.
const failures = new Map<string, { count: number; reset: number }>()

export const MAX_FAILURES = 20
export const FAILURE_WINDOW_MS = 10 * 60_000

/** True when this address has failed to authenticate too often recently. */
export function isBlocked(ip: string, now = Date.now()): boolean {
  const entry = failures.get(ip)
  return !!entry && entry.reset > now && entry.count >= MAX_FAILURES
}

export function recordFailure(ip: string, now = Date.now()): void {
  if (failures.size > 5000) {
    for (const [key, value] of failures) if (value.reset < now) failures.delete(key)
    if (failures.size > 5000) failures.clear()
  }
  const entry = failures.get(ip)
  if (!entry || entry.reset < now) failures.set(ip, { count: 1, reset: now + FAILURE_WINDOW_MS })
  else entry.count++
}

export function clientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0].trim() || headers.get('x-real-ip') || 'unknown'
}

export function resetGuard(): void {
  failures.clear()
}
