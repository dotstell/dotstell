'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, Plus, SidebarClose, SidebarOpen, FileText, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNoteTabs } from '@/hooks/useNoteTabs'

interface Props {
  currentId?: string
  paneOpen: boolean
  onTogglePane: () => void
}

const TAB_H = 38

export function NoteTabBar({ currentId, paneOpen, onTogglePane }: Props) {
  const router = useRouter()
  const { tabs, activeId, openTab, closeTab, closeOtherTabs, closeAllTabs } = useNoteTabs(currentId)
  const [hovered,       setHovered]       = useState<string | null>(null)
  const [ctxMenu,       setCtxMenu]       = useState<{ x: number; y: number; id: string } | null>(null)
  const [creating,      setCreating]      = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [canScrollLeft,  setCanScrollLeft]  = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const scrollRef    = useRef<HTMLDivElement>(null)
  const active = activeId ?? currentId

  // Update scroll-arrow visibility based on current scroll position
  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2)
  }, [])

  // Re-check arrows whenever tabs change or the container resizes
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      ro.disconnect()
    }
  }, [tabs, updateScrollState])

  // Convert vertical mouse-wheel to horizontal scroll (like VS Code / browser tabs)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    function onWheel(e: WheelEvent) {
      if (!scrollRef.current) return
      // Only intercept pure vertical scrolls — let horizontal (trackpad) pass through naturally
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault()
        scrollRef.current.scrollLeft += e.deltaY
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Create a blank note immediately — no template modal detour
  async function handleNewNote() {
    if (creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '', content: '<p></p>', type: 'markdown', tags: [] }),
      })
      if (res.ok) {
        const note = await res.json()
        openTab(note.id, 'Untitled')
        router.push(`/notes/${note.id}`)
      }
    } finally {
      setCreating(false)
    }
  }

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return
    function close(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest('[data-ctx-menu]')) setCtxMenu(null)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [ctxMenu])

  // Scroll active tab into view
  useEffect(() => {
    if (!active || !scrollRef.current) return
    const el = scrollRef.current.querySelector(`[data-tab-id="${active}"]`) as HTMLElement
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [active])

  function handleClose(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    const nextId = closeTab(id)
    if (nextId) router.push(`/notes/${nextId}`)
    else router.push('/notes')
  }

  // Middle-click to close (like browser tabs / VS Code)
  function handleMouseDown(e: React.MouseEvent, id: string) {
    if (e.button === 1) {
      e.preventDefault()
      const nextId = closeTab(id)
      if (nextId) router.push(`/notes/${nextId}`)
      else router.push('/notes')
    }
  }

  function handleContextMenu(e: React.MouseEvent, id: string) {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, id })
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'stretch',
      height: TAB_H, flexShrink: 0,
      backgroundColor: 'var(--card)',
      borderBottom: '1px solid var(--border)',
      position: 'relative',
      userSelect: 'none',
    }}>

      {/* Panel toggle */}
      <IconBtn title={paneOpen ? 'Hide panel' : 'Show panel'} onClick={onTogglePane} active={paneOpen} borderRight>
        {paneOpen ? <SidebarClose size={15} /> : <SidebarOpen size={15} />}
      </IconBtn>

      {/* Scroll-left arrow — fades in when there's overflow to the left */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scrollRef.current && (scrollRef.current.scrollLeft -= 160)}
          style={{
            flexShrink: 0, width: 32, height: TAB_H,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', borderRight: '1px solid var(--border)',
            background: 'linear-gradient(to right, var(--card) 60%, transparent)',
            color: 'var(--muted-foreground)', cursor: 'pointer',
            position: 'relative', zIndex: 1,
          }}
        >
          <ChevronLeft size={13} />
        </button>
      )}

      {/* Scrollable tabs — 'tab-scroll-container' hides the webkit scrollbar via globals.css */}
      <div ref={scrollRef} className="tab-scroll-container" style={{
        display: 'flex', alignItems: 'stretch',
        flex: 1, minWidth: 0,
        overflowX: 'auto', overflowY: 'hidden',
        scrollbarWidth: 'none',
        touchAction: 'pan-x',
      }}>
        {tabs.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center',
            padding: '0 16px', fontSize: 12,
            color: 'var(--muted-foreground)', opacity: 0.4,
            whiteSpace: 'nowrap',
          }}>
            Open a note to start
          </div>
        ) : tabs.map(tab => {
          const isActive  = tab.id === active
          const isHovered = hovered === tab.id

          return (
            <div
              key={tab.id}
              data-tab-id={tab.id}
              onMouseEnter={() => setHovered(tab.id)}
              onMouseLeave={() => setHovered(null)}
              onMouseDown={e => handleMouseDown(e, tab.id)}
              onClick={() => { if (!isActive) router.push(`/notes/${tab.id}`) }}
              onContextMenu={e => handleContextMenu(e, tab.id)}
              onPointerDown={e => {
                if (e.pointerType === 'mouse') return
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                longPressTimer.current = setTimeout(() => {
                  setCtxMenu({ x: rect.left + rect.width / 2, y: rect.bottom, id: tab.id })
                }, 500)
              }}
              onPointerUp={() => {
                if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
              }}
              onPointerCancel={() => {
                if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
              }}
              onPointerMove={() => {
                if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
              }}
              title={tab.title || 'Untitled'}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '0 8px 0 12px',
                minWidth: 100, maxWidth: 200,
                height: TAB_H, flexShrink: 0,
                cursor: 'pointer', position: 'relative',
                backgroundColor: isActive
                  ? 'var(--background)'
                  : isHovered ? 'color-mix(in srgb, var(--foreground) 4%, transparent)' : 'transparent',
                borderRight: '1px solid var(--border)',
                // Top border indicator — like VS Code, Sublime, Notepad++
                borderTop: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                transition: 'background 0.1s',
              }}
            >
              <FileText size={12} style={{
                flexShrink: 0,
                color: isActive ? 'var(--primary)' : 'var(--muted-foreground)',
                opacity: isActive ? 1 : 0.5,
              }} />

              <span style={{
                flex: 1, minWidth: 0, fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {tab.title || 'Untitled'}
              </span>

              {/* Modified dot (unsaved) — shown when not hovered/active */}
              {tab.modified && !(isActive || isHovered) ? (
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  backgroundColor: 'var(--primary)', flexShrink: 0, opacity: 0.8,
                }} />
              ) : (
                <div
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => handleClose(e, tab.id)}
                  title="Close"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 20, height: 20, borderRadius: 4, flexShrink: 0,
                    opacity: (isActive || isHovered) ? 1 : 0,
                    pointerEvents: (isActive || isHovered) ? 'auto' : 'none',
                    color: 'var(--muted-foreground)',
                    transition: 'background 0.1s, color 0.1s, opacity 0.1s',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = 'color-mix(in srgb, var(--destructive) 18%, transparent)'
                    el.style.color = 'var(--destructive)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = 'transparent'
                    el.style.color = 'var(--muted-foreground)'
                  }}
                >
                  <X size={10} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Scroll-right arrow — fades in when there's overflow to the right */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scrollRef.current && (scrollRef.current.scrollLeft += 160)}
          style={{
            flexShrink: 0, width: 32, height: TAB_H,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', borderLeft: '1px solid var(--border)',
            background: 'linear-gradient(to left, var(--card) 60%, transparent)',
            color: 'var(--muted-foreground)', cursor: 'pointer',
          }}
        >
          <ChevronRight size={13} />
        </button>
      )}

      {/* New note — creates immediately, no template modal */}
      <IconBtn title="New note (Ctrl+N / Alt+N)" onClick={handleNewNote} borderLeft primary disabled={creating}>
        <Plus size={15} style={{ opacity: creating ? 0.4 : 1 }} />
      </IconBtn>

      {/* Right-click context menu */}
      {ctxMenu && (
        <div data-ctx-menu style={{
          position: 'fixed', top: ctxMenu.y, left: ctxMenu.x,
          zIndex: 999,
          backgroundColor: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '4px 0', minWidth: 188,
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)', fontSize: 13,
        }}>
          {([
            { label: 'Close tab',        action: () => { const n = closeTab(ctxMenu.id); router.push(n ? `/notes/${n}` : '/notes') } },
            { label: 'Close other tabs', action: () => { closeOtherTabs(ctxMenu.id); router.push(`/notes/${ctxMenu.id}`) } },
            { label: 'Close all tabs',   action: () => { closeAllTabs(); router.push('/notes') } },
          ] as { label: string; action: () => void }[]).map(({ label, action }) => (
            <div key={label}
              onClick={() => { action(); setCtxMenu(null) }}
              style={{ padding: '7px 14px', cursor: 'pointer', color: 'var(--foreground)', transition: 'background 0.1s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--accent)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              {label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function IconBtn({ children, title, onClick, active, borderLeft, borderRight, primary, disabled }: {
  children: React.ReactNode; title: string; onClick: () => void
  active?: boolean; borderLeft?: boolean; borderRight?: boolean; primary?: boolean; disabled?: boolean
}) {
  const [hov, setHov] = useState(false)
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: 44, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none',
        borderLeft:  borderLeft  ? '1px solid var(--border)' : undefined,
        borderRight: borderRight ? '1px solid var(--border)' : undefined,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'background 0.1s, color 0.1s',
        opacity: disabled ? 0.5 : 1,
        backgroundColor: hov && !disabled
          ? primary ? 'color-mix(in srgb, var(--primary) 14%, transparent)' : 'color-mix(in srgb, var(--foreground) 6%, transparent)'
          : active ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent',
        color: hov && !disabled
          ? (primary ? 'var(--primary)' : 'var(--foreground)')
          : active ? 'var(--primary)' : 'var(--muted-foreground)',
      }}
    >
      {children}
    </button>
  )
}
