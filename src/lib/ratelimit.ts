import { NextResponse } from 'next/server'

// In-memory store — intentional for this OSS deployment (single Next.js process).
// Counters reset on cold starts / serverless function restarts, which is acceptable
// for a personal-use app. Swap `store` for an Upstash Redis client if you need
// distributed rate limiting across multiple instances.
const store = new Map<string, { count: number; reset: number }>()

// Clean up old entries every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, val] of store) {
      if (val.reset < now) store.delete(key)
    }
  }, 5 * 60 * 1000)
}

export function rateLimit(id: string, limit = 60, windowMs = 60_000): NextResponse | null {
  const now = Date.now()
  const entry = store.get(id)

  if (!entry || entry.reset < now) {
    store.set(id, { count: 1, reset: now + windowMs })
    return null
  }

  entry.count++
  if (entry.count > limit) {
    return NextResponse.json({ error: 'Too many requests.' }, {
      status: 429,
      // RFC 7231 §7.1.3 — number of seconds until the window resets
      headers: { 'Retry-After': String(Math.ceil((entry.reset - now) / 1000)) },
    })
  }

  return null
}
