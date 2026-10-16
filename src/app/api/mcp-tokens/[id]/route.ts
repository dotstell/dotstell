import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// DELETE /api/mcp-tokens/[id]
// Revokes a token straight away. Deleting a token that is already revoked removes its row and activity.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID.test(id)) return NextResponse.json({ error: 'Invalid token id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: token, error } = await supabase
    .from('mcp_tokens')
    .select('id, revoked_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  if (!token) return NextResponse.json({ error: 'Token not found' }, { status: 404 })

  const action = token.revoked_at
    ? supabase.from('mcp_tokens').delete().eq('id', id).eq('user_id', user.id)
    : supabase.from('mcp_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id)
  const { error: actionError } = await action
  if (actionError) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return NextResponse.json({ ok: true, removed: !!token.revoked_at })
}
