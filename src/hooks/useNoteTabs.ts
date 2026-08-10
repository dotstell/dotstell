'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

export interface NoteTab {
  id: string
  title: string
}

const KEY        = 'dotstell-note-tabs'
const ACTIVE_KEY = 'dotstell-note-active-tab'
const MAX        = 12
const EVT        = 'dotstell:note-tabs-change'

function load(): NoteTab[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? '[]') } catch { return [] }
}
function persist(tabs: NoteTab[]) {
  if (typeof window === 'undefined') return
  try { sessionStorage.setItem(KEY, JSON.stringify(tabs)) } catch {}
}
function loadActive(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(ACTIVE_KEY)
}
function persistActive(id: string | null) {
  if (typeof window === 'undefined') return
  if (id) sessionStorage.setItem(ACTIVE_KEY, id)
  else sessionStorage.removeItem(ACTIVE_KEY)
}
function broadcast() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVT))
}

export function useNoteTabs(currentId?: string) {
  const [tabs,     setTabs]     = useState<NoteTab[]>(() => load())
  const [activeId, setActiveId] = useState<string | null>(() => loadActive())
  // Guard: only call openTab once per currentId mount
  const openedRef = useRef<string | null>(null)

  // Sync from sessionStorage whenever another instance broadcasts a change
  useEffect(() => {
    function onSync() {
      setTabs(load())
      setActiveId(loadActive())
    }
    window.addEventListener(EVT, onSync)
    return () => window.removeEventListener(EVT, onSync)
  }, [])

  // When the URL changes to a new note, ensure it's in the tab list.
  // We call openTab ourselves here for the layout instance — page instance
  // also calls it, but duplicate calls are idempotent.
  useEffect(() => {
    if (!currentId || openedRef.current === currentId) return
    // Don't open a tab unless we already have a title (page sets it).
    // Just mark it active so the bar highlights immediately.
    const current = load()
    const exists  = current.find(t => t.id === currentId)
    if (exists) {
      openedRef.current = currentId
      persistActive(currentId)
      setActiveId(currentId)
      broadcast()
    }
  }, [currentId])

  const openTab = useCallback((id: string, title: string) => {
    const current = load()
    const exists  = current.some(t => t.id === id)
    let next: NoteTab[]
    if (exists) {
      next = current.map(t => t.id === id ? { ...t, title } : t)
    } else {
      next = [...current, { id, title }].slice(-MAX)
    }
    persist(next)
    persistActive(id)
    // Synchronously update state so the same instance sees it immediately
    setTabs(next)
    setActiveId(id)
    broadcast()
  }, [])

  const closeTab = useCallback((id: string): string | null => {
    const current = load()
    const idx     = current.findIndex(t => t.id === id)
    if (idx === -1) return null
    const next    = current.filter(t => t.id !== id)
    persist(next)
    const nextActive = next.length > 0 ? next[Math.min(idx, next.length - 1)].id : null
    persistActive(nextActive)
    setTabs(next)
    setActiveId(nextActive)
    broadcast()
    return nextActive
  }, [])

  const updateTitle = useCallback((id: string, title: string) => {
    const current = load()
    const next    = current.map(t => t.id === id ? { ...t, title } : t)
    persist(next)
    setTabs(next)
    broadcast()
  }, [])

  return { tabs, activeId, openTab, closeTab, updateTitle }
}
