#!/usr/bin/env node
/**
 * Dotstell Local AI Agent
 *
 * Runs on http://127.0.0.1:12345 and proxies requests to a local Ollama instance.
 * Adds the browser security headers (CORS + Private Network Access) that Ollama itself
 * does not yet return, allowing dotstell.app to reach Ollama from any browser.
 *
 * Usage:
 *   npx @dotstell/agent
 *   node index.mjs
 *
 * Environment variables:
 *   DOTSTELL_AGENT_PORT   Port to listen on (default: 12345)
 *   OLLAMA_HOST           Ollama hostname (default: 127.0.0.1)
 *   OLLAMA_PORT           Ollama port (default: 11434)
 */

import http from 'node:http'

const AGENT_VERSION = '1.1.0'
const AGENT_PORT    = parseInt(process.env.DOTSTELL_AGENT_PORT ?? '12345', 10)
const OLLAMA_HOST   = process.env.OLLAMA_HOST ?? '127.0.0.1'
const OLLAMA_PORT   = parseInt(process.env.OLLAMA_PORT ?? '11434', 10)

// ── Colors (ANSI, TTY-guarded) ────────────────────────────────────────────────
const USE_COLOR = process.stdout.isTTY
const c = {
  reset:  USE_COLOR ? '\x1b[0m'        : '',
  bold:   USE_COLOR ? '\x1b[1m'        : '',
  dim:    USE_COLOR ? '\x1b[2m'        : '',
  purple: USE_COLOR ? '\x1b[38;5;141m' : '',   // dotstell brand purple
  cyan:   USE_COLOR ? '\x1b[36m'       : '',
  green:  USE_COLOR ? '\x1b[32m'       : '',
  yellow: USE_COLOR ? '\x1b[33m'       : '',
  red:    USE_COLOR ? '\x1b[31m'       : '',
}

function timestamp() {
  return c.dim + new Date().toLocaleTimeString('en-GB') + c.reset
}

// ── Ollama health check ───────────────────────────────────────────────────────
function checkOllama() {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path: '/', timeout: 2000 },
      (res) => { res.resume(); resolve(res.statusCode < 500) },
    )
    req.on('error',   () => resolve(false))
    req.on('timeout', () => { req.destroy(); resolve(false) })
  })
}

// ── Allowed origins ───────────────────────────────────────────────────────────
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

// ── Request log (skip /health — it's polled automatically every few seconds) ──
function logRequest(method, url, status) {
  if (url === '/health' || url === '/health/') return
  const statusColor = status < 400 ? c.green : c.red
  console.log(
    `  ${timestamp()}  ${c.dim}${method.padEnd(6)}${c.reset}` +
    `  ${c.cyan}${url}${c.reset}  ${statusColor}${status}${c.reset}`,
  )
}

// ── Server ────────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const origin = req.headers.origin ?? ''

  // CORS preflight
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res, origin)
    res.writeHead(204)
    res.end()
    return
  }

  // Health check
  if (req.url === '/health' || req.url === '/health/') {
    setCorsHeaders(res, origin)
    res.setHeader('Content-Type', 'application/json')
    res.writeHead(200)
    res.end(JSON.stringify({ status: 'ok', version: AGENT_VERSION, ollama: `http://${OLLAMA_HOST}:${OLLAMA_PORT}` }))
    return
  }

  // Proxy to Ollama
  const proxyHeaders = { ...req.headers, host: `${OLLAMA_HOST}:${OLLAMA_PORT}` }
  delete proxyHeaders['origin']
  delete proxyHeaders['referer']

  const proxyReq = http.request(
    { hostname: OLLAMA_HOST, port: OLLAMA_PORT, path: req.url, method: req.method, headers: proxyHeaders },
    (proxyRes) => {
      setCorsHeaders(res, origin)
      for (const [key, val] of Object.entries(proxyRes.headers)) {
        if (!key.toLowerCase().startsWith('access-control-')) res.setHeader(key, val)
      }
      res.writeHead(proxyRes.statusCode ?? 200)
      proxyRes.pipe(res, { end: true })
      logRequest(req.method, req.url, proxyRes.statusCode ?? 200)
    },
  )

  proxyReq.on('error', (err) => {
    setCorsHeaders(res, origin)
    res.setHeader('Content-Type', 'application/json')
    const isRefused = err.code === 'ECONNREFUSED'
    const status    = isRefused ? 503 : 502
    res.writeHead(status)
    res.end(JSON.stringify({
      error: isRefused
        ? `Ollama is not running at ${OLLAMA_HOST}:${OLLAMA_PORT}. Start Ollama and try again.`
        : `Ollama proxy error: ${err.message}`,
    }))
    logRequest(req.method, req.url, status)
  })

  req.pipe(proxyReq, { end: true })
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ${c.red}✗${c.reset}  Port ${AGENT_PORT} is already in use. Is the agent already running?\n`)
  } else {
    console.error(`\n  ${c.red}✗${c.reset}  Agent error: ${err.message}\n`)
  }
  process.exit(1)
})

server.listen(AGENT_PORT, '127.0.0.1', async () => {
  const ollamaUp = await checkOllama()
  const bar      = c.dim + '─'.repeat(48) + c.reset

  console.log()
  console.log(`  ${c.purple}●${c.reset} ${c.purple}${c.bold}dotstell${c.reset}  ${c.dim}Local AI Agent v${AGENT_VERSION}${c.reset}`)
  console.log()
  console.log(`  ${c.dim}Listening${c.reset}   ${c.cyan}http://127.0.0.1:${AGENT_PORT}${c.reset}`)
  if (ollamaUp) {
    console.log(`  ${c.dim}Proxying ${c.reset}   ${c.cyan}http://${OLLAMA_HOST}:${OLLAMA_PORT}${c.reset}   ${c.green}✓ Ollama is running${c.reset}`)
  } else {
    console.log(`  ${c.dim}Proxying ${c.reset}   ${c.cyan}http://${OLLAMA_HOST}:${OLLAMA_PORT}${c.reset}   ${c.yellow}⚠ Ollama not detected — start it before using AI features${c.reset}`)
  }
  console.log()
  console.log(`  ${c.dim}App   ${c.reset}  ${c.cyan}https://dotstell.app${c.reset}`)
  console.log(`  ${c.dim}GitHub${c.reset}  ${c.cyan}https://github.com/dotstell/dotstell${c.reset}  ${c.dim}· ★ star if it's useful${c.reset}`)
  console.log()
  console.log(`  ${bar}`)
  console.log(`  ${c.dim}Keep this running while using Ollama · Ctrl+C to stop${c.reset}`)
  console.log(`  ${bar}`)
  console.log()
})
