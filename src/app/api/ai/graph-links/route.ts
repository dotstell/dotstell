import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit }    from '@/lib/ratelimit'
import { AIConfig } from '@/lib/ai/types'

// POST /api/ai/graph-links
// Body: { config, mode: 'missing' | 'clusters' | 'gaps' }
// Graph intelligence features:
//   missing  — notes with high semantic similarity but no wikilink between them
//   clusters — group orphaned notes by similarity (returns cluster labels)
//   gaps     — find note pairs that are highly connected but missing a bridging note
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(`ai-graph:${user.id}`, 10, 60_000)
  if (rl) return rl

  const body: {
    config: AIConfig
    mode:   'missing' | 'clusters' | 'gaps'
    limit?: number
  } = await req.json()

  const limit = Math.min(body.limit ?? 10, 20)

  try {
    if (body.mode === 'missing') {
      return await findMissingLinks(supabase, user.id, limit)
    } else if (body.mode === 'clusters') {
      return await findClusters(supabase, user.id, limit)
    } else if (body.mode === 'gaps') {
      return await findGaps(supabase, user.id, limit)
    }
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Graph analysis failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}

// Find notes that are semantically similar but not yet wikilinked to each other.
// Uses a self-join on the vector column to find close pairs.
async function findMissingLinks(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  userId: string,
  limit: number,
) {
  // Fetch all existing wikilinks so we can exclude already-linked pairs
  const { data: links } = await supabase
    .from('knowledge_links')
    .select('source_id, target_id')
    .eq('user_id', userId)
    .eq('source_type', 'note')
    .eq('target_type', 'note')

  const linkedPairs = new Set<string>()
  for (const l of links ?? []) {
    linkedPairs.add(`${l.source_id}-${l.target_id}`)
    linkedPairs.add(`${l.target_id}-${l.source_id}`)
  }

  // Use the match_notes function to find similar note pairs via pgvector
  const { data: notes } = await supabase
    .from('notes')
    .select('id, title, embedding')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .not('embedding', 'is', null)
    .limit(200)

  if (!notes?.length) return NextResponse.json([])

  const suggestions: Array<{ source: { id: string; title: string }; target: { id: string; title: string }; similarity: number }> = []

  // For each note, find its closest semantic neighbour not already linked
  for (const note of notes.slice(0, 50)) {
    const { data: similar } = await supabase.rpc('match_notes', {
      query_embedding: note.embedding,
      user_id_param:   userId,
      match_count:     3,
      match_threshold: 0.7,   // high threshold — only very similar, definitely related
    })
    if (!similar) continue
    for (const s of similar) {
      if (s.id === note.id) continue
      const key = [note.id, s.id].sort().join('-')
      if (linkedPairs.has(`${note.id}-${s.id}`)) continue
      if (suggestions.some(sg => [sg.source.id, sg.target.id].sort().join('-') === key)) continue
      suggestions.push({
        source:     { id: note.id, title: note.title || 'Untitled' },
        target:     { id: s.id,    title: s.title    || 'Untitled' },
        similarity: Math.round(s.similarity * 100),
      })
    }
    if (suggestions.length >= limit) break
  }

  return NextResponse.json(suggestions.slice(0, limit))
}

// Find orphaned notes (no links) and group by semantic proximity.
async function findClusters(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  userId: string,
  limit: number,
) {
  const { data: linked } = await supabase
    .from('knowledge_links')
    .select('source_id, target_id')
    .eq('user_id', userId)

  const linkedIds = new Set<string>()
  for (const l of linked ?? []) { linkedIds.add(l.source_id); linkedIds.add(l.target_id) }

  const { data: notes } = await supabase
    .from('notes')
    .select('id, title, tags, embedding')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .not('embedding', 'is', null)
    .limit(300)

  const orphans = (notes ?? []).filter(n => !linkedIds.has(n.id))
  if (orphans.length < 2) return NextResponse.json([])

  // Simple greedy clustering: pick the first unassigned note as a cluster centre,
  // add all notes within 0.6 cosine similarity to the cluster, repeat.
  const assigned = new Set<string>()
  const clusters: Array<{ label: string; notes: Array<{ id: string; title: string }> }> = []

  for (const seed of orphans) {
    if (assigned.has(seed.id)) continue
    const cluster: Array<{ id: string; title: string }> = [{ id: seed.id, title: seed.title || 'Untitled' }]
    assigned.add(seed.id)

    const { data: similar } = await supabase.rpc('match_notes', {
      query_embedding: seed.embedding,
      user_id_param:   userId,
      match_count:     10,
      match_threshold: 0.6,
    })
    for (const s of similar ?? []) {
      if (s.id === seed.id || assigned.has(s.id)) continue
      if (!orphans.find(o => o.id === s.id)) continue  // only orphans
      cluster.push({ id: s.id, title: s.title || 'Untitled' })
      assigned.add(s.id)
    }

    if (cluster.length > 1) {
      clusters.push({ label: seed.title || 'Untitled', notes: cluster })
    }
    if (clusters.length >= limit) break
  }

  return NextResponse.json(clusters)
}

// Find notes that share many links to the same neighbours but no direct link to each other.
// These are "gap" pairs — potential bridge note candidates.
async function findGaps(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  userId: string,
  limit: number,
) {
  const { data: links } = await supabase
    .from('knowledge_links')
    .select('source_id, target_id')
    .eq('user_id', userId)
    .eq('source_type', 'note')
    .eq('target_type', 'note')

  if (!links?.length) return NextResponse.json([])

  // Build adjacency sets
  const adj = new Map<string, Set<string>>()
  const directPairs = new Set<string>()
  for (const l of links) {
    if (!adj.has(l.source_id)) adj.set(l.source_id, new Set())
    if (!adj.has(l.target_id)) adj.set(l.target_id, new Set())
    adj.get(l.source_id)!.add(l.target_id)
    adj.get(l.target_id)!.add(l.source_id)
    directPairs.add(`${l.source_id}-${l.target_id}`)
    directPairs.add(`${l.target_id}-${l.source_id}`)
  }

  const ids = [...adj.keys()]
  if (ids.length < 2) return NextResponse.json([])

  // Fetch titles for display
  const { data: noteMeta } = await supabase
    .from('notes')
    .select('id, title')
    .in('id', ids)
    .eq('user_id', userId)
  const titleMap = new Map((noteMeta ?? []).map(n => [n.id, n.title || 'Untitled']))

  // Find pairs with many shared neighbours but no direct link
  const gaps: Array<{ a: { id: string; title: string }; b: { id: string; title: string }; shared: number }> = []

  for (let i = 0; i < ids.length && gaps.length < limit; i++) {
    for (let j = i + 1; j < ids.length && gaps.length < limit; j++) {
      const a = ids[i]; const b = ids[j]
      if (directPairs.has(`${a}-${b}`)) continue  // already linked
      const setA = adj.get(a)!; const setB = adj.get(b)!
      const shared = [...setA].filter(n => setB.has(n)).length
      if (shared >= 2) {
        gaps.push({
          a:      { id: a, title: titleMap.get(a) ?? 'Untitled' },
          b:      { id: b, title: titleMap.get(b) ?? 'Untitled' },
          shared,
        })
      }
    }
  }

  gaps.sort((a, b) => b.shared - a.shared)
  return NextResponse.json(gaps.slice(0, limit))
}
