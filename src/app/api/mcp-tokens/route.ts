import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'
import { DEFAULT_TOKEN_DAYS, MAX_ACTIVE_TOKENS, MAX_TOKEN_DAYS, generateToken } from '@/lib/mcp/token'

// Tokens that let AI tools read this user's notes (see docs/MCP.md). Everything here runs as the signed-in user, so
// row-level security keeps each user to their own tokens. Only a hash is stored; the token is returned once, on creation.

const NO_STORE = { 'Cache-Control': 'no-store' }

/** Postgres and PostgREST codes for "the table does not exist", i.e. migration 012 has not been applied. */
const isMissingTable = (code?: string) => code === '42P01' || code === 'PGRST205'

const NOT_SET_UP = 'MCP access is not set up on this server yet. Run supabase/migrations/012_mcp.sql.'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('mcp_tokens')
    .select('id, name, prefix, expires_at, revoked_at, last_used_at, use_count, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingTable(error.code)) return NextResponse.json({ error: NOT_SET_UP, notSetUp: true }, { status: 503 })
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
  return NextResponse.json(data, { headers: NO_STORE })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = rateLimit(`mcp-token-create:${user.id}`, 10, 60_000)
  if (limited) return limited

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (name.length < 1 || name.length > 60) return NextResponse.json({ error: 'Give the token a name of 1 to 60 characters.' }, { status: 400 })
  const days = body?.days === undefined ? DEFAULT_TOKEN_DAYS : body.days
  if (!Number.isInteger(days) || days < 1 || days > MAX_TOKEN_DAYS) {
    return NextResponse.json({ error: `Expiry must be between 1 and ${MAX_TOKEN_DAYS} days.` }, { status: 400 })
  }

  const { count, error: countError } = await supabase
    .from('mcp_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
  if (countError) {
    if (isMissingTable(countError.code)) return NextResponse.json({ error: NOT_SET_UP, notSetUp: true }, { status: 503 })
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
  if ((count ?? 0) >= MAX_ACTIVE_TOKENS) {
    return NextResponse.json({ error: `You can have ${MAX_ACTIVE_TOKENS} active tokens. Revoke one you no longer use first.` }, { status: 409 })
  }

  const { token, hash, prefix } = generateToken()
  const expiresAt = new Date(Date.now() + days * 86_400_000).toISOString()
  const { data, error } = await supabase
    .from('mcp_tokens')
    .insert({ user_id: user.id, name, token_hash: hash, prefix, expires_at: expiresAt })
    .select('id, name, prefix, expires_at, created_at')
    .single()

  if (error || !data) return NextResponse.json({ error: 'Could not create the token.' }, { status: 500 })
  return NextResponse.json({ ...data, token }, { status: 201, headers: NO_STORE })
}
