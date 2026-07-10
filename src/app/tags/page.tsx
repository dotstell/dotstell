'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Tag, FileText, Users, Bookmark, CheckSquare } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/layout/PageHeader'

interface TagGroup {
  tag: string
  items: { id: string; type: string; label: string }[]
}

const TYPE_ICON: Record<string, React.ElementType> = {
  note: FileText, person: Users, bookmark: Bookmark, task: CheckSquare,
}
const TYPE_COLOR: Record<string, string> = {
  note: '#7c6aff', person: '#10b981', bookmark: '#f59e0b', task: '#ef4444',
}
const TYPE_HREF: Record<string, (id: string) => string> = {
  note: () => '/notes', person: (id) => `/people/${id}`, bookmark: () => '/bookmarks', task: () => '/tasks',
}

export default function TagsPage() {
  const [groups, setGroups]       = useState<TagGroup[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [nr, pr, br, tr] = await Promise.all([
        fetch('/api/notes'), fetch('/api/people'), fetch('/api/bookmarks'), fetch('/api/tasks'),
      ])
      const [notes, people, bookmarks, tasks] = await Promise.all([
        nr.ok ? nr.json() : [], pr.ok ? pr.json() : [], br.ok ? br.json() : [], tr.ok ? tr.json() : [],
      ])

      const tagMap = new Map<string, { id: string; type: string; label: string }[]>()

      function addItems(items: { id: string; tags: string[]; title?: string; name?: string }[], type: string) {
        for (const item of (Array.isArray(items) ? items : [])) {
          const label = item.title ?? item.name ?? 'Untitled'
          for (const tag of (item.tags ?? [])) {
            if (!tagMap.has(tag)) tagMap.set(tag, [])
            tagMap.get(tag)!.push({ id: item.id, type, label })
          }
        }
      }

      addItems(notes, 'note')
      addItems(people, 'person')
      addItems(bookmarks, 'bookmark')
      addItems(tasks, 'task')

      const sorted = Array.from(tagMap.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .map(([tag, items]) => ({ tag, items }))

      setGroups(sorted)
      if (sorted.length > 0) setSelected(sorted[0].tag)
      setLoading(false)
    }
    load()
  }, [])

  const selectedGroup = groups.find(g => g.tag === selected)

  return (
    <AppLayout>
      <div style={{ padding: '32px', maxWidth: 1100, margin: 0 }}>
        <PageHeader title="Tags" description="Browse your knowledge by tag" />

        {loading ? (
          <p style={{ color: '#6b6b88', fontSize: 13 }}>Loading...</p>
        ) : groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0' }}>
            <Tag size={36} color="#3a3a5e" style={{ marginBottom: 12 }} />
            <p style={{ color: '#6b6b88', fontSize: 14 }}>No tags yet</p>
            <p style={{ color: '#3a3a5e', fontSize: 12, marginTop: 4 }}>Add tags to your notes, people, tasks or bookmarks and they&apos;ll appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20 }}>
            {/* Tag list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {groups.map(({ tag, items }) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelected(tag)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    backgroundColor: selected === tag ? 'rgba(124,106,255,0.12)' : 'transparent',
                    color: selected === tag ? '#7c6aff' : '#a0a0b8',
                    textAlign: 'left', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (selected !== tag) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { if (selected !== tag) e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag size={13} />
                    <span style={{ fontSize: 13, fontWeight: selected === tag ? 600 : 400 }}>{tag}</span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    backgroundColor: selected === tag ? '#7c6aff33' : '#2a2a3e',
                    color: selected === tag ? '#7c6aff' : '#6b6b88',
                    padding: '1px 7px', borderRadius: 99,
                  }}>{items.length}</span>
                </button>
              ))}
            </div>

            {/* Items in selected tag */}
            <div style={{ backgroundColor: '#12121a', border: '1px solid #2a2a3e', borderRadius: 12, overflow: 'hidden' }}>
              {selectedGroup && (
                <>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #2a2a3e', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag size={14} color="#7c6aff" />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f0' }}>{selectedGroup.tag}</span>
                    <span style={{ fontSize: 12, color: '#6b6b88' }}>— {selectedGroup.items.length} item{selectedGroup.items.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ padding: '8px' }}>
                    {selectedGroup.items.map(item => {
                      const Icon = TYPE_ICON[item.type] ?? FileText
                      const color = TYPE_COLOR[item.type] ?? '#7c6aff'
                      const href = TYPE_HREF[item.type]?.(item.id) ?? '/'
                      return (
                        <Link key={`${item.type}-${item.id}`} href={href} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 12px', borderRadius: 8, textDecoration: 'none',
                          transition: 'background 0.15s',
                        }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <div style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={14} color={color} />
                          </div>
                          <div>
                            <p style={{ fontSize: 13, fontWeight: 500, color: '#e8e8f0', margin: 0 }}>{item.label}</p>
                            <p style={{ fontSize: 11, color: '#6b6b88', margin: '2px 0 0', textTransform: 'capitalize' }}>{item.type}</p>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
