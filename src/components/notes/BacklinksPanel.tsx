'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, ArrowDownLeft, FileText, Link2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface LinkNote {
  id: string
  title: string
  updated_at: string
}

interface Props {
  noteId: string
  /** Current note title — used to decide when to re-query unlinked mentions */
  noteTitle?: string
  /** Increments each time wikilinks are synced after a save — triggers a re-fetch */
  syncCount?: number
}

export function BacklinksPanel({ noteId, noteTitle, syncCount }: Props) {
  const router = useRouter()
  const [outgoing,  setOutgoing]  = useState<LinkNote[]>([])
  const [incoming,  setIncoming]  = useState<LinkNote[]>([])
  const [unlinked,  setUnlinked]  = useState<LinkNote[]>([])
  const [loading,   setLoading]   = useState(true)
  const [linking,   setLinking]   = useState<string | null>(null)

  const load = useCallback(() => {
    if (!noteId) return
    setLoading(true)
    Promise.all([
      fetch(`/api/notes/${noteId}/wikilinks`).then(r => r.ok ? r.json() : []),
      fetch(`/api/notes/${noteId}/backlinks`).then(r => r.ok ? r.json() : []),
      fetch(`/api/notes/${noteId}/unlinked-mentions`).then(r => r.ok ? r.json() : []),
    ]).then(([out, inc, unl]) => {
      setOutgoing(Array.isArray(out) ? out : [])
      setIncoming(Array.isArray(inc) ? inc : [])
      setUnlinked(Array.isArray(unl) ? unl : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [noteId])

  useEffect(() => { load() }, [load, syncCount])

  // Re-fetch unlinked mentions when the note's title changes (debounced)
  useEffect(() => {
    if (!noteId || !noteTitle) return
    const t = setTimeout(() => {
      fetch(`/api/notes/${noteId}/unlinked-mentions`)
        .then(r => r.ok ? r.json() : [])
        .then(unl => setUnlinked(Array.isArray(unl) ? unl : []))
        .catch(() => {})
    }, 1200)
    return () => clearTimeout(t)
  }, [noteId, noteTitle])

  async function linkNote(sourceId: string, sourceTitle: string) {
    setLinking(sourceId)
    try {
      // Fetch the source note's current content
      const noteRes = await fetch(`/api/notes/${sourceId}`)
      if (!noteRes.ok) throw new Error('fetch failed')
      const sourceNote = await noteRes.json()

      // Append a wikilink as a new paragraph — works regardless of what block type the note ends with
      const wikiLinkHtml = `<a data-wikilink data-note-id="${noteId}" data-note-title="${noteTitle ?? ''}">${'[['}${noteTitle ?? 'Untitled'}${']]'}</a>`
      const trimmed = (sourceNote.content ?? '').trim()
      const newContent = trimmed && trimmed !== '<p></p>'
        ? `${trimmed}<p>${wikiLinkHtml}</p>`
        : `<p>${wikiLinkHtml}</p>`

      // Save updated content
      const patchRes = await fetch(`/api/notes/${sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newContent }),
      })
      if (!patchRes.ok) throw new Error('patch failed')

      // Re-parse the new content to collect ALL wikilink IDs (existing + newly added) before
      // syncing — the wikilinks endpoint does a replace-all, so sending only the new ID
      // would delete the source note's other outgoing links.
      const parser = new DOMParser()
      const doc = parser.parseFromString(newContent, 'text/html')
      const wlNodes = doc.querySelectorAll('[data-wikilink]')
      const targetNoteIds = Array.from(wlNodes).map(el => el.getAttribute('data-note-id')).filter(Boolean) as string[]

      await fetch('/api/wikilinks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceNoteId: sourceId, targetNoteIds }),
      })

      // Move this note from unlinked → incoming
      setUnlinked(prev => prev.filter(n => n.id !== sourceId))
      setIncoming(prev => [...prev, { id: sourceId, title: sourceTitle, updated_at: new Date().toISOString() }])
      toast.success(`Linked from "${sourceTitle}"`)
    } catch {
      toast.error('Could not create link — try again')
    } finally {
      setLinking(null)
    }
  }

  const totalCount = outgoing.length + incoming.length

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Wikilinks
        </span>
        {!loading && (
          <span style={{ fontSize: 10, color: 'var(--sidebar-muted)', background: 'var(--muted)', padding: '1px 6px', borderRadius: 10 }}>
            {totalCount}
          </span>
        )}
        <button
          type="button"
          onClick={load}
          title="Refresh"
          style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 2, borderRadius: 4, display: 'flex' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
        >
          <RefreshCw size={11} />
        </button>
      </div>

      {loading ? (
        <p style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Loading…</p>
      ) : (
        <>
          {/* Outgoing */}
          <SectionLabel icon={<ArrowUpRight size={11} />} label="Links to" count={outgoing.length} />
          {outgoing.length === 0
            ? <EmptyNote>Type [[ in the editor to link a note.</EmptyNote>
            : <NoteList notes={outgoing} onOpen={id => router.push(`/notes/${id}`)} />
          }

          {/* Incoming */}
          <div style={{ marginTop: 10 }}>
            <SectionLabel icon={<ArrowDownLeft size={11} />} label="Linked from" count={incoming.length} />
            {incoming.length === 0
              ? <EmptyNote>No other notes link here yet.</EmptyNote>
              : <NoteList notes={incoming} onOpen={id => router.push(`/notes/${id}`)} />
            }
          </div>

          {/* Unlinked mentions */}
          {unlinked.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <SectionLabel icon={<Link2 size={11} />} label="Unlinked mentions" count={unlinked.length} accent />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {unlinked.map(note => (
                  <div
                    key={note.id}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderRadius: 6 }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <FileText size={11} color="var(--muted-foreground)" style={{ flexShrink: 0 }} />
                    <button
                      type="button"
                      onClick={() => router.push(`/notes/${note.id}`)}
                      style={{
                        flex: 1, background: 'none', border: 'none', cursor: 'pointer',
                        textAlign: 'left', padding: 0,
                        fontSize: 12, color: 'var(--secondary-foreground)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {note.title || 'Untitled'}
                    </button>
                    <button
                      type="button"
                      onClick={() => linkNote(note.id, note.title)}
                      disabled={linking === note.id}
                      title="Convert to wikilink"
                      style={{
                        flexShrink: 0, background: 'none', border: '1px solid var(--border)',
                        borderRadius: 4, cursor: linking === note.id ? 'wait' : 'pointer',
                        padding: '2px 6px', fontSize: 10,
                        color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 3,
                        opacity: linking === note.id ? 0.5 : 1,
                        transition: 'all 0.12s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, var(--primary) 12%, transparent)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                    >
                      <Link2 size={9} /> Link
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SectionLabel({ icon, label, count, accent }: { icon: React.ReactNode; label: string; count: number; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
      <span style={{ color: accent ? 'var(--muted-foreground)' : 'var(--primary)', display: 'flex' }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--sidebar-section-fg)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </span>
      <span style={{ fontSize: 10, color: 'var(--sidebar-muted)', background: 'var(--muted)', padding: '0 5px', borderRadius: 8 }}>
        {count}
      </span>
    </div>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 11, color: 'var(--muted-foreground)', fontStyle: 'italic', margin: '0 0 2px' }}>{children}</p>
}

function NoteList({ notes, onOpen }: { notes: LinkNote[]; onOpen: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {notes.map(note => (
        <button
          key={note.id}
          type="button"
          onClick={() => onOpen(note.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '5px 6px', borderRadius: 6, border: 'none',
            background: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <FileText size={11} color="var(--primary)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--secondary-foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {note.title || 'Untitled'}
          </span>
        </button>
      ))}
    </div>
  )
}
