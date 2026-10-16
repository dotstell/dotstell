import { createClient } from '@supabase/supabase-js'
import { McpAuthError, McpUnavailableError, ToolInputError, type McpDatabase } from './tools'

/**
 * The database as the MCP endpoint sees it: the public anon key and nothing else. There is no session and no
 * service-role key; every function it can call checks the token itself (supabase/migrations/012_mcp.sql).
 */
export function createMcpDatabase(): McpDatabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new McpUnavailableError()

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
  })

  return {
    async call(fn, params) {
      const { data, error } = await client.rpc(fn, params)
      if (!error) return data
      throw toMcpError(fn, error)
    },
  }
}

/**
 * Turns a database error into the error the endpoint understands. Nothing from `error.message` or the call
 * parameters is logged or passed on, because either can carry the token.
 */
export function toMcpError(fn: string, error: { code?: string; message: string }): Error {
  if (error.code === '28000' || error.message.includes('invalid_token')) return new McpAuthError()
  if (error.message.includes('invalid_status')) return new ToolInputError('"status" must be todo, in_progress or done.')
  if (error.code === 'PGRST202' || error.code === '42883') return new McpUnavailableError()
  console.error(`mcp: ${fn} failed (${error.code ?? 'no code'})`)
  return new Error('database_error')
}
