import type { SupabaseClient } from '@supabase/supabase-js'

const CHUNK = 100
const MAX_DEPTH = 50

/**
 * notes.parent_id is declared "on delete cascade", so permanently deleting a parent would also
 * destroy its sub-notes, including ones the user restored or kept working on. Before a note is
 * removed for good, its sub-notes that are still active are detached (they become top-level notes).
 * Sub-notes that are themselves in the trash are left alone and go with their parent.
 */
// Supabase's generated table types are not available here, so the client is typed loosely.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function detachActiveChildren(supabase: SupabaseClient<any, any, any>, userId: string, parentIds: string[]) {
  for (let i = 0; i < parentIds.length; i += CHUNK) {
    await supabase
      .from('notes')
      .update({ parent_id: null })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .in('parent_id', parentIds.slice(i, i + CHUNK))
  }
}

/**
 * Would making `parentId` the parent of `noteId` create a loop (a note inside itself, or inside one of
 * its own sub-notes)? Walks up from the proposed parent; the loop is bounded for safety.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function wouldCreateCycle(supabase: SupabaseClient<any, any, any>, userId: string, noteId: string, parentId: string): Promise<boolean> {
  let current: string | null = parentId
  for (let depth = 0; current && depth < MAX_DEPTH; depth++) {
    if (current === noteId) return true
    const result: { data: { parent_id: string | null } | null } = await supabase
      .from('notes').select('parent_id').eq('id', current).eq('user_id', userId).maybeSingle()
    current = result.data?.parent_id ?? null
  }
  // Deeper than any real outline: treat as a loop rather than risk making one.
  return current !== null
}
