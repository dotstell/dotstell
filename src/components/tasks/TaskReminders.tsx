'use client'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

const POLL_INTERVAL  = 60_000          // check every 60 seconds
const REMIND_WINDOW  = 15 * 60 * 1000  // notify if due within 15 minutes
const STORAGE_KEY    = 'dotstell-notified-tasks'

function getNotified(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')) }
  catch { return new Set() }
}

function saveNotified(ids: Set<string>) {
  // keep only last 200 to prevent unbounded growth
  const arr = [...ids].slice(-200)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
}

async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function fireNotification(taskId: string, title: string, minutesLeft: number) {
  const body = minutesLeft <= 1
    ? 'This task is due now!'
    : `Due in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}`

  // Browser notification (if permission granted)
  if (Notification.permission === 'granted') {
    const n = new Notification(`⏰ ${title}`, { body, icon: '/favicon.svg', tag: taskId })
    n.onclick = () => { window.focus(); window.location.href = '/tasks' }
  }

  // In-app toast as fallback / supplement
  toast.warning(`⏰ ${title}`, {
    description: body,
    duration: 8000,
    action: { label: 'View tasks', onClick: () => window.location.href = '/tasks' },
  })
}

export function TaskReminders() {
  const permissionRequested = useRef(false)

  useEffect(() => {
    // Request permission once on mount (only if not already decided)
    if (!permissionRequested.current && 'Notification' in window && Notification.permission === 'default') {
      permissionRequested.current = true
      // Delay slightly so it doesn't fire immediately on app load
      setTimeout(() => requestPermission(), 3000)
    }

    async function checkDueTasks() {
      try {
        const res = await fetch('/api/tasks')
        if (!res.ok) return
        const tasks: { id: string; title: string; due_date?: string | null; status: string }[] = await res.json()
        if (!Array.isArray(tasks)) return

        const now    = Date.now()
        const notified = getNotified()
        let changed  = false

        for (const task of tasks) {
          if (task.status === 'done') continue
          if (!task.due_date) continue
          const due = new Date(task.due_date).getTime()
          const diff = due - now

          // Within reminder window and not yet notified
          if (diff >= 0 && diff <= REMIND_WINDOW && !notified.has(task.id)) {
            const minutesLeft = Math.round(diff / 60_000)
            fireNotification(task.id, task.title || 'Untitled task', minutesLeft)
            notified.add(task.id)
            changed = true
          }

          // Separate key suffix for the overdue notification so a task gets two
          // toasts at most: one "due in N minutes" and one "due now" — not the same
          // toast fired twice, and not suppressed by the earlier REMIND_WINDOW check.
          const overdueKey = `${task.id}-overdue`
          if (diff < 0 && diff > -2 * 60_000 && !notified.has(overdueKey)) {
            fireNotification(task.id, task.title || 'Untitled task', 0)
            notified.add(overdueKey)
            changed = true
          }
        }

        if (changed) saveNotified(notified)
      } catch {
        // silently ignore — reminders are best-effort
      }
    }

    checkDueTasks()
    const interval = setInterval(checkDueTasks, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  return null
}
