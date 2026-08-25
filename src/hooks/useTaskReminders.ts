import { useEffect } from 'react'

export function useTaskReminders() {
  useEffect(() => {
    if (!('Notification' in window)) return

    async function check() {
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission

      if (permission !== 'granted') return

      const res = await fetch('/api/tasks')
      if (!res.ok) return
      const tasks = await res.json()
      if (!Array.isArray(tasks)) return

      const now = new Date()
      // Normalise both dates to midnight so "today" works regardless of the task's time component
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      const dueSoon = tasks.filter((t: { status: string; due_date: string | null; title: string }) => {
        if (t.status === 'done' || !t.due_date) return false
        const due = new Date(t.due_date)
        const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate())
        const diffDays = Math.ceil((dueDay.getTime() - today.getTime()) / 86400000)
        return diffDays <= 1 // today or overdue
      })

      if (dueSoon.length === 0) return

      // sessionStorage key is date-scoped so the user gets at most one notification
      // per calendar day per browser tab. localStorage would survive a tab close;
      // sessionStorage is intentionally ephemeral so a new session gets a fresh check.
      const key = 'dotstell-notified-' + today.toDateString()
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')

      const overdue  = dueSoon.filter((t: { due_date: string }) => new Date(t.due_date) < now)
      const dueToday = dueSoon.filter((t: { due_date: string }) => new Date(t.due_date) >= now)

      let body = ''
      if (overdue.length > 0)  body += `${overdue.length} overdue. `
      if (dueToday.length > 0) body += `${dueToday.length} due today.`

      new Notification('Dotstell — Task reminder', {
        body: body.trim(),
        icon: '/favicon.svg',
        tag: 'dotstell-tasks',
      })
    }

    check()
  }, [])
}
