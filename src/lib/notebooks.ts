import type { SupabaseClient } from '@supabase/supabase-js'

export const MAX_NOTEBOOK_NAME = 100

/** Notes belong to a notebook through a tag derived from its name, e.g. "Work Stuff" -> "nb:work-stuff". */
export const notebookTag = (name: string) => `nb:${name.trim().toLowerCase().replace(/\s+/g, '-')}`

/** Returns an error message for an invalid notebook field, or null. Only fields present in `body` are checked. */
export function notebookFieldError(body: Record<string, unknown>): string | null {
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) return 'Name required'
    if (body.name.trim().length > MAX_NOTEBOOK_NAME) return `Name must be ${MAX_NOTEBOOK_NAME} characters or fewer`
  }
  if (body.color != null && (typeof body.color !== 'string' || body.color.length > 50)) return 'Invalid color'
  if (body.icon != null && (typeof body.icon !== 'string' || body.icon.length > 16)) return 'Invalid icon'
  if (body.sort_order != null && !Number.isFinite(body.sort_order)) return 'Invalid sort order'
  return null
}

/** Another notebook of this user whose name maps to the same tag would silently share its notes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function tagCollides(supabase: SupabaseClient<any, any, any>, userId: string, name: string, exceptId?: string): Promise<boolean> {
  const { data } = await supabase.from('notebooks').select('id, name').eq('user_id', userId)
  const tag = notebookTag(name)
  return (data ?? []).some((n: { id: string; name: string }) => n.id !== exceptId && notebookTag(n.name) === tag)
}

/** Move every note (active or trashed) from one notebook tag to another, e.g. after a rename. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function retagNotes(supabase: SupabaseClient<any, any, any>, userId: string, from: string, to: string) {
  if (from === to) return
  const { data } = await supabase.from('notes').select('id, tags').eq('user_id', userId).contains('tags', [from])
  for (const note of (data ?? []) as { id: string; tags: string[] }[]) {
    const tags = [...new Set(note.tags.map(t => (t === from ? to : t)))]
    await supabase.from('notes').update({ tags }).eq('id', note.id).eq('user_id', userId)
  }
}
