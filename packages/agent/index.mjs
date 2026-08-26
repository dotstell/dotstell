#!/usr/bin/env node
/**
 * Dotstell Local AI Agent
 *
 * Runs on http://127.0.0.1:12345 and proxies requests to a local Ollama instance.
 * Adds the browser security headers (CORS + Private Network Access) that Ollama itself
 * does not yet return, allowing dotstell.app to reach Ollama from any browser.
 *
 * Usage:
 *   node index.mjs
 *
 * Environment variables:
 *   DOTSTELL_AGENT_PORT   Port to listen on (default: 12345)
 *   OLLAMA_HOST           Ollama hostname (default: 127.0.0.1)
 *   OLLAMA_PORT           Ollama port (default: 11434)
 */

import http from 'http'

const AGENT_VERSION = '1.0.0'
const AGENT_PORT    = parseInt(process.env.DOTSTELL_AGENT_PORT ?? '12345', 10)
const OLLAMA_HOST   = process.env.OLLAMA_HOST ?? '127.0.0.1'
const OLLAMA_PORT   = parseInt(process.env.OLLAMA_PORT ?? '11434', 10)

// Origins allowed to use this agent.
// The agent listens only on 127.0.0.1 (loopback), so only local code can reach it —
// broad origin allowance is safe here.
const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/dotstell\.app$/,
  /^https:\/\/dotstell\.com$/,
  /^https:\/\/.*\.vercel\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
]

function resolveOrigin(requestOrigin) {
  if (!requestOrigin) return 'https://dotstell.app'
  return ALLOWED_ORIGIN_PATTERNS.some(p => p.test(requestOrigin))
    ? requestOrigin
    : 'https://dotstell.app'
}

function setCorsHeaders(res, origin) {
  res.setHeader('Access-Control-Allow-Origin',          resolveOrigin(origin))
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  res.setHeader('Access-Control-Allow-Methods',         'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers',         'Content-Type, Authorization')
  res.setHeader('Access-Control-Max-Age',               '86400')
  res.setHeader('Vary',                                 'Origin')
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin ?? ''

  // ── CORS preflight ──────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res, origin)
    res.writeHead(204)
    res.end()
    return
  }

  // ── Health check ────────────────────────────────────────────────────────────
  if (req.url === '/health' || req.url === '/health/') {
    setCorsHeaders(res, origin)
    res.setHeader('Content-Type', 'application/json')
    res.writeHead(200)
    res.end(JSON.stringify({
      status:  'ok',
      version: AGENT_VERSION,
      ollama:  `http://${OLLAMA_HOST}:${OLLAMA_PORT}`,
    }))
    return
  }

  // ── Proxy everything else to Ollama ─────────────────────────────────────────
  const proxyHeaders = { ...req.headers, host: `${OLLAMA_HOST}:${OLLAMA_PORT}` }
  delete proxyHeaders['origin']   // don't forward — Ollama validates origins
  delete proxyHeaders['referer']

  const proxyReq = http.request(
    { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path: req.url, method: req.method, headers: proxyHeaders },
    (proxyRes) => {
      setCorsHeaders(res, origin)
      // Copy Ollama's response headers — but let our CORS headers take precedence
      for (const [key, val] of Object.entries(proxyRes.headers)) {
        if (!key.toLowerCase().startsWith('access-control-')) res.setHeader(key, val)
      }
      res.writeHead(proxyRes.statusCode ?? 200)
      proxyRes.pipe(res, { end: true })
    },
  )

  proxyReq.on('error', (err) => {
    setCorsHeaders(res, origin)
    res.setHeader('Content-Type', 'application/json')
    const isRefused = err.code === 'ECONNREFUSED'
    res.writeHead(isRefused ? 503 : 502)
    res.end(JSON.stringify({
      error: isRefused
        ? `Ollama is not running at ${OLLAMA_HOST}:${OLLAMA_PORT}. Start Ollama and try again.`
        : `Ollama proxy error: ${err.message}`,
    }))
  })

  req.pipe(proxyReq, { end: true })
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${AGENT_PORT} is already in use. Is the agent already running?`)
  } else {
    console.error('Agent error:', err.message)
  }
  process.exit(1)
})

server.listen(AGENT_PORT, '127.0.0.1', () => {
  console.log(`Dotstell Local AI Agent v${AGENT_VERSION}`)
  console.log(`Listening  →  http://127.0.0.1:${AGENT_PORT}`)
  console.log(`Proxying   →  http://${OLLAMA_HOST}:${OLLAMA_PORT}`)
  console.log()
  console.log('Keep this running while using Ollama from dotstell.app')
  console.log('Press Ctrl+C to stop.')
})
