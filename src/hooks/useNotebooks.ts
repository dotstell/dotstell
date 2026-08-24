'use client'
import { useState, useEffect, useCallback } from 'react'
import { Notebook } from '@/types'

export const NOTEBOOK_TAG_PREFIX = 'nb:'

export function notebookTag(name: string) {
  return `${NOTEBOOK_TAG_PREFIX}${name.toLowerCase().replace(/\s+/g, '-')}`
}

export function notebookFromTag(tag: string): string | null {
  if (!tag.startsWith(NOTEBOOK_TAG_PREFIX)) return null
  return tag.slice(NOTEBOOK_TAG_PREFIX.length)
}

const NOTEBOOK_COLORS = [
  '#7c6aff', '#10b981', '#f59e0b', '#ef4444',
  '#06b6d4', '#8b5cf6', '#f97316', '#ec4899',
]
const LEGACY_KEY = 'dotstell-notebooks'
const MIGRATED_KEY = 'dotstell-notebooks-migrated'

let colorIdx = 0
function nextColor(): string {
  return NOTEBOOK_COLORS[colorIdx++ % NOTEBOOK_COLORS.length]
}

type ServerNotebook = Notebook & { sort_order?: number; user_id?: string }

async function fetchNotebooks(): Promise<Notebook[]> {
  const res = await fetch('/api/notebooks')
  if (!res.ok) return []
  const data: ServerNotebook[] = await res.json()
  return data.map(({ id, name, color, icon }) => ({ id, name, color, icon }))
}

async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(MIGRATED_KEY)) return
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) { localStorage.setItem(MIGRATED_KEY, '1'); return }
    const local: Notebook[] = JSON.parse(raw)
    if (!local.length) { localStorage.setItem(MIGRATED_KEY, '1'); return }
    // Check if server already has notebooks (avoid duplicate migration)
    const existing = await fetchNotebooks()
    if (existing.length > 0) { localStorage.setItem(MIGRATED_KEY, '1'); return }
    // Upload each local notebook preserving its id
    await Promise.all(local.map((nb, i) =>
      fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: nb.id, name: nb.name, color: nb.color, icon: nb.icon, sort_order: i }),
      })
    ))
    localStorage.setItem(MIGRATED_KEY, '1')
  } catch {
    // Migration failure is non-fatal; will retry next load until flag is set
  }
}

export function useNotebooks() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])

  useEffect(() => {
    migrateFromLocalStorage().then(() => {
      fetchNotebooks().then(setNotebooks)
    })
  }, [])

  const createNotebook = useCallback(async (name: string, sortIndex: number): Promise<Notebook> => {
    const optimistic: Notebook = {
      id:    crypto.randomUUID(),
      name:  name.trim(),
      color: nextColor(),
      icon:  '📓',
    }
    setNotebooks(prev => [...prev, optimistic])
    try {
      const res = await fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: optimistic.id, name: optimistic.name, color: optimistic.color, icon: optimistic.icon, sort_order: sortIndex }),
      })
      if (res.ok) {
        const saved = await res.json()
        setNotebooks(prev => prev.map(n => n.id === optimistic.id ? { id: saved.id, name: saved.name, color: saved.color, icon: saved.icon } : n))
        return { id: saved.id, name: saved.name, color: saved.color, icon: saved.icon }
      }
    } catch {}
    return optimistic
  }, [])

  const deleteNotebook = useCallback(async (id: string) => {
    setNotebooks(prev => prev.filter(n => n.id !== id))
    try {
      await fetch(`/api/notebooks/${id}`, { method: 'DELETE' })
    } catch {}
  }, [])

  const renameNotebook = useCallback(async (id: string, name: string) => {
    setNotebooks(prev => prev.map(n => n.id === id ? { ...n, name: name.trim() } : n))
    try {
      await fetch(`/api/notebooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
    } catch {}
  }, [])

  const reorderNotebook = useCallback(async (dragId: string, targetId: string) => {
    setNotebooks(prev => {
      const next = [...prev]
      const from = next.findIndex(n => n.id === dragId)
      const to   = next.findIndex(n => n.id === targetId)
      if (from === -1 || to === -1) return prev
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      // Persist new order
      next.forEach((nb, i) => {
        fetch(`/api/notebooks/${nb.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sort_order: i }),
        }).catch(() => {})
      })
      return next
    })
  }, [])

  const setNotebookColor = useCallback(async (id: string, color: string | null) => {
    setNotebooks(prev => prev.map(n => n.id === id ? { ...n, color: color ?? undefined } : n))
    try {
      await fetch(`/api/notebooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ color }),
      })
    } catch {}
  }, [])

  return { notebooks, createNotebook, deleteNotebook, renameNotebook, reorderNotebook, setNotebookColor }
}
