import { NextResponse } from 'next/server'

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
      headers: { 'Retry-After': String(Math.ceil((entry.reset - now) / 1000)) },
    })
  }

  return null
}
