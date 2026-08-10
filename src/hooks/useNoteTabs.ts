'use client'
import { useState, useEffect, useCallback } from 'react'

export interface NoteTab {
  id: string
  title: string
}

const KEY        = 'dotstell-note-tabs'
const ACTIVE_KEY = 'dotstell-note-active-tab'
const MAX        = 12

function load(): NoteTab[] {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? '[]') } catch { return [] }
}
function persist(tabs: NoteTab[]) {
  try { sessionStorage.setItem(KEY, JSON.stringify(tabs)) } catch {}
}
function loadActive(): string | null {
  return sessionStorage.getItem(ACTIVE_KEY)
}
function persistActive(id: string | null) {
  if (id) sessionStorage.setItem(ACTIVE_KEY, id)
  else sessionStorage.removeItem(ACTIVE_KEY)
}

const EVT = 'dotstell:note-tabs-change'

export function useNoteTabs(currentId?: string) {
  const [tabs,     setTabs]     = useState<NoteTab[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    setTabs(load())
    setActiveId(loadActive())
  }, [])

  // Sync across layout <-> page instances
  useEffect(() => {
    function onSync() {
      setTabs(load())
      setActiveId(loadActive())
    }
    window.addEventListener(EVT, onSync)
    return () => window.removeEventListener(EVT, onSync)
  }, [])

  // When the page navigates to a note, mark it active
  useEffect(() => {
    if (!currentId) return
    const stored = loadActive()
    if (stored !== currentId) {
      persistActive(currentId)
      setActiveId(currentId)
      window.dispatchEvent(new Event(EVT))
    }
  }, [currentId])

  const openTab = useCallback((id: string, title: string) => {
    setTabs(prev => {
      const exists = prev.some(t => t.id === id)
      let next: NoteTab[]
      if (exists) {
        next = prev.map(t => t.id === id ? { ...t, title } : t)
      } else {
        next = [...prev, { id, title }].slice(-MAX)
      }
      persist(next)
      return next
    })
    persistActive(id)
    setActiveId(id)
    window.dispatchEvent(new Event(EVT))
  }, [])

  // Returns the id to navigate to next, or null if no tabs left
  const closeTab = useCallback((id: string): string | null => {
    const current = load()
    const idx     = current.findIndex(t => t.id === id)
    if (idx === -1) return null
    const next = current.filter(t => t.id !== id)
    persist(next)
    setTabs(next)

    const nextActive = next.length > 0 ? next[Math.min(idx, next.length - 1)].id : null
    persistActive(nextActive)
    setActiveId(nextActive)
    window.dispatchEvent(new Event(EVT))
    return nextActive
  }, [])

  const updateTitle = useCallback((id: string, title: string) => {
    setTabs(prev => {
      const next = prev.map(t => t.id === id ? { ...t, title } : t)
      persist(next)
      return next
    })
    window.dispatchEvent(new Event(EVT))
  }, [])

  return { tabs, activeId, openTab, closeTab, updateTitle }
}
