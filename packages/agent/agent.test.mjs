import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn } from 'node:child_process'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { isAllowedHost, isAllowedOrigin, isAllowedRoute, parseExtraOrigins } from './guard.mjs'

const AGENT = fileURLToPath(new URL('./index.mjs', import.meta.url))
const AGENT_PORT = 41000 + Math.floor(Math.random() * 1000)
const OLLAMA_PORT = AGENT_PORT + 1000

let fakeOllama
let agent
const reached = []

function request(method, path, headers = {}, body) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: AGENT_PORT, method, path, agent: false, headers: { Host: `127.0.0.1:${AGENT_PORT}`, ...headers } }, res => {
      let data = ''
      res.on('data', c => (data += c))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }))
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

beforeAll(async () => {
  fakeOllama = http.createServer((req, res) => {
    reached.push(`${req.method} ${req.url}`)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{"ok":true}')
  })
  await new Promise(r => fakeOllama.listen(OLLAMA_PORT, '127.0.0.1', r))

  agent = spawn(process.execPath, [AGENT], {
    env: { ...process.env, DOTSTELL_AGENT_PORT: String(AGENT_PORT), OLLAMA_PORT: String(OLLAMA_PORT), DOTSTELL_ALLOWED_ORIGINS: 'https://notes.example.com, not a url' },
    stdio: 'ignore',
  })
  for (let i = 0; i < 50; i++) {
    try { if ((await request('GET', '/health')).status === 200) return } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 100))
  }
  throw new Error('agent did not start')
}, 15000)

afterAll(() => {
  agent?.kill()
  fakeOllama?.close()
})

describe('guard rules', () => {
  it('allows only dotstell origins, localhost and configured ones', () => {
    for (const o of ['https://dotstell.app', 'https://www.dotstell.com', 'http://localhost:3000', 'http://127.0.0.1:3100']) expect(isAllowedOrigin(o)).toBe(true)
    for (const o of ['https://evil.vercel.app', 'https://dotstell-abc-dotstell.vercel.app', 'https://dotstell.app.evil.com', 'http://dotstell.app',
      'https://evildotstell.app', 'null', '', undefined, 'http://localhost.evil.com']) expect(isAllowedOrigin(o)).toBe(false)
    expect(isAllowedOrigin('https://notes.example.com', parseExtraOrigins('https://notes.example.com/path, junk'))).toBe(true)
  })
  it('checks the Host header', () => {
    expect(isAllowedHost('127.0.0.1:12345', 12345)).toBe(true)
    expect(isAllowedHost('localhost:12345', 12345)).toBe(true)
    expect(isAllowedHost('attacker.example:12345', 12345)).toBe(false)
    expect(isAllowedHost('127.0.0.1:9999', 12345)).toBe(false)
    expect(isAllowedHost(undefined, 12345)).toBe(false)
  })
  it('lists only the endpoints dotstell uses', () => {
    for (const [m, p] of [['GET', '/api/tags'], ['POST', '/api/chat'], ['POST', '/api/embeddings?x=1'], ['GET', '/health/']]) expect(isAllowedRoute(m, p)).toBe(true)
    for (const [m, p] of [['POST', '/api/pull'], ['DELETE', '/api/delete'], ['POST', '/api/create'], ['POST', '/api/copy'], ['POST', '/api/push'], ['GET', '/'], ['POST', '/api/tags'], ['GET', '/api/chat']]) expect(isAllowedRoute(m, p)).toBe(false)
  })
})

describe('the running agent', () => {
  const json = { 'Content-Type': 'application/json' }

  it('serves dotstell.app and returns CORS headers for it', async () => {
    const before = reached.length
    const r = await request('POST', '/api/chat', { ...json, Origin: 'https://dotstell.app' }, '{"model":"m"}')
    expect(r.status).toBe(200)
    expect(r.headers['access-control-allow-origin']).toBe('https://dotstell.app')
    expect(reached.length).toBe(before + 1)
  })

  it('turns away an attacker site before anything reaches Ollama, even with a "simple" request', async () => {
    const before = reached.length
    for (const origin of ['https://evil.vercel.app', 'https://dotstell-x-dotstell.vercel.app', 'https://dotstell.app.evil.com', 'null']) {
      const r = await request('POST', '/api/generate', { 'Content-Type': 'text/plain', Origin: origin }, '{"model":"m","prompt":"x"}')
      expect(r.status, origin).toBe(403)
      expect(r.headers['access-control-allow-origin']).toBeUndefined()
    }
    expect(reached.length).toBe(before)
  })

  it('refuses a request whose Host is not the local address (DNS rebinding)', async () => {
    const before = reached.length
    const r = await request('POST', '/api/chat', { ...json, Host: `rebind.attacker.example:${AGENT_PORT}`, Origin: 'https://dotstell.app' }, '{}')
    expect(r.status).toBe(403)
    expect(reached.length).toBe(before)
  })

  it('refuses cross-site requests with no Origin, but not direct visits', async () => {
    expect((await request('GET', '/api/tags', { 'Sec-Fetch-Site': 'cross-site' })).status).toBe(403)
    expect((await request('GET', '/health', { 'Sec-Fetch-Site': 'none' })).status).toBe(200)
    expect((await request('GET', '/api/tags')).status).toBe(200)
  })

  it('does not proxy model pulling, creating or deleting, even for dotstell.app', async () => {
    const before = reached.length
    for (const [m, p] of [['POST', '/api/pull'], ['DELETE', '/api/delete'], ['POST', '/api/create'], ['POST', '/api/copy'], ['POST', '/api/push']]) {
      expect((await request(m, p, { ...json, Origin: 'https://dotstell.app' }, '{}')).status, `${m} ${p}`).toBe(403)
    }
    expect(reached.length).toBe(before)
  })

  it('answers preflight only for allowed origins', async () => {
    const ok = await request('OPTIONS', '/api/chat', { Origin: 'https://dotstell.app', 'Access-Control-Request-Method': 'POST' })
    expect(ok.status).toBe(204)
    expect(ok.headers['access-control-allow-private-network']).toBe('true')
    expect((await request('OPTIONS', '/api/chat', { Origin: 'https://evil.vercel.app', 'Access-Control-Request-Method': 'POST' })).status).toBe(403)
  })

  it('accepts an origin added with DOTSTELL_ALLOWED_ORIGINS', async () => {
    const r = await request('GET', '/api/tags', { Origin: 'https://notes.example.com' })
    expect(r.status).toBe(200)
    expect(r.headers['access-control-allow-origin']).toBe('https://notes.example.com')
  })
})
