'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FileText, Users, Bookmark, CheckSquare, Network, LayoutDashboard, ArrowRight } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'

interface SearchResult {
  id: string
  _type: string
  _label: string
  [key: string]: unknown
}

const TYPE_ICON: Record<string, React.ElementType> = {
  note:     FileText,
  person:   Users,
  bookmark: Bookmark,
  task:     CheckSquare,
}

const TYPE_COLOR: Record<string, string> = {
  note:     'var(--primary)',
  person:   '#10b981',
  bookmark: '#f59e0b',
  task:     '#ef4444',
}

const QUICK_ACTIONS = [
  { label: 'Dashboard',    icon: LayoutDashboard, href: '/dashboard',  shortcut: 'G D' },
  { label: 'Notes',        icon: FileText,        href: '/notes',      shortcut: 'G N' },
  { label: 'People',       icon: Users,           href: '/people',     shortcut: 'G P' },
  { label: 'Bookmarks',    icon: Bookmark,        href: '/bookmarks',  shortcut: 'G B' },
  { label: 'Tasks',        icon: CheckSquare,     href: '/tasks',      shortcut: 'G T' },
  { label: 'Graph',        icon: Network,         href: '/graph',      shortcut: 'G G' },
]

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<SearchResult[]>([])
  const [loading, setLoading]   = useState(false)
  const [selected, setSelected] = useState(0)
  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLDivElement>(null)
  const debouncedQuery = useDebounce(query, 200)

  useEffect(() => {
    if (open) {
      setQuery(''); setResults([]); setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) { setResults([]); setLoading(false); return }
    setLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(r => r.json())
      .then(d => { setResults(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [debouncedQuery])

  const items = query.length >= 2 ? results : QUICK_ACTIONS

  function navigate(href: string) { router.push(href); onClose() }

  function handleSelect(index: number) {
    const item = items[index]
    if (!item) return
    if ('href' in item) { navigate(item.href as string); return }
    const r = item as SearchResult
    const dest =
      r._type === 'note'     ? `/notes/${r.id}` :
      r._type === 'person'   ? `/people/${r.id}` :
      r._type === 'bookmark' ? `/bookmarks` :
      r._type === 'task'     ? `/tasks` :
      `/dashboard`
    navigate(dest)
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown')      { e.preventDefault(); setSelected(s => Math.min(s + 1, items.length - 1)) }
    else if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    else if (e.key === 'Enter')     { e.preventDefault(); handleSelect(selected) }
    else if (e.key === 'Escape')    { onClose() }
  }, [items, selected, onClose])

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selected}"]`) as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  if (!open) return null

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 998, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />

      <div style={{
        position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)',
        zIndex: 999, width: '100%', maxWidth: 580,
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {/* Input row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <Search size={17} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search or jump to..."
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 15, color: 'var(--foreground)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          />
          {loading && <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Searching...</span>}
          <kbd style={{ fontSize: 11, color: 'var(--muted-foreground)', backgroundColor: 'var(--muted)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 5 }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ maxHeight: 380, overflowY: 'auto', padding: '6px' }}>
          <div style={{ padding: '4px 10px 6px', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {query.length >= 2 ? (results.length === 0 && !loading ? 'No results' : 'Results') : 'Quick navigation'}
          </div>

          {items.map((item, i) => {
            const isResult   = '_type' in item
            const isSelected = i === selected

            if (isResult) {
              const r     = item as SearchResult
              const Icon  = TYPE_ICON[r._type] ?? FileText
              const color = TYPE_COLOR[r._type] ?? 'var(--primary)'
              return (
                <button key={`${r._type}-${r.id}`} type="button" data-index={i}
                  onClick={() => handleSelect(i)} onMouseEnter={() => setSelected(i)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                    textAlign: 'left', transition: 'background 0.1s',
                  }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={14} style={{ color }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r._label}</p>
                    <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: 0, textTransform: 'capitalize' }}>{r._type}</p>
                  </div>
                  {isSelected && <ArrowRight size={13} style={{ color: 'var(--primary)' }} />}
                </button>
              )
            }

            const action = item as typeof QUICK_ACTIONS[0]
            const Icon   = action.icon
            return (
              <button key={action.href} type="button" data-index={i}
                onClick={() => handleSelect(i)} onMouseEnter={() => setSelected(i)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                  textAlign: 'left', transition: 'background 0.1s',
                }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={14} style={{ color: 'var(--muted-foreground)' }} />
                </div>
                <span style={{ fontSize: 13, color: 'var(--foreground)', flex: 1 }}>{action.label}</span>
                <kbd style={{ fontSize: 10, color: 'var(--muted-foreground)', backgroundColor: 'var(--muted)', border: '1px solid var(--border)', padding: '2px 7px', borderRadius: 5 }}>{action.shortcut}</kbd>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center' }}>
          {[['↑↓', 'navigate'], ['↵', 'select'], ['esc', 'close']].map(([key, label]) => (
            <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted-foreground)' }}>
              <kbd style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)', padding: '1px 6px', borderRadius: 4, fontSize: 11, color: 'var(--secondary-foreground)' }}>{key}</kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
