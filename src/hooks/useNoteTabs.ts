'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

export interface NoteTab {
  id: string
  title: string
  modified?: boolean
}

const KEY        = 'dotstell-note-tabs'
const ACTIVE_KEY = 'dotstell-note-active-tab'
const MAX        = 20
const EVT        = 'dotstell:note-tabs-change'

// localStorage so tabs survive page refresh (like Notepad++/Sublime)
function load(): NoteTab[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}
function persist(tabs: NoteTab[]) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(KEY, JSON.stringify(tabs)) } catch {}
}
function loadActive(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACTIVE_KEY)
}
function persistActive(id: string | null) {
  if (typeof window === 'undefined') return
  if (id) localStorage.setItem(ACTIVE_KEY, id)
  else localStorage.removeItem(ACTIVE_KEY)
}
function broadcast() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVT))
}

export function useNoteTabs(currentId?: string) {
  const [tabs,     setTabs]     = useState<NoteTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  // openedRef tracks the last note we explicitly activated so the URL-change effect
  // doesn't re-activate the same tab on every re-render (it only fires once per new id)
  const openedRef = useRef<string | null>(null)

  useEffect(() => {
    // Load from localStorage after mount — avoids SSR/client hydration mismatch (#418)
    setTabs(load())
    setActiveId(loadActive())
    function onSync() { setTabs(load()); setActiveId(loadActive()) }
    window.addEventListener(EVT, onSync)
    return () => window.removeEventListener(EVT, onSync)
  }, [])

  // Activate tab when URL changes to a note that's already in the list
  useEffect(() => {
    if (!currentId || openedRef.current === currentId) return
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
      next = current.map(t => t.id === id ? { ...t, title, modified: false } : t)
    } else {
      next = [...current, { id, title, modified: false }].slice(-MAX)
    }
    openedRef.current = id
    persist(next)
    persistActive(id)
    setTabs(next)
    setActiveId(id)
    broadcast()
  }, [])

  const closeTab = useCallback((id: string): string | null => {
    const current = load()
    const idx     = current.findIndex(t => t.id === id)
    if (idx === -1) return null
    const next      = current.filter(t => t.id !== id)
    const curActive = loadActive()
    let nextActive: string | null = curActive !== id ? curActive : null
    if (!nextActive && next.length > 0) {
      // prefer right neighbour, fallback left
      nextActive = (next[idx] ?? next[idx - 1])?.id ?? null
    }
    persist(next)
    persistActive(nextActive)
    setTabs(next)
    setActiveId(nextActive)
    broadcast()
    return nextActive
  }, [])

  const closeOtherTabs = useCallback((id: string) => {
    const current = load()
    const next = current.filter(t => t.id === id)
    persist(next)
    persistActive(id)
    setTabs(next)
    setActiveId(id)
    broadcast()
  }, [])

  const closeAllTabs = useCallback(() => {
    persist([])
    persistActive(null)
    setTabs([])
    setActiveId(null)
    broadcast()
  }, [])

  const updateTitle = useCallback((id: string, title: string) => {
    const current = load()
    const next    = current.map(t => t.id === id ? { ...t, title } : t)
    persist(next)
    setTabs(next)
    broadcast()
  }, [])

  const markModified = useCallback((id: string, modified: boolean) => {
    const current = load()
    const next    = current.map(t => t.id === id ? { ...t, modified } : t)
    persist(next)
    setTabs(next)
    broadcast()
  }, [])

  return { tabs, activeId, openTab, closeTab, closeOtherTabs, closeAllTabs, updateTitle, markModified }
}
