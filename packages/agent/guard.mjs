// Who may talk to the local agent, and what they may ask it to do.
//
// The agent listens on the user's own machine and proxies to Ollama, which can run prompts, pull
// models and delete them. Any web page the user visits can try to send requests to 127.0.0.1, so the
// browser's own rules are not enough: the agent checks the page's Origin, the Host header (against
// DNS rebinding) and the endpoint itself.

const FIXED_ORIGINS = [
  /^https:\/\/(www\.)?dotstell\.app$/,
  /^https:\/\/(www\.)?dotstell\.com$/,
  // Local development of dotstell itself
  /^http:\/\/localhost(:\d{1,5})?$/,
  /^http:\/\/127\.0\.0\.1(:\d{1,5})?$/,
]

/**
 * Extra origins for people who host dotstell themselves, from DOTSTELL_ALLOWED_ORIGINS
 * (comma separated, exact origins such as https://notes.example.com).
 */
export function parseExtraOrigins(value = '') {
  const out = new Set()
  for (const item of value.split(',').map(s => s.trim()).filter(Boolean)) {
    try {
      const u = new URL(item)
      if (u.protocol === 'https:' || u.protocol === 'http:') out.add(u.origin)
    } catch { /* not a URL; ignored */ }
  }
  return out
}

export function isAllowedOrigin(origin, extra = new Set()) {
  if (typeof origin !== 'string' || !origin) return false
  return FIXED_ORIGINS.some(p => p.test(origin)) || extra.has(origin)
}

/** A page on an attacker's domain that resolves to 127.0.0.1 still sends its own name as Host. */
export function isAllowedHost(host, port) {
  return typeof host === 'string' && [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`].includes(host.toLowerCase())
}

// Only what dotstell uses. Pulling, creating, copying, pushing and deleting models are not on the list.
const ROUTES = {
  GET: new Set(['/health', '/api/tags', '/api/version', '/api/ps']),
  HEAD: new Set(['/health', '/api/tags', '/api/version', '/api/ps']),
  POST: new Set(['/api/chat', '/api/generate', '/api/embeddings', '/api/embed', '/api/show']),
}

export function isAllowedRoute(method, url) {
  const path = String(url ?? '').split('?')[0].replace(/\/+$/, '') || '/'
  return Boolean(ROUTES[method]?.has(path))
}
