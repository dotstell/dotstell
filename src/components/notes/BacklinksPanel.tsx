'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, ArrowDownLeft, FileText } from 'lucide-react'

interface LinkNote {
  id: string
  title: string
  updated_at: string
}

interface WikiLinksPanelProps {
  noteId: string
  /** Pass the list of outgoing wikilink noteIds from the editor so we can show them without a DB round-trip */
  outgoingIds?: string[]
}

export function BacklinksPanel({ noteId }: WikiLinksPanelProps) {
  const router = useRouter()
  const [outgoing, setOutgoing] = useState<LinkNote[]>([])
  const [incoming, setIncoming] = useState<LinkNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!noteId) return
    setLoading(true)

    Promise.all([
      // Outgoing: notes this note [[links]] to
      fetch(`/api/notes/${noteId}/wikilinks`).then(r => r.ok ? r.json() : []),
      // Incoming: notes that [[link]] to this note
      fetch(`/api/notes/${noteId}/backlinks`).then(r => r.ok ? r.json() : []),
    ]).then(([out, inc]) => {
      setOutgoing(Array.isArray(out) ? out : [])
      setIncoming(Array.isArray(inc) ? inc : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [noteId])

  const totalCount = outgoing.length + incoming.length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Wikilinks
        </span>
        {!loading && (
          <span style={{ fontSize: 10, color: 'var(--sidebar-muted)', background: 'var(--muted)', padding: '1px 6px', borderRadius: 10 }}>
            {totalCount}
          </span>
        )}
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
        </>
      )}
    </div>
  )
}

function SectionLabel({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
      <span style={{ color: 'var(--primary)', display: 'flex' }}>{icon}</span>
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
