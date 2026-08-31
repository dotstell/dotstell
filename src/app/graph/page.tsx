'use client'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import ReactFlow, {
  Node, Background, Controls, MiniMap,
  useNodesState, useEdgesState, BackgroundVariant,
  MarkerType, Connection, NodeTypes,
  Handle, Position, EdgeTypes, EdgeProps,
  getBezierPath, BaseEdge, useReactFlow, ReactFlowProvider,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { X, ExternalLink, Link2, Trash2, FileText, Users, Bookmark, CheckSquare, Sparkles } from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { LinkableType } from '@/types'
import { AIGraphIntelPanel } from '@/components/ai/AIGraphIntelPanel'
import { useAISettings } from '@/hooks/useAISettings'

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
  note: 'var(--primary)', person: '#10b981', bookmark: '#f59e0b', task: '#ef4444',
}
const TYPE_EMOJI: Record<string, string> = {
  note: '📑', person: '👤', bookmark: '🔖', task: '✅',
}
const TYPE_ICON: Record<string, React.ElementType> = {
  note: FileText, person: Users, bookmark: Bookmark, task: CheckSquare,
}
const TYPE_HREF: Record<string, (id: string) => string> = {
  note: (id) => `/notes/${id}`, person: (id) => `/people/${id}`, bookmark: () => '/bookmarks', task: () => '/tasks',
}

// ── Custom Node ──────────────────────────────────────────────
function GraphNode({ data }: { data: { label: string; type: string; selected: boolean } }) {
  const color = TYPE_COLOR[data.type] ?? 'var(--primary)'
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
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', lineHeight: 1.3 }}>
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
      <BaseEdge id={id} path={edgePath} style={{ stroke: 'var(--border)', strokeWidth: 1.5 }} markerEnd={`url(#arrow-${id})`} />
      <foreignObject width={20} height={20} x={labelX - 10} y={labelY - 10} style={{ cursor: 'pointer', overflow: 'visible' }}>
        <div
          onClick={() => data?.onDelete(id)}
          title="Remove link"
          style={{
            width: 20, height: 20, borderRadius: '50%',
            backgroundColor: 'var(--secondary)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', opacity: 0.7,
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = '#ef4444' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.borderColor = 'var(--border)' }}
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
  return (
    <ReactFlowProvider>
      <GraphPageInner />
    </ReactFlowProvider>
  )
}

function GraphPageInner() {
  const { fitView } = useReactFlow()
  const router = useRouter()
  const [items,   setItems]   = useState<GraphItem[]>([])
  const [links,   setLinks]   = useState<GLink[]>([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')
  const [selected, setSelected] = useState<GraphItem | null>(null)
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const { config: aiConfig, loaded: aiLoaded } = useAISettings()
  // Tracks pending DELETE timers by edge id so Undo can cancel them before the API call fires.
  const deleteCancelRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const STORAGE_KEY = 'dotstell-graph-positions'

  function loadSavedPositions(): Map<string, { x: number; y: number }> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return new Map()
      return new Map(Object.entries(JSON.parse(raw)))
    } catch { return new Map() }
  }

  function savePositions(nodeList: Node[]) {
    const obj: Record<string, { x: number; y: number }> = {}
    nodeList.forEach(n => { obj[n.id] = n.position })
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj))
  }

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Persist node positions after any drag. useEffect reads the committed nodes list
  // rather than calling savePositions inside the setState updater — state updaters
  // must be pure (React may call them multiple times in Strict Mode).
  function handleNodesChange(changes: Parameters<typeof onNodesChange>[0]) {
    onNodesChange(changes)
  }
  useEffect(() => {
    if (nodes.length > 0) savePositions(nodes)
  }, [nodes])

  const fetchData = useCallback(async () => {
    // Intentionally fetches all notes (including sub-notes) to show the full link graph.
    // If graph density becomes a problem, add root_only=true and a "show sub-notes" toggle.
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

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Effect 1: Build nodes ONLY when items or filter changes, then fit viewport
  useEffect(() => {
    const filtered = filter === 'all' ? items : items.filter(i => i.type === filter)
    const cols = 5, xGap = 240, yGap = 150
    const typeOrder = ['note', 'person', 'bookmark', 'task']
    const sorted = [...filtered].sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type))

    const savedPos = loadSavedPositions()

    // Collect positions already claimed by nodes that have a saved position,
    // so grid-assigned nodes never land on top of them.
    const claimed: Array<{ x: number; y: number }> = []
    sorted.forEach(item => {
      const p = savedPos.get(item.id)
      if (p) claimed.push(p)
    })

    let gridSlot = 0
    const newNodes = sorted.map(item => {
      const saved = savedPos.get(item.id)
      if (saved) {
        return { id: item.id, type: 'graphNode', position: saved, data: { label: item.title, type: item.type, selected: false } }
      }
      // Advance the grid slot until it doesn't collide with any claimed position
      let pos: { x: number; y: number }
      do {
        pos = { x: (gridSlot % cols) * xGap, y: Math.floor(gridSlot / cols) * yGap }
        gridSlot++
      } while (claimed.some(p => Math.abs(p.x - pos.x) < xGap * 0.6 && Math.abs(p.y - pos.y) < yGap * 0.6))
      claimed.push(pos)
      return { id: item.id, type: 'graphNode', position: pos, data: { label: item.title, type: item.type, selected: false } }
    })

    setNodes(newNodes)
    setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 80)
  }, [items, filter, setNodes, fitView])

  // Effect 2: Update edges independently — never touches node positions
  useEffect(() => {
    const filtered = filter === 'all' ? items : items.filter(i => i.type === filter)
    const visibleIds = new Set(filtered.map(i => i.id))
    setEdges(
      links
        .filter(l => visibleIds.has(l.source_id) && visibleIds.has(l.target_id))
        .map(l => ({
          id: l.id,
          source: l.source_id,
          target: l.target_id,
          type: 'deletable',
          animated: true,
          style: { stroke: 'var(--border)', strokeWidth: 1.5 },
          markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--border)', width: 16, height: 16 },
          data: { onDelete: handleDeleteEdge },
        }))
    )
  }, [links, items, filter, setEdges])

  // Effect 3: Update selection highlight only — patches data, never moves nodes
  useEffect(() => {
    setNodes(prev =>
      prev.map(n => ({
        ...n,
        data: { ...n.data, selected: n.id === selected?.id },
      }))
    )
  }, [selected, setNodes])

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

  function handleDeleteEdge(edgeId: string) {
    const link = links.find(l => l.id === edgeId)
    if (!link) return

    // Optimistically remove from state so the UI responds immediately.
    setLinks(prev => prev.filter(l => l.id !== edgeId))
    setEdges(prev => prev.filter(e => e.id !== edgeId))

    // Delay the actual API delete by the toast duration so Undo can cancel it.
    const timer = setTimeout(async () => {
      deleteCancelRef.current.delete(edgeId)
      const res = await fetch('/api/links', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_id: link.source_id, target_id: link.target_id }),
      })
      if (!res.ok) {
        // Restore the link in state if the server rejects the delete.
        setLinks(prev => [...prev, link])
      }
    }, 4000)
    deleteCancelRef.current.set(edgeId, timer)

    toast('Link removed', {
      duration: 4000,
      action: {
        label: 'Undo',
        onClick: () => {
          clearTimeout(deleteCancelRef.current.get(edgeId))
          deleteCancelRef.current.delete(edgeId)
          setLinks(prev => [...prev, link])
        },
      },
    })
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
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>Knowledge Graph</h1>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>
                Drag from a node handle to another to create a link · Click a node to inspect it
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                {nodes.length} nodes · {edges.length} links
              </span>
              {aiLoaded && aiConfig.provider && (
                <button
                  type="button"
                  onClick={() => setAiPanelOpen(v => !v)}
                  title="AI Graph Intelligence"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${aiPanelOpen ? 'color-mix(in srgb, var(--primary) 50%, transparent)' : 'var(--border)'}`,
                    borderRadius: 6, padding: '3px 10px',
                    backgroundColor: aiPanelOpen ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'none',
                    color: aiPanelOpen ? 'var(--primary)' : 'var(--muted-foreground)',
                    transition: 'all 0.15s',
                  }}
                >
                  <Sparkles size={12} /> AI
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem(STORAGE_KEY)
                  setNodes([])
                  // setNodes([]) needs to commit before the items-change effect re-runs
                  // the layout algorithm. setTimeout(0) yields to React's batch first.
                  setTimeout(() => setItems(prev => [...prev]), 0)
                }}
                style={{
                  fontSize: 11, color: 'var(--muted-foreground)', background: 'none',
                  border: '1px solid var(--border)', borderRadius: 6,
                  padding: '3px 10px', cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--foreground)'; e.currentTarget.style.borderColor = 'var(--border)' }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-foreground)'; e.currentTarget.style.borderColor = 'var(--border)' }}
              >
                Reset layout
              </button>
            </div>
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
                  backgroundColor: filter === type ? 'var(--primary)' : 'var(--secondary)',
                  color: filter === type ? '#fff' : 'var(--muted-foreground)',
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
          <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
            {[
              { key: 'Drag handle → node', desc: 'Create a link' },
              { key: 'Click node', desc: 'Inspect & navigate' },
              { key: 'Click × on edge', desc: 'Remove link' },
            ].map(({ key, desc }) => (
              <span key={key} style={{ fontSize: 11, color: 'var(--border)' }}>
                <kbd style={{ backgroundColor: 'var(--secondary)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 4, color: 'var(--muted-foreground)', fontSize: 10 }}>{key}</kbd>
                {' '}{desc}
              </span>
            ))}
          </div>
        </div>

        {/* Graph + side panel */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--muted-foreground)' }}>
                Loading graph...
              </div>
            ) : nodes.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
                <p style={{ color: 'var(--muted-foreground)' }}>No items yet — add notes, people, tasks or bookmarks</p>
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={NODE_TYPES}
                edgeTypes={EDGE_TYPES}
                onNodesChange={handleNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={handleConnect}
                onNodeClick={handleNodeClick}
                onPaneClick={() => setSelected(null)}
                fitView
                fitViewOptions={{ padding: 0.15 }}
                proOptions={{ hideAttribution: true }}
                deleteKeyCode={null}
              >
                <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
                <Controls style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }} />
                <MiniMap
                  nodeColor={node => TYPE_COLOR[(node.data as { type: string }).type] ?? 'var(--primary)'}
                  maskColor="rgba(10,10,15,0.85)"
                  style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)' }}
                />
              </ReactFlow>
            )}
          </div>

          {/* AI Graph Intelligence panel */}
          {aiPanelOpen && aiConfig.provider && (
            <div style={isMobile ? {
              position: 'fixed', bottom: 0, left: 0, right: 0, height: '50vh', zIndex: 50,
              backgroundColor: 'var(--card)',
              borderTop: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            } : {
              width: 300, flexShrink: 0,
              backgroundColor: 'var(--card)',
              borderLeft: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 7, backgroundColor: 'color-mix(in srgb, var(--primary) 14%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Sparkles size={13} color="var(--primary)" />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>Graph Intelligence</span>
                </div>
                <button type="button" onClick={() => setAiPanelOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 4 }}>
                  <X size={14} />
                </button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
                <AIGraphIntelPanel
                  config={aiConfig}
                  onOpenNote={id => router.push(`/notes/${id}`)}
                />
              </div>
            </div>
          )}

          {/* Side panel */}
          {selected && (
            <div style={isMobile ? {
              position: 'fixed', bottom: 0, left: 0, right: 0, height: '50vh', zIndex: 50,
              backgroundColor: 'var(--card)',
              borderTop: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            } : {
              width: 280, flexShrink: 0,
              backgroundColor: 'var(--card)',
              borderLeft: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
            }}>
              {/* Panel header */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: (TYPE_COLOR[selected.type] ?? 'var(--primary)') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {(() => { const Icon = TYPE_ICON[selected.type] ?? FileText; return <Icon size={13} color={TYPE_COLOR[selected.type] ?? 'var(--primary)'} /> })()}
                    </div>
                    <span style={{ fontSize: 10, color: TYPE_COLOR[selected.type] ?? 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {selected.type}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)', margin: 0, wordBreak: 'break-word' }}>{selected.title || 'Untitled'}</p>
                  {selected.tags && selected.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                      {selected.tags.map(tag => (
                        <span key={tag} style={{ fontSize: 10, backgroundColor: 'var(--secondary)', color: 'var(--muted-foreground)', padding: '1px 7px', borderRadius: 99 }}>{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <button type="button" onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 4, flexShrink: 0 }}>
                  <X size={14} />
                </button>
              </div>

              {/* Open button */}
              <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                <a
                  href={TYPE_HREF[selected.type]?.(selected.id) ?? '/'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
                    padding: '7px 12px', borderRadius: 8,
                    backgroundColor: (TYPE_COLOR[selected.type] ?? 'var(--primary)') + '22',
                    border: `1px solid ${(TYPE_COLOR[selected.type] ?? 'var(--primary)')}44`,
                    color: TYPE_COLOR[selected.type] ?? 'var(--primary)',
                    textDecoration: 'none', fontSize: 13, fontWeight: 500,
                  }}
                >
                  <ExternalLink size={13} /> Open {selected.type}
                </a>
              </div>

              {/* Connections */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Link2 size={13} color="var(--muted-foreground)" />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Connections ({selectedLinks.outgoing.length + selectedLinks.incoming.length})
                  </span>
                </div>

                {selectedLinks.outgoing.length === 0 && selectedLinks.incoming.length === 0 && (
                  <p style={{ fontSize: 12, color: 'var(--border)', fontStyle: 'italic' }}>
                    No connections yet. Drag from the bottom handle to another node to create one.
                  </p>
                )}

                {selectedLinks.outgoing.length > 0 && (
                  <>
                    <p style={{ fontSize: 10, color: 'var(--border)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 6px' }}>Links to</p>
                    {selectedLinks.outgoing.map(({ id, other }) => other && (
                      <ConnectionItem key={id} item={other} onDelete={() => handleDeleteEdge(id)} />
                    ))}
                  </>
                )}

                {selectedLinks.incoming.length > 0 && (
                  <>
                    <p style={{ fontSize: 10, color: 'var(--border)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '12px 0 6px' }}>Linked from</p>
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
  const color = TYPE_COLOR[item.type] ?? 'var(--primary)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--secondary)' }}>
      <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={12} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title || 'Untitled'}</p>
        <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: 0, textTransform: 'capitalize' }}>{item.type}</p>
      </div>
      <button type="button" onClick={onDelete} style={{ background: 'none', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 3, flexShrink: 0, borderRadius: 4 }}
        title="Remove link"
        onMouseEnter={e => { e.currentTarget.style.color = '#ef4444' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted-foreground)' }}
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
