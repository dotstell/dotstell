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


type ServerNotebook = Notebook & { sort_order?: number; user_id?: string }

async function fetchNotebooks(): Promise<Notebook[]> {
  const res = await fetch('/api/notebooks')
  if (!res.ok) return []
  const data: ServerNotebook[] = await res.json()
  return data.map(({ id, name, color, icon }) => ({ id, name, color, icon }))
}

// Runs once per browser profile: uploads any notebooks that were stored in localStorage
// before the server-sync migration, preserving their IDs so existing nb: tags still resolve.
async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === 'undefined') return
  if (localStorage.getItem(MIGRATED_KEY)) return
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) { localStorage.setItem(MIGRATED_KEY, '1'); return }
    const local: Notebook[] = JSON.parse(raw)
    if (!local.length) { localStorage.setItem(MIGRATED_KEY, '1'); return }
    // Skip upload if server already has data — user signed in on another device first
    const existing = await fetchNotebooks()
    if (existing.length > 0) { localStorage.setItem(MIGRATED_KEY, '1'); return }
    const results = await Promise.all(local.map((nb, i) =>
      fetch('/api/notebooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // _migrate flag unlocks client-supplied id; required to preserve nb: tag references
        body: JSON.stringify({ id: nb.id, name: nb.name, color: nb.color, icon: nb.icon, sort_order: i, _migrate: true }),
      })
    ))
    // Only mark migration done if every notebook was saved — partial failure retries on next load
    if (results.every(r => r.ok)) localStorage.setItem(MIGRATED_KEY, '1')
  } catch {
    // Non-fatal: flag not set, so it retries on next load until it succeeds
  }
}

export function useNotebooks() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])

  useEffect(() => {
    migrateFromLocalStorage().then(() => {
      fetchNotebooks().then(setNotebooks)
    })
  }, [])

  // sortIndex must come from the caller (notebooks.length) — never use Date.now() here:
  // sort_order is a PG INTEGER (max ~2.1B) and Date.now() in 2026 is ~1.78T, which overflows.
  const createNotebook = useCallback(async (name: string, sortIndex: number): Promise<Notebook | null> => {
    const optimistic: Notebook = {
      id:    crypto.randomUUID(),
      name:  name.trim(),
      color: NOTEBOOK_COLORS[sortIndex % NOTEBOOK_COLORS.length], // stable, no global counter
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
      // Non-ok response: remove the ghost notebook so state matches the server
      setNotebooks(prev => prev.filter(n => n.id !== optimistic.id))
      return null
    } catch {
      setNotebooks(prev => prev.filter(n => n.id !== optimistic.id))
      return null
    }
  }, [])

  const deleteNotebook = useCallback(async (id: string) => {
    const snapshot = notebooks
    setNotebooks(prev => prev.filter(n => n.id !== id))
    try {
      const res = await fetch(`/api/notebooks/${id}`, { method: 'DELETE' })
      if (!res.ok) setNotebooks(snapshot)
    } catch {
      setNotebooks(snapshot)
    }
  }, [notebooks])

  const renameNotebook = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim()
    const snapshot = notebooks
    setNotebooks(prev => prev.map(n => n.id === id ? { ...n, name: trimmed } : n))
    try {
      const res = await fetch(`/api/notebooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) setNotebooks(snapshot)
    } catch {
      setNotebooks(snapshot)
    }
  }, [notebooks])

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
