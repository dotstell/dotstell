import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/ratelimit'
import { notebookTag } from '@/lib/notebooks'
import { containsActiveContent } from '@/lib/import/safety'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const IMPORT_TAG = /^imported-[A-Za-z0-9-]{1,40}$/

const MAX_NOTES_PER_REQUEST = 25
const MAX_HTML_LENGTH = 2_000_000
const MAX_TITLE_LENGTH = 500
const MAX_TAGS = 30
const MAX_TAG_LENGTH = 64
const MAX_NOTEBOOK_NAME = 100

interface IncomingNote {
  id: string
  title: string
  html: string
  tags: string[]
  notebook: string | null
  createdAt: string | null
  updatedAt: string | null
  pinned: boolean
  parentId: string | null
}


const validDate = (v: unknown): string | undefined =>
  typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : undefined

// POST /api/import/notes
// Body: { importTag, notes: IncomingNote[] }
//
// The client parses the files and assigns every note its id up front, so wikilinks inside the
// HTML already point at the right notes. The server therefore only creates rows. Everything the
// client sends is re-validated: ids, ownership of parents, sizes and tag counts.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`import-notes:${user.id}`, 120, 60_000)
  if (rl) return rl

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }

  if (typeof body.importTag !== 'string' || !IMPORT_TAG.test(body.importTag)) {
    return NextResponse.json({ error: 'Invalid import tag' }, { status: 400 })
  }
  if (!Array.isArray(body.notes) || body.notes.length === 0 || body.notes.length > MAX_NOTES_PER_REQUEST) {
    return NextResponse.json({ error: `Send between 1 and ${MAX_NOTES_PER_REQUEST} notes per request` }, { status: 400 })
  }

  const notes: IncomingNote[] = body.notes
  const ids = new Set<string>()
  for (const n of notes) {
    if (typeof n?.id !== 'string' || !UUID.test(n.id) || ids.has(n.id)) {
      return NextResponse.json({ error: 'Invalid note id' }, { status: 400 })
    }
    ids.add(n.id)
    if (typeof n.title !== 'string' || n.title.length > MAX_TITLE_LENGTH) {
      return NextResponse.json({ error: 'Invalid title' }, { status: 400 })
    }
    if (typeof n.html !== 'string' || n.html.length > MAX_HTML_LENGTH) {
      return NextResponse.json({ error: 'A note is too large to import (max 2 MB)' }, { status: 413 })
    }
    // The importer escapes scripts; anything that still looks active did not come from it.
    if (containsActiveContent(n.html)) {
      return NextResponse.json({ error: 'A note contains content that is not allowed (scripts or unsafe links).' }, { status: 400 })
    }
    if (!Array.isArray(n.tags) || n.tags.some(t => typeof t !== 'string')) {
      return NextResponse.json({ error: 'Invalid tags' }, { status: 400 })
    }
    if (n.notebook !== null && (typeof n.notebook !== 'string' || n.notebook.length > MAX_NOTEBOOK_NAME)) {
      return NextResponse.json({ error: 'Invalid notebook' }, { status: 400 })
    }
    if (n.parentId !== null && (typeof n.parentId !== 'string' || !UUID.test(n.parentId))) {
      return NextResponse.json({ error: 'Invalid parent' }, { status: 400 })
    }
  }

  // A parent outside this request must already exist and belong to this user.
  const outsideParents = [...new Set(notes.map(n => n.parentId).filter((p): p is string => !!p && !ids.has(p)))]
  const knownParents = new Set<string>()
  if (outsideParents.length) {
    const { data } = await supabase.from('notes').select('id').eq('user_id', user.id).in('id', outsideParents)
    for (const row of data ?? []) knownParents.add(row.id)
  }

  // Notebooks are created on first use; the unique (user, name) index makes this safe to repeat.
  const names = [...new Set(notes.map(n => n.notebook?.trim()).filter((n): n is string => !!n))]
  if (names.length) {
    const { count } = await supabase.from('notebooks').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    const { error: nbError } = await supabase.from('notebooks').upsert(
      names.map((name, i) => ({ user_id: user.id, name, icon: '📓', sort_order: (count ?? 0) + i })),
      { onConflict: 'user_id,name', ignoreDuplicates: true },
    )
    if (nbError) return NextResponse.json({ error: 'Could not create notebooks.' }, { status: 500 })
  }

  // Dates are always set explicitly. A bulk insert fills a column that only some rows provide
  // with NULL, not with the column default, which would leave notes without a creation date.
  const importedAt = new Date().toISOString()

  const rows = notes.map(n => {
    const tags = [...new Set([
      ...n.tags.map(t => t.trim().slice(0, MAX_TAG_LENGTH)).filter(Boolean).slice(0, MAX_TAGS),
      ...(n.notebook?.trim() ? [notebookTag(n.notebook.trim())] : []),
      body.importTag as string,
    ])]
    return {
      id: n.id,
      user_id: user.id,
      title: n.title,
      content: n.html,
      type: 'markdown',
      tags,
      parent_id: n.parentId && (ids.has(n.parentId) || knownParents.has(n.parentId)) ? n.parentId : null,
      pinned: n.pinned === true,
      created_at: validDate(n.createdAt) ?? importedAt,
      updated_at: validDate(n.updatedAt) ?? validDate(n.createdAt) ?? importedAt,
    }
  })

  const { error } = await supabase.from('notes').insert(rows)
  if (error) {
    // 23505: one of the client-chosen ids already exists, which means this batch was sent twice.
    if (error.code === '23505') return NextResponse.json({ error: 'These notes were already imported.' }, { status: 409 })
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
  return NextResponse.json({ created: rows.length }, { status: 201 })
}
