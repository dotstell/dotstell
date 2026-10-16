import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/ratelimit'
import { createMcpDatabase } from '@/lib/mcp/database'
import { clientIp, isBlocked, recordFailure } from '@/lib/mcp/guard'
import { MAX_BATCH, handleMessage, type RpcResponse } from '@/lib/mcp/server'
import { McpAuthError, McpUnavailableError } from '@/lib/mcp/tools'
import { bearerToken, hashToken } from '@/lib/mcp/token'

// POST /api/mcp - the Model Context Protocol endpoint (Streamable HTTP, stateless, JSON replies).
// Design and threat model: docs/MCP.md. Authentication is a personal token in the Authorization header, checked inside
// the database; this route never holds a user session or a service-role key.
export const maxDuration = 30

/** Largest request body accepted. */
const MAX_BODY_BYTES = 64 * 1024

const HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }

const reply = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...HEADERS, ...extra } })

const rpcError = (status: number, code: number, message: string, extra: Record<string, string> = {}) =>
  reply({ jsonrpc: '2.0', id: null, error: { code, message } }, status, extra)

export async function POST(req: NextRequest) {
  // A browser always sends Origin. MCP tools are not browsers, so refusing it stops a web page from using a
  // visitor's machine to reach the endpoint (DNS rebinding), as the MCP specification requires.
  if (req.headers.has('origin')) return rpcError(403, -32600, 'Browser requests are not allowed.')

  const ip = clientIp(req.headers)
  if (isBlocked(ip)) return rpcError(429, -32600, 'Too many failed attempts. Try again later.', { 'Retry-After': '600' })

  const token = bearerToken(req.headers.get('authorization'))
  if (!token) {
    recordFailure(ip)
    return rpcError(401, -32600, 'A valid dotstell token is required.', { 'WWW-Authenticate': 'Bearer realm="dotstell"' })
  }

  const limited = rateLimit(`mcp:${hashToken(token)}`, 60, 60_000)
  if (limited) return limited

  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) return rpcError(413, -32600, 'Request is too large.')
  const raw = await req.text()
  if (raw.length > MAX_BODY_BYTES) return rpcError(413, -32600, 'Request is too large.')

  let body: unknown
  try { body = JSON.parse(raw) } catch { return rpcError(400, -32700, 'Parse error') }

  try {
    const db = createMcpDatabase()
    if (Array.isArray(body)) {
      if (body.length === 0 || body.length > MAX_BATCH) return rpcError(400, -32600, `A batch holds 1 to ${MAX_BATCH} messages.`)
      const replies = (await Promise.all(body.map(m => handleMessage(m, token, db)))).filter((r): r is RpcResponse => r !== null)
      return replies.length ? reply(replies) : new NextResponse(null, { status: 202, headers: HEADERS })
    }
    const response = await handleMessage(body, token, db)
    return response ? reply(response) : new NextResponse(null, { status: 202, headers: HEADERS })
  } catch (err) {
    if (err instanceof McpAuthError) {
      recordFailure(ip)
      return rpcError(401, -32600, 'That token is not valid. It may have expired or been revoked.', { 'WWW-Authenticate': 'Bearer realm="dotstell", error="invalid_token"' })
    }
    if (err instanceof McpUnavailableError) return rpcError(503, -32603, 'MCP is not set up on this server.')
    // Our own errors never contain the token (database errors are mapped without their text), so the message is safe to log.
    console.error(`mcp: unexpected ${err instanceof Error ? `${err.name}: ${err.message}` : 'error'}`)
    return rpcError(500, -32603, 'Something went wrong.')
  }
}

const notAllowed = () => new NextResponse(null, { status: 405, headers: { ...HEADERS, Allow: 'POST' } })

// This server never streams to the client or keeps sessions, so there is nothing to GET or DELETE.
export const GET = notAllowed
export const DELETE = notAllowed
