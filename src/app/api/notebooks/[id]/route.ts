import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { notebookFieldError, notebookTag, retagNotes, tagCollides } from '@/lib/notebooks'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
  const invalid = notebookFieldError(body)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })
  const allowed: Record<string, unknown> = {}
  let renamedFrom: string | null = null
  if (body.name !== undefined) {
    const trimmed = (body.name as string).trim()
    const { data: current } = await supabase.from('notebooks').select('name').eq('id', id).eq('user_id', user.id).single()
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (await tagCollides(supabase, user.id, trimmed, id)) return NextResponse.json({ error: 'A notebook with this name already exists.' }, { status: 409 })
    allowed.name = trimmed
    renamedFrom = current.name
  }
  if (body.color !== undefined) allowed.color = body.color
  if (body.icon !== undefined) allowed.icon = body.icon
  if (body.sort_order !== undefined) allowed.sort_order = body.sort_order
  // Explicit timestamp: DB trigger is authoritative but this covers environments
  // where 007_notebooks_constraints.sql hasn't been applied yet.
  allowed.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('notebooks')
    .update(allowed)
    .eq('id', id)
    .eq('user_id', user.id) // ownership check in addition to RLS — defense-in-depth
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'A notebook with this name already exists.' }, { status: 409 })
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
  // Membership is a tag derived from the name, so notes follow the notebook to its new name.
  if (renamedFrom !== null) await retagNotes(supabase, user.id, notebookTag(renamedFrom), notebookTag(allowed.name as string))
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Fetch name first so we can compute the tag to strip from notes.
  const { data: notebook } = await supabase
    .from('notebooks')
    .select('name')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!notebook) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Membership is stored as a tag on notes (e.g. "nb:my-notebook").
  // Active notes are moved to trash; already-trashed notes just have the tag stripped
  // so they don't ghost-join a future notebook with the same name when restored.
  const tag = notebookTag(notebook.name)
  const now = new Date().toISOString()

  const [{ data: activeNotes }, { data: trashedNotes }] = await Promise.all([
    supabase.from('notes').select('id, tags').eq('user_id', user.id).is('deleted_at', null).contains('tags', [tag]),
    supabase.from('notes').select('id, tags').eq('user_id', user.id).not('deleted_at', 'is', null).contains('tags', [tag]),
  ])

  const updates: Promise<unknown>[] = []
  for (const note of (activeNotes ?? [])) {
    updates.push(Promise.resolve(
      supabase.from('notes')
        .update({ deleted_at: now, tags: (note.tags as string[]).filter(t => t !== tag) })
        .eq('id', note.id).eq('user_id', user.id)
    ))
  }
  for (const note of (trashedNotes ?? [])) {
    updates.push(Promise.resolve(
      supabase.from('notes')
        .update({ tags: (note.tags as string[]).filter(t => t !== tag) })
        .eq('id', note.id).eq('user_id', user.id)
    ))
  }
  if (updates.length > 0) await Promise.all(updates)

  const { error } = await supabase
    .from('notebooks')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
