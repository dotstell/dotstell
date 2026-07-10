'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { AppLayout } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'

interface GraphItem {
  id: string
  type: string
  title: string
  tags?: string[]
}

interface Link {
  id: string
  source_id: string
  source_type: string
  target_id: string
  target_type: string
  label?: string
}

const TYPE_COLORS: Record<string, string> = {
  note: '#7c6aff',
  person: '#10b981',
  bookmark: '#f59e0b',
  task: '#ef4444',
}

const TYPE_EMOJIS: Record<string, string> = {
  note: '📑',
  person: '👤',
  bookmark: '🔖',
  task: '✅',
}

function buildNodes(items: GraphItem[]): Node[] {
  const layout: Record<string, { x: number; y: number }> = {}
  const typeGroups: Record<string, GraphItem[]> = {}

  items.forEach(item => {
    if (!typeGroups[item.type]) typeGroups[item.type] = []
    typeGroups[item.type].push(item)
  })

  let yOffset = 0
  Object.entries(typeGroups).forEach(([, groupItems]) => {
    groupItems.forEach((item, i) => {
      layout[item.id] = { x: (i % 5) * 220, y: yOffset + Math.floor(i / 5) * 120 }
    })
    yOffset += Math.ceil(groupItems.length / 5) * 120 + 60
  })

  return items.map(item => ({
    id: item.id,
    position: layout[item.id] ?? { x: 0, y: 0 },
    data: {
      label: (
        <div className="flex flex-col items-start gap-0.5 p-1">
          <span className="text-[10px] opacity-60">{TYPE_EMOJIS[item.type]} {item.type}</span>
          <span className="text-xs font-medium leading-tight">{item.title || 'Untitled'}</span>
        </div>
      ),
    },
    style: {
      background: TYPE_COLORS[item.type] + '22',
      border: `1.5px solid ${TYPE_COLORS[item.type]}66`,
      borderRadius: 10,
      padding: '6px 10px',
      color: '#e8e8f0',
      fontSize: 12,
      minWidth: 140,
    },
  }))
}

function buildEdges(links: Link[]): Edge[] {
  return links.map(link => ({
    id: link.id,
    source: link.source_id,
    target: link.target_id,
    label: link.label,
    labelStyle: { fill: '#6b6b88', fontSize: 10 },
    style: { stroke: '#2a2a3e', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#2a2a3e' },
    type: 'smoothstep',
    animated: false,
  }))
}

export default function GraphPage() {
  const [items, setItems] = useState<GraphItem[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const fetchData = useCallback(async () => {
    const [notesRes, peopleRes, bookmarksRes, tasksRes, linksRes] = await Promise.all([
      fetch('/api/notes'),
      fetch('/api/people'),
      fetch('/api/bookmarks'),
      fetch('/api/tasks'),
      fetch('/api/links'),
    ])

    const [notes, people, bookmarks, tasks, linksData] = await Promise.all([
      notesRes.ok ? notesRes.json() : [],
      peopleRes.ok ? peopleRes.json() : [],
      bookmarksRes.ok ? bookmarksRes.json() : [],
      tasksRes.ok ? tasksRes.json() : [],
      linksRes.ok ? linksRes.json() : [],
    ])

    const allItems: GraphItem[] = [
      ...(Array.isArray(notes) ? notes.map((n: { id: string; title: string; tags?: string[] }) => ({ id: n.id, type: 'note', title: n.title, tags: n.tags })) : []),
      ...(Array.isArray(people) ? people.map((p: { id: string; name: string; tags?: string[] }) => ({ id: p.id, type: 'person', title: p.name, tags: p.tags })) : []),
      ...(Array.isArray(bookmarks) ? bookmarks.map((b: { id: string; title: string; tags?: string[] }) => ({ id: b.id, type: 'bookmark', title: b.title, tags: b.tags })) : []),
      ...(Array.isArray(tasks) ? tasks.map((t: { id: string; title: string; tags?: string[] }) => ({ id: t.id, type: 'task', title: t.title, tags: t.tags })) : []),
    ]

    setItems(allItems)
    setLinks(Array.isArray(linksData) ? linksData : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    const filtered = filter === 'all' ? items : items.filter(i => i.type === filter)
    const linkedIds = new Set(links.flatMap(l => [l.source_id, l.target_id]))
    const visibleItems = filter === 'all' ? filtered : filtered.filter(i => linkedIds.has(i.id) || true)
    setNodes(buildNodes(visibleItems))
    const visibleIds = new Set(visibleItems.map(i => i.id))
    setEdges(buildEdges(links.filter(l => visibleIds.has(l.source_id) && visibleIds.has(l.target_id))))
  }, [items, links, filter, setNodes, setEdges])

  const stats = useMemo(() => {
    const counts: Record<string, number> = {}
    items.forEach(i => { counts[i.type] = (counts[i.type] ?? 0) + 1 })
    return counts
  }, [items])

  return (
    <AppLayout>
      <div className="flex flex-col graph-full-height">
        <div className="p-6 pb-0">
          <PageHeader
            title="Knowledge Graph"
            description="Visual map of all your connected knowledge"
          />
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {['all', 'note', 'person', 'bookmark', 'task'].map(type => (
              <button
                type="button"
                key={type}
                onClick={() => setFilter(type)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filter === type ? 'bg-[var(--primary)] text-white' : 'text-[var(--muted-foreground)] hover:bg-[var(--accent)]'
                }`}
              >
                {TYPE_EMOJIS[type] ?? '🌐'} {type.charAt(0).toUpperCase() + type.slice(1)}
                {type !== 'all' && stats[type] != null && (
                  <span className="bg-black/20 px-1 rounded">{stats[type]}</span>
                )}
              </button>
            ))}
            <span className="ml-auto text-xs text-[var(--muted-foreground)]">
              {nodes.length} nodes · {edges.length} links
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full text-[var(--muted-foreground)]">Loading graph...</div>
          ) : nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <p className="text-[var(--muted-foreground)]">No items to show yet</p>
              <p className="text-xs text-[var(--muted-foreground)]">Add notes, people, bookmarks, or tasks and they&apos;ll appear here</p>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2a2a3e" />
              <Controls />
              <MiniMap
                nodeColor={node => {
                  const type = items.find(i => i.id === node.id)?.type ?? 'note'
                  return TYPE_COLORS[type] ?? '#7c6aff'
                }}
                maskColor="rgba(10,10,15,0.8)"
              />
            </ReactFlow>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
