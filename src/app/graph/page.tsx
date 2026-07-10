'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import ReactFlow, {
  Node, Edge, Background, Controls, MiniMap,
  useNodesState, useEdgesState, BackgroundVariant,
  MarkerType, Connection, addEdge, NodeTypes,
  Handle, Position, EdgeTypes, EdgeProps,
  getBezierPath, BaseEdge,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { X, ExternalLink, Link2, Trash2, FileText, Users, Bookmark, CheckSquare } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { LinkableType } from '@/types'

interface GraphItem {
  id: string
  type: string
  title: string
  tags?: string[]
}

interface GLink {
  id: string
  source_id: string
  source_type: string
  target_id: string
  target_type: string
  label?: string
}

const TYPE_COLOR: Record<string, string> = {
  note: '#7c6aff', person: '#10b981', bookmark: '#f59e0b', task: '#ef4444',
}
const TYPE_EMOJI: Record<string, string> = {
  note: '📑', person: '👤', bookmark: '🔖', task: '✅',
}
const TYPE_ICON: Record<string, React.ElementType> = {
  note: FileText, person: Users, bookmark: Bookmark, task: CheckSquare,
}
const TYPE_HREF: Record<string, (id: string) => string> = {
  note: () => '/notes', person: (id) => `/people/${id}`, bookmark: () => '/bookmarks', task: () => '/tasks',
}

// ── Custom Node ──────────────────────────────────────────────
function GraphNode({ data }: { data: { label: string; type: string; selected: boolean } }) {
  const color = TYPE_COLOR[data.type] ?? '#7c6aff'
  return (
    <div style={{
      backgroundColor: data.selected ? color + '30' : color + '18',
      border: `1.5px solid ${data.selected ? color : color + '55'}`,
      borderRadius: 10, padding: '8px 12px',
      minWidth: 140, maxWidth: 200,
      boxShadow: data.selected ? `0 0 0 2px ${color}44` : 'none',
      transition: 'all 0.15s',
    }}>
      <Handle type="target" position={Position.Top} style={{ background: color, border: 'none', width: 8, height: 8 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 10, color: color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {TYPE_EMOJI[data.type]} {data.type}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#e8e8f0', lineHeight: 1.3 }}>
          {data.label || 'Untitled'}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: color, border: 'none', width: 8, height: 8 }} />
    </div>
  )
}

// ── Custom Edge with delete button ───────────────────────────
function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })
  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ stroke: '#3a3a5e', strokeWidth: 1.5 }} markerEnd={`url(#arrow-${id})`} />
      <foreignObject width={20} height={20} x={labelX - 10} y={labelY - 10} style={{ cursor: 'pointer', overflow: 'visible' }}>
        <div
          onClick={() => data?.onDelete(id)}
          title="Remove link"
          style={{
            width: 20, height: 20, borderRadius: '50%',
            backgroundColor: '#1e1e2e', border: '1px solid #3a3a5e',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', opacity: 0.7,
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = '#ef4444' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.borderColor = '#3a3a5e' }}
        >
          <X size={10} color="#ef4444" />
        </div>
      </foreignObject>
    </>
  )
}

const NODE_TYPES: NodeTypes = { graphNode: GraphNode }
const EDGE_TYPES: EdgeTypes = { deletable: DeletableEdge }

// ── Main page ────────────────────────────────────────────────
export default function GraphPage() {
  const [items,   setItems]   = useState<GraphItem[]>([])
  const [links,   setLinks]   = useState<GLink[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')
  const [selected, setSelected] = useState<GraphItem | null>(null)
  const [connecting, setConnecting] = useState(false)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const fetchData = useCallback(async () => {
    const [nr, pr, br, tr, lr] = await Promise.all([
      fetch('/api/notes'), fetch('/api/people'), fetch('/api/bookmarks'),
      fetch('/api/tasks'), fetch('/api/links'),
    ])
    const [notes, people, bookmarks, tasks, linksData] = await Promise.all([
      nr.ok ? nr.json() : [], pr.ok ? pr.json() : [], br.ok ? br.json() : [],
      tr.ok ? tr.json() : [], lr.ok ? lr.json() : [],
    ])
    const allItems: GraphItem[] = [
      ...(Array.isArray(notes)     ? notes.map((n: { id: string; title: string; tags?: string[] })     => ({ id: n.id, type: 'note',     title: n.title,  tags: n.tags })) : []),
      ...(Array.isArray(people)    ? people.map((p: { id: string; name: string; tags?: string[] })     => ({ id: p.id, type: 'person',   title: p.name,   tags: p.tags })) : []),
      ...(Array.isArray(bookmarks) ? bookmarks.map((b: { id: string; title: string; tags?: string[] }) => ({ id: b.id, type: 'bookmark', title: b.title,  tags: b.tags })) : []),
      ...(Array.isArray(tasks)     ? tasks.map((t: { id: string; title: string; tags?: string[] })     => ({ id: t.id, type: 'task',     title: t.title,  tags: t.tags })) : []),
    ]
    setItems(allItems)
    setLinks(Array.isArray(linksData) ? linksData : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Rebuild nodes/edges when data or filter changes
  useEffect(() => {
    const filtered = filter === 'all' ? items : items.filter(i => i.type === filter)
    const cols = 5, xGap = 230, yGap = 130
    const typeOrder = ['note', 'person', 'bookmark', 'task']
    const sorted = [...filtered].sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type))

    const builtNodes: Node[] = sorted.map((item, idx) => ({
      id: item.id,
      type: 'graphNode',
      position: { x: (idx % cols) * xGap, y: Math.floor(idx / cols) * yGap },
      data: { label: item.title, type: item.type, selected: selected?.id === item.id },
    }))

    const visibleIds = new Set(filtered.map(i => i.id))
    const builtEdges: Edge[] = links
      .filter(l => visibleIds.has(l.source_id) && visibleIds.has(l.target_id))
      .map(l => ({
        id: l.id,
        source: l.source_id,
        target: l.target_id,
        type: 'deletable',
        animated: true,
        style: { stroke: '#3a3a5e', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#3a3a5e', width: 16, height: 16 },
        data: { onDelete: handleDeleteEdge },
      }))

    setNodes(builtNodes)
    setEdges(builtEdges)
  }, [items, links, filter, selected, setNodes, setEdges])

  async function handleConnect(connection: Connection) {
    if (!connection.source || !connection.target || connection.source === connection.target) return
    const sourceItem = items.find(i => i.id === connection.source)
    const targetItem = items.find(i => i.id === connection.target)
    if (!sourceItem || !targetItem) return

    const res = await fetch('/api/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_id: sourceItem.id, source_type: sourceItem.type,
        target_id: targetItem.id, target_type: targetItem.type,
      }),
    })
    if (res.ok) {
      const newLink = await res.json()
      setLinks(prev => [...prev.filter(l => !(l.source_id === sourceItem.id && l.target_id === targetItem.id)), newLink])
    }
  }

  async function handleDeleteEdge(edgeId: string) {
    const link = links.find(l => l.id === edgeId)
    if (!link) return
    await fetch('/api/links', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: link.source_id, target_id: link.target_id }),
    })
    setLinks(prev => prev.filter(l => l.id !== edgeId))
    setEdges(prev => prev.filter(e => e.id !== edgeId))
  }

  function handleNodeClick(_: React.MouseEvent, node: Node) {
    const item = items.find(i => i.id === node.id) ?? null
    setSelected(prev => prev?.id === node.id ? null : item)
  }

  const selectedLinks = useMemo(() => {
    if (!selected) return { outgoing: [], incoming: [] }
    return {
      outgoing: links.filter(l => l.source_id === selected.id).map(l => ({ ...l, other: items.find(i => i.id === l.target_id) })),
      incoming: links.filter(l => l.target_id === selected.id).map(l => ({ ...l, other: items.find(i => i.id === l.source_id) })),
    }
  }, [selected, links, items])

  const stats = useMemo(() => {
    const c: Record<string, number> = {}
    items.forEach(i => { c[i.type] = (c[i.type] ?? 0) + 1 })
    return c
  }, [items])

  return (
    <AppLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#e8e8f0', margin: 0 }}>Knowledge Graph</h1>
              <p style={{ fontSize: 12, color: '#6b6b88', marginTop: 2 }}>
                Drag from a node handle to another to create a link · Click a node to inspect it
              </p>
            </div>
            <span style={{ fontSize: 12, color: '#6b6b88' }}>
              {nodes.length} nodes · {edges.length} links
            </span>
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
            {['all', 'note', 'person', 'bookmark', 'task'].map(type => (
              <button
                type="button" key={type}
                onClick={() => setFilter(type)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: filter === type ? 600 : 400,
                  backgroundColor: filter === type ? '#7c6aff' : '#1e1e2e',
                  color: filter === type ? '#fff' : '#6b6b88',
                  transition: 'all 0.15s',
                }}
              >
                {TYPE_EMOJI[type] ?? '🌐'} {type.charAt(0).toUpperCase() + type.slice(1)}
                {type !== 'all' && stats[type] != null && (
                  <span style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '0 5px', borderRadius: 99 }}>{stats[type]}</span>
                )}
              </button>
            ))}
          </div>

          {/* Hint bar */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            {[
              { key: 'Drag handle → node', desc: 'Create a link' },
              { key: 'Click node', desc: 'Inspect & navigate' },
              { key: 'Click × on edge', desc: 'Remove link' },
            ].map(({ key, desc }) => (
              <span key={key} style={{ fontSize: 11, color: '#3a3a5e' }}>
                <kbd style={{ backgroundColor: '#1e1e2e', border: '1px solid #2a2a3e', padding: '1px 6px', borderRadius: 4, color: '#6b6b88', fontSize: 10 }}>{key}</kbd>
                {' '}{desc}
              </span>
            ))}
          </div>
        </div>

        {/* Graph + side panel */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#6b6b88' }}>
                Loading graph...
              </div>
            ) : nodes.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
                <p style={{ color: '#6b6b88' }}>No items yet — add notes, people, tasks or bookmarks</p>
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={NODE_TYPES}
                edgeTypes={EDGE_TYPES}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={handleConnect}
                onNodeClick={handleNodeClick}
                onPaneClick={() => setSelected(null)}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                proOptions={{ hideAttribution: true }}
                deleteKeyCode={null}
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#2a2a3e" />
                <Controls style={{ backgroundColor: '#12121a', border: '1px solid #2a2a3e' }} />
                <MiniMap
                  nodeColor={node => TYPE_COLOR[(node.data as { type: string }).type] ?? '#7c6aff'}
                  maskColor="rgba(10,10,15,0.85)"
                  style={{ backgroundColor: '#12121a', border: '1px solid #2a2a3e' }}
                />
              </ReactFlow>
            )}
          </div>

          {/* Side panel */}
          {selected && (
            <div style={{
              width: 280, flexShrink: 0,
              backgroundColor: '#12121a',
              borderLeft: '1px solid #2a2a3e',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}>
              {/* Panel header */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #2a2a3e', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: (TYPE_COLOR[selected.type] ?? '#7c6aff') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {(() => { const Icon = TYPE_ICON[selected.type] ?? FileText; return <Icon size={13} color={TYPE_COLOR[selected.type] ?? '#7c6aff'} /> })()}
                    </div>
                    <span style={{ fontSize: 10, color: TYPE_COLOR[selected.type] ?? '#7c6aff', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {selected.type}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#e8e8f0', margin: 0, wordBreak: 'break-word' }}>{selected.title || 'Untitled'}</p>
                  {selected.tags && selected.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {selected.tags.map(tag => (
                        <span key={tag} style={{ fontSize: 10, backgroundColor: '#1e1e2e', color: '#6b6b88', padding: '1px 7px', borderRadius: 99 }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#6b6b88', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                  <X size={14} />
                </button>
              </div>

              {/* Open button */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #2a2a3e' }}>
                <a
                  href={TYPE_HREF[selected.type]?.(selected.id) ?? '/'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
                    padding: '7px 12px', borderRadius: 8,
                    backgroundColor: (TYPE_COLOR[selected.type] ?? '#7c6aff') + '22',
                    border: `1px solid ${(TYPE_COLOR[selected.type] ?? '#7c6aff')}44`,
                    color: TYPE_COLOR[selected.type] ?? '#7c6aff',
                    textDecoration: 'none', fontSize: 13, fontWeight: 500,
                  }}
                >
                  <ExternalLink size={13} /> Open {selected.type}
                </a>
              </div>

              {/* Connections */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Link2 size={13} color="#6b6b88" />
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#6b6b88', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Connections ({selectedLinks.outgoing.length + selectedLinks.incoming.length})
                  </span>
                </div>

                {selectedLinks.outgoing.length === 0 && selectedLinks.incoming.length === 0 && (
                  <p style={{ fontSize: 12, color: '#3a3a5e', fontStyle: 'italic' }}>
                    No connections yet. Drag from the bottom handle to another node to create one.
                  </p>
                )}

                {selectedLinks.outgoing.length > 0 && (
                  <>
                    <p style={{ fontSize: 10, color: '#3a3a5e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Links to</p>
                    {selectedLinks.outgoing.map(({ id, other }) => other && (
                      <ConnectionItem key={id} item={other} onDelete={() => handleDeleteEdge(id)} />
                    ))}
                  </>
                )}

                {selectedLinks.incoming.length > 0 && (
                  <>
                    <p style={{ fontSize: 10, color: '#3a3a5e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '12px 0 6px' }}>Linked from</p>
                    {selectedLinks.incoming.map(({ id, other }) => other && (
                      <ConnectionItem key={id} item={other} onDelete={() => handleDeleteEdge(id)} />
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}

function ConnectionItem({ item, onDelete }: { item: GraphItem; onDelete: () => void }) {
  const Icon  = TYPE_ICON[item.type] ?? FileText
  const color = TYPE_COLOR[item.type] ?? '#7c6aff'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #1e1e2e' }}>
      <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={12} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, color: '#e8e8f0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || 'Untitled'}</p>
        <p style={{ fontSize: 10, color: '#6b6b88', margin: 0, textTransform: 'capitalize' }}>{item.type}</p>
      </div>
      <button type="button" onClick={onDelete} style={{ background: 'none', border: 'none', color: '#6b6b88', cursor: 'pointer', padding: 3, flexShrink: 0, borderRadius: 4 }}
        title="Remove link"
        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#6b6b88' }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
