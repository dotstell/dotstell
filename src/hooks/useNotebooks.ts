'use client'
import { useState, useEffect, useCallback } from 'react'
import { Notebook } from '@/types'

const KEY = 'dotstell-notebooks'

function load(): Notebook[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}
function persist(notebooks: Notebook[]) {
  try { localStorage.setItem(KEY, JSON.stringify(notebooks)) } catch {}
}

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

let colorIdx = 0
function nextColor(): string {
  return NOTEBOOK_COLORS[colorIdx++ % NOTEBOOK_COLORS.length]
}

export function useNotebooks() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])

  useEffect(() => { setNotebooks(load()) }, [])

  const createNotebook = useCallback((name: string): Notebook => {
    const nb: Notebook = {
      id:    crypto.randomUUID(),
      name:  name.trim(),
      color: nextColor(),
      icon:  '📓',
    }
    setNotebooks(prev => {
      const next = [...prev, nb]
      persist(next)
      return next
    })
    return nb
  }, [])

  const deleteNotebook = useCallback((id: string) => {
    setNotebooks(prev => {
      const next = prev.filter(n => n.id !== id)
      persist(next)
      return next
    })
  }, [])

  const renameNotebook = useCallback((id: string, name: string) => {
    setNotebooks(prev => {
      const next = prev.map(n => n.id === id ? { ...n, name: name.trim() } : n)
      persist(next)
      return next
    })
  }, [])

  const reorderNotebook = useCallback((dragId: string, targetId: string) => {
    setNotebooks(prev => {
      const next = [...prev]
      const from = next.findIndex(n => n.id === dragId)
      const to   = next.findIndex(n => n.id === targetId)
      if (from === -1 || to === -1) return prev
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      persist(next)
      return next
    })
  }, [])

  return { notebooks, createNotebook, deleteNotebook, renameNotebook, reorderNotebook }
}
