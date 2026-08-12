'use client'
import { useState, useEffect } from 'react'
import * as Popover from '@radix-ui/react-popover'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, isToday, addMonths, subMonths,
  startOfWeek, endOfWeek, isSameMonth,
} from 'date-fns'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface Props {
  value: string | null
  onChange: (iso: string | null) => void
  placeholder?: string
}

export function DateTimePicker({ value, onChange, placeholder = 'Pick date & time' }: Props) {
  const parsed = value ? new Date(value) : null

  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState<Date>(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [hour, setHour] = useState(12)
  const [minute, setMinute] = useState(0)
  const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM')

  // Reset internal state to current value each time popover opens
  useEffect(() => {
    if (!open) return
    if (value) {
      const d = new Date(value)
      setSelectedDate(d)
      setViewMonth(d)
      setHour(d.getHours() % 12 || 12)
      setMinute(d.getMinutes())
      setAmpm(d.getHours() >= 12 ? 'PM' : 'AM')
    } else {
      setSelectedDate(null)
      setViewMonth(new Date())
      setHour(12)
      setMinute(0)
      setAmpm('AM')
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  function confirm() {
    if (!selectedDate) { setOpen(false); return }
    const h24 = ampm === 'PM'
      ? (hour === 12 ? 12 : hour + 12)
      : (hour === 12 ? 0 : hour)
    const result = new Date(selectedDate)
    result.setHours(h24, minute, 0, 0)
    onChange(result.toISOString())
    setOpen(false)
  }

  function clear() {
    onChange(null)
    setOpen(false)
  }

  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart),
    end: endOfWeek(monthEnd),
  })

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm transition',
            'focus:outline-none focus:ring-2 focus:ring-[var(--ring)]',
            'hover:border-[var(--ring)]',
            parsed ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
          )}
        >
          <CalendarDays size={14} className="shrink-0 text-[var(--muted-foreground)]" />
          <span className="flex-1 text-left">
            {parsed ? format(parsed, 'MMM d, yyyy  hh:mm aa') : placeholder}
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align="start"
          className="z-[9999] w-[272px] rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl p-3 animate-in fade-in-0 zoom-in-95"
          onInteractOutside={() => setOpen(false)}
        >
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setViewMonth(m => subMonths(m, 1))}
              className="p-1.5 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-semibold text-[var(--foreground)]">
              {format(viewMonth, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth(m => addMonths(m, 1))}
              className="p-1.5 rounded-md hover:bg-[var(--accent)] text-[var(--muted-foreground)] transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-[var(--muted-foreground)] py-0.5">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {days.map(day => {
              const sel = selectedDate ? isSameDay(day, selectedDate) : false
              const inMonth = isSameMonth(day, viewMonth)
              const today = isToday(day)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'h-7 w-full rounded-md text-[11px] transition-colors',
                    sel
                      ? 'bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold'
                      : today
                        ? 'border border-[var(--primary)] text-[var(--primary)] font-medium hover:bg-[var(--accent)]'
                        : inMonth
                          ? 'text-[var(--foreground)] hover:bg-[var(--accent)]'
                          : 'text-[var(--muted-foreground)] opacity-30 hover:bg-[var(--accent)]'
                  )}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>

          {/* Time row */}
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[var(--border)]">
            <span className="text-[11px] text-[var(--muted-foreground)] w-8 shrink-0">Time</span>
            <input
              type="number"
              min={1}
              max={12}
              value={String(hour).padStart(2, '0')}
              onChange={e => {
                const v = parseInt(e.target.value)
                if (!isNaN(v)) setHour(Math.min(12, Math.max(1, v)))
              }}
              className="w-10 text-center text-sm rounded-md border border-[var(--border)] bg-[var(--input)] text-[var(--foreground)] py-1 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            />
            <span className="text-[var(--muted-foreground)] font-semibold text-sm">:</span>
            <input
              type="number"
              min={0}
              max={59}
              value={String(minute).padStart(2, '0')}
              onChange={e => {
                const v = parseInt(e.target.value)
                if (!isNaN(v)) setMinute(Math.min(59, Math.max(0, v)))
              }}
              className="w-10 text-center text-sm rounded-md border border-[var(--border)] bg-[var(--input)] text-[var(--foreground)] py-1 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            />
            <select
              value={ampm}
              onChange={e => setAmpm(e.target.value as 'AM' | 'PM')}
              className="ml-0.5 text-xs rounded-md border border-[var(--border)] bg-[var(--input)] text-[var(--foreground)] py-1 px-1.5 focus:outline-none focus:ring-1 focus:ring-[var(--ring)]"
            >
              <option>AM</option>
              <option>PM</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border)]">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              onClick={clear}
            >
              Clear
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="text-xs"
              onClick={confirm}
              disabled={!selectedDate}
            >
              Confirm
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
