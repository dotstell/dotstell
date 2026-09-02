'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowRight, AlertCircle, TrendingUp, FileText, Bookmark,
  CheckSquare, Users, Plus, Zap, Activity,
  CheckCircle2, Circle, Timer, Sparkles, Loader2, RefreshCw, Tag,
} from 'lucide-react'
import { AppLayout } from '@/components/layout/AppLayout'
import { Task, Note, Bookmark as BookmarkType } from '@/types'
import { formatDate, formatRelative } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import { useTaskReminders } from '@/hooks/useTaskReminders'
import { PageContainer } from '@/components/layout/PageContainer'
import { useAISettings } from '@/hooks/useAISettings'
import { isLocalHostname, completeOllamaBrowser } from '@/lib/ai/ollama-browser'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'
import { MarkdownContent } from '@/components/ui/MarkdownContent'

const PRIORITY_COLOR: Record<string, string> = { low: '#10b981', medium: '#f59e0b', high: '#ef4444' }
const STATUS_COLOR:   Record<string, string> = { todo: 'var(--muted-foreground)', in_progress: 'var(--primary)', done: '#10b981' }
const STATUS_ICON = {
  todo:        <Circle      size={12} color="var(--muted-foreground)" />,
  in_progress: <Timer       size={12} color="var(--primary)" />,
  done:        <CheckCircle2 size={12} color="#10b981" />,
}
const NOTE_TYPE_COLOR: Record<string, string> = { markdown: 'var(--primary)', plain: 'var(--muted-foreground)', checklist: '#10b981' }
const NOTE_TYPE_LABEL: Record<string, string> = { markdown: 'Rich text', plain: 'Plain', checklist: 'Checklist' }

// ── Tiny Sparkline (SVG) ─────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 64, h = 24
  const coords = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - (v / max) * (h - 4) - 2,
  }))

  // Build a smooth cubic Bézier path through all points
  function smoothPath(pts: { x: number; y: number }[]) {
    if (pts.length === 0) return ''
    let d = `M ${pts[0].x},${pts[0].y}`
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1]
      const curr = pts[i]
      const cpX = (prev.x + curr.x) / 2
      d += ` C ${cpX},${prev.y} ${cpX},${curr.y} ${curr.x},${curr.y}`
    }
    return d
  }

  const linePath = smoothPath(coords)
  const first = coords[0], last = coords[coords.length - 1]
  const areaPath = `${linePath} L ${last.x},${h} L ${first.x},${h} Z`

  return (
    <svg width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      <path d={areaPath} fill={color} opacity={0.1} />
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.75}
      />
    </svg>
  )
}

// ── Stat card sparkline data — items created per day (last 7d) ─
function buildSparkline(items: { created_at: string }[]): number[] {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
  return days.map(day => items.filter(i => i.created_at.slice(0, 10) === day).length)
}

// Items captured or updated per day over the last 14 days
function build14DayActivity(notes: Note[], bookmarks: BookmarkType[]): number[] {
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    return d.toISOString().slice(0, 10)
  })
  return days.map(day =>
    notes.filter(n => n.updated_at.slice(0, 10) === day).length +
    bookmarks.filter(b => b.created_at.slice(0, 10) === day).length
  )
}

// ── DigestContent: renders AI briefing reliably regardless of model format ─
// Parses the raw text from any model (Ollama or cloud), splits at "Key Action
// Items", and renders each section with custom JSX — no markdown parsing quirks.
// Matches any "action items" heading the model might output:
// "Key Action Items", "Action Items", "Key Actions", "Actions:", etc.
const ACTION_SECTION_RE = /(?:key\s+)?action\s+items?|key\s+actions?/i

function DigestContent({ text }: { text: string }) {
  const splitIdx = text.search(ACTION_SECTION_RE)
  const rawInsights = splitIdx >= 0 ? text.slice(0, splitIdx) : text
  const rawActions  = splitIdx >= 0 ? text.slice(splitIdx) : ''

  const insights = rawInsights.split('\n')
    .map(l => l.replace(/^[-•*·▸]\s+/, '').replace(/^\d+\.\s+/, '').trim())
    .filter(l => l && !/^#+/.test(l) && !ACTION_SECTION_RE.test(l))

  const actions = rawActions.split('\n')
    .map(l => l.replace(/^[-•*·▸]\s+/, '').replace(/^\d+\.\s+/, '').trim())
    .filter(l => l && !/^#+/.test(l) && !ACTION_SECTION_RE.test(l))

  return (
    <div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {insights.map((item, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              backgroundColor: 'var(--primary)', flexShrink: 0,
              marginTop: 7, opacity: 0.75,
            }} />
            <span style={{ flex: 1, lineHeight: 1.65 }}>
              <MarkdownContent compact>{item}</MarkdownContent>
            </span>
          </li>
        ))}
      </ul>
      {actions.length > 0 && (
        <div style={{
          marginTop: 16, paddingTop: 14,
          borderTop: '1px solid color-mix(in srgb, var(--border) 80%, transparent)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <Zap size={11} color="var(--primary)" />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--primary)' }}>
              Key Action Items
            </span>
          </div>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {actions.map((action, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{
                  flexShrink: 0, width: 18, height: 18, borderRadius: '50%',
                  backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)',
                  color: 'var(--primary)', fontSize: 10, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 2,
                }}>{i + 1}</span>
                <span style={{ flex: 1, lineHeight: 1.6 }}>
                  <MarkdownContent compact>{action}</MarkdownContent>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

// ── Knowledge Connections (pure client-side) ─────────────────
function findKnowledgeConnections(notes: Note[], bookmarks: BookmarkType[]): {
  source: Note; keywords: string[]; connections: { type: 'note' | 'bookmark'; id: string; title: string; href: string; external?: boolean }[]
} | null {
  const STOP = new Set(['with', 'that', 'this', 'from', 'your', 'have', 'been', 'will', 'about', 'into', 'more', 'when', 'what', 'which', 'their', 'there', 'here', 'note', 'just', 'also', 'some', 'than', 'then', 'them', 'they', 'were', 'would', 'could', 'should', 'does', 'make', 'like', 'very', 'using', 'used', 'need', 'want', 'each', 'both'])

  const source = notes.find(n => n.title && n.title.trim().length > 4)
  if (!source) return null

  const keywords = source.title
    .toLowerCase()
    .split(/[\s\-_/,]+/)
    .filter(w => w.length > 3 && !STOP.has(w) && /^[a-z]/.test(w))
  if (keywords.length === 0) return null

  const scored = [
    ...notes.filter(n => n.id !== source.id && n.title && n.title.trim().length > 3).map(n => ({
      type: 'note' as const, id: n.id, title: n.title, href: `/notes/${n.id}`,
      score: keywords.filter(kw => n.title.toLowerCase().includes(kw) || (n.tags ?? []).some(t => t.includes(kw))).length,
    })),
    ...bookmarks.filter(b => b.title).map(b => ({
      type: 'bookmark' as const, id: b.id, title: b.title || b.hostname || '', href: b.url, external: true,
      score: keywords.filter(kw => (b.title || '').toLowerCase().includes(kw) || (b.tags ?? []).some(t => t.includes(kw))).length,
    })),
  ].filter(c => c.score > 0 && c.title).sort((a, b) => b.score - a.score).slice(0, 4)

  if (scored.length < 2) return null
  return { source, keywords: keywords.slice(0, 3), connections: scored }
}

export default function DashboardPage() {
  const [notes,     setNotes]     = useState<Note[]>([])
  const [tasks,     setTasks]     = useState<Task[]>([])
  const [bookmarks, setBookmarks] = useState<BookmarkType[]>([])
  const [people,    setPeople]    = useState<{ id: string; created_at: string }[]>([])
  const [loading,   setLoading]   = useState(true)
  const [isMobile,  setIsMobile]  = useState(false)
  const [greeting,  setGreeting]  = useState('Hello')
  const { config: aiConfig, isConfigured: aiConfigured } = useAISettings()
  const [digest,        setDigest]        = useState('')
  const [digestLoading, setDigestLoading] = useState(false)
  const [digestError,   setDigestError]   = useState<string | null>(null)
  const [digestPeriod,  setDigestPeriod]  = useState<'day' | 'week'>('week')
  const [tagSuggestions, setTagSuggestions] = useState<Record<string, string[]>>({})
  const [dismissedSugs, setDismissedSugs] = useState<Set<string>>(new Set())
  const [suggestingTags, setSuggestingTags] = useState(false)
  const [selectedTags, setSelectedTags] = useState<Record<string, Set<string>>>({})
  const [unindexedCount, setUnindexedCount] = useState<number | null>(null)
  const [activeTip, setActiveTip] = useState<string | null>(null)
  const [digestEmpty, setDigestEmpty] = useState(false)
  const [tagSuggestError, setTagSuggestError] = useState<string | null>(null)

  async function generateDigest(period: 'day' | 'week') {
    setDigest(''); setDigestError(null); setDigestEmpty(false); setDigestLoading(true)
    try {
      // On live app + Ollama: fetch notes browser-side and call Ollama through the Local Agent
      if (aiConfig.provider === 'ollama' && !isLocalHostname()) {
        const supabase = createSupabaseBrowserClient()
        const since = new Date()
        if (period === 'day') since.setDate(since.getDate() - 1)
        else                  since.setDate(since.getDate() - 7)
        const { data: recentNotes } = await supabase
          .from('notes')
          .select('title, content, updated_at')
          .is('deleted_at', null)
          .gte('updated_at', since.toISOString())
          .order('updated_at', { ascending: false })
          .limit(30)
        const hasOllamaContent = (recentNotes?.length ?? 0) > 0 || overdueTasks.length > 0 || inProgress.length > 0 || bookmarks.length > 0
        if (!hasOllamaContent) {
          setDigestEmpty(true)
          return
        }
        const noteList = (recentNotes ?? []).map(n =>
          `• ${n.title || 'Untitled'} (updated ${new Date(n.updated_at).toLocaleDateString()}): ${
            n.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 300)
          }`
        ).join('\n')
        const taskContext = overdueTasks.length > 0
          ? `\n\nOverdue tasks (${overdueTasks.length}): ${overdueTasks.map(t => `"${t.title}" (${t.priority} priority, was due ${new Date(t.due_date!).toLocaleDateString()})`).join(', ')}`
          : ''
        const inProgressContext = inProgress.length > 0
          ? `\nIn-progress tasks: ${inProgress.map(t => `"${t.title}"`).join(', ')}`
          : ''
        const bookmarkContext = bookmarks.length > 0
          ? `\n\nRecently saved bookmarks (${bookmarks.slice(0,5).length}): ${bookmarks.slice(0,5).map(b => b.title || b.url).join(' | ')}`
          : ''
        const organizeCtx = untaggedNotes > 0 ? `\n\n${untaggedNotes} notes and ${untaggedBmarks} bookmarks need organizing (no tags yet).` : ''
        const result = await completeOllamaBrowser(aiConfig, [
          { role: 'system', content: `You are a personal knowledge assistant. Generate an AI digest.\n\nFORMAT — replace labels with real subjects from the data:\n**Project Alpha:** Three new risk metrics added this week covering deployment scope.\n**Team Sync:** Strategy doc needs completion before Thursday's meeting.\n[scale with the data: 1 line for a quiet day, as many as needed for a busy one]\n\nKey Action Items\n1. Concrete action derived from the data.\n[real next steps only — include as few as 1 or as many as needed]\n\nRULES:\n- Replace the **bold label** with the actual subject — never write "Topic" as the label.\n- One line per distinct topic. Group closely related notes into one line.\n- The "Key Action Items" section must always appear.\n- No intro sentence, no closing remarks.` },
          { role: 'user',   content: `Here are the notes I worked on in the last ${period === 'day' ? '24 hours' : 'week'}:\n\n${noteList}${taskContext}${inProgressContext}${bookmarkContext}${organizeCtx}` },
        ])
        setDigest(result)
        return
      }
      // Cloud providers: server-side route
      const res  = await fetch('/api/ai/digest', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ config: aiConfig, period }),
      })
      const ct = res.headers.get('content-type') ?? ''
      if (!ct.includes('application/json')) {
        throw new Error(`Digest request failed (${res.status})`)
      }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Digest failed')
      if (data.empty) { setDigestEmpty(true); return }
      setDigest(data.digest)
    } catch (err) {
      setDigestError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setDigestLoading(false)
    }
  }

  async function generateTagSuggestions() {
    if (!aiConfigured || suggestingTags || (queueNotes.length === 0 && queueBmarks.length === 0)) return
    setSuggestingTags(true)
    setTagSuggestError(null)
    // Collect existing tag vocabulary for context — helps AI reuse consistent tags
    const existingTags = [...new Set([
      ...notes.flatMap(n => (n.tags ?? []).filter(t => !t.startsWith('nb:'))),
      ...bookmarks.flatMap(b => b.tags ?? []),
    ])].slice(0, 30)
    try {
      const results: Record<string, string[]> = {}
      const sysPrompt = existingTags.length > 0
        ? `You are a tagging assistant. Suggest 3-5 tags. Reuse existing tags where relevant: [${existingTags.join(', ')}]. Return ONLY a JSON array of lowercase kebab-case strings. Example: ["tag-one","tag-two"]`
        : 'You are a tagging assistant. Suggest 3-5 tags for this content. Return ONLY a JSON array of lowercase kebab-case strings. Example: ["tag-one","tag-two"]'

      // Notes
      await Promise.all(queueNotes.map(async (note) => {
        if (dismissedSugs.has(note.id)) return
        const plainText = (note.content ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        if (plainText.length < 20 && !note.title) return
        try {
          if (aiConfig.provider === 'ollama' && !isLocalHostname()) {
            const result = await completeOllamaBrowser(aiConfig, [
              { role: 'system', content: sysPrompt },
              { role: 'user', content: `Title: ${note.title || 'Untitled'}\n${plainText.slice(0, 500)}` },
            ])
            const match = result.match(/\[[\s\S]*?\]/)
            if (match) {
              const tags = JSON.parse(match[0])
              if (Array.isArray(tags)) results[note.id] = (tags as string[]).slice(0, 5)
            }
          } else {
            const res = await fetch('/api/ai/tags', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ config: aiConfig, content: note.content, title: note.title, existingTags }),
            })
            const data = await res.json()
            if (data.tags) results[note.id] = data.tags as string[]
          }
        } catch { /* skip individual failures silently */ }
      }))

      // Bookmarks
      await Promise.all(queueBmarks.map(async (bm) => {
        if (dismissedSugs.has(bm.id)) return
        const text = [bm.title, bm.description, bm.hostname].filter(Boolean).join(' ')
        if (!text.trim()) return
        try {
          if (aiConfig.provider === 'ollama' && !isLocalHostname()) {
            const result = await completeOllamaBrowser(aiConfig, [
              { role: 'system', content: sysPrompt },
              { role: 'user', content: `Bookmark: ${text.slice(0, 400)}` },
            ])
            const match = result.match(/\[[\s\S]*?\]/)
            if (match) {
              const tags = JSON.parse(match[0])
              if (Array.isArray(tags)) results[bm.id] = (tags as string[]).slice(0, 5)
            }
          } else {
            const res = await fetch('/api/ai/tags', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ config: aiConfig, content: text, title: bm.title, existingTags }),
            })
            const data = await res.json()
            if (data.tags) results[bm.id] = data.tags as string[]
          }
        } catch { /* skip individual failures silently */ }
      }))

      if (Object.keys(results).length === 0) {
        setTagSuggestError('No suggestions returned — check your AI connection or try again.')
      } else {
        setTagSuggestions(prev => ({ ...prev, ...results }))
        setSelectedTags(prev => {
          const next = { ...prev }
          for (const [id, tags] of Object.entries(results)) {
            next[id] = new Set(tags)
          }
          return next
        })
      }
    } finally {
      setSuggestingTags(false)
    }
  }

  async function applyTagSuggestion(itemId: string, applyAll = false) {
    const tagsToApply = applyAll
      ? (tagSuggestions[itemId] ?? [])
      : Array.from(selectedTags[itemId] ?? new Set(tagSuggestions[itemId] ?? []))
    if (tagsToApply.length === 0) return

    const isBookmark = bookmarks.some(b => b.id === itemId)
    if (isBookmark) {
      const bm = bookmarks.find(b => b.id === itemId)
      if (!bm) return
      const merged = [...new Set([...(bm.tags ?? []), ...tagsToApply])]
      await fetch(`/api/bookmarks/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: merged }),
      })
      setBookmarks(prev => prev.map(b => b.id === itemId ? { ...b, tags: merged } : b))
    } else {
      const note = notes.find(n => n.id === itemId)
      if (!note) return
      const merged = [...new Set([...(note.tags ?? []), ...tagsToApply])]
      await fetch(`/api/notes/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: merged }),
      })
      setNotes(prev => prev.map(n => n.id === itemId ? { ...n, tags: merged } : n))
    }
    setTagSuggestions(prev => { const p = { ...prev }; delete p[itemId]; return p })
    setSelectedTags(prev => { const p = { ...prev }; delete p[itemId]; return p })
  }

  function dismissTagSuggestion(noteId: string) {
    setDismissedSugs(prev => new Set([...prev, noteId]))
    setTagSuggestions(prev => { const p = { ...prev }; delete p[noteId]; return p })
    setSelectedTags(prev => { const p = { ...prev }; delete p[noteId]; return p })
  }

  function toggleTagSelection(noteId: string, tag: string) {
    setSelectedTags(prev => {
      const current = new Set(prev[noteId] ?? tagSuggestions[noteId] ?? [])
      if (current.has(tag)) current.delete(tag); else current.add(tag)
      return { ...prev, [noteId]: current }
    })
  }

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768 || window.matchMedia('(pointer: coarse)').matches) }
    check()
    window.addEventListener('resize', check)
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening')
    return () => window.removeEventListener('resize', check)
  }, [])

  useTaskReminders()

  useEffect(() => {
    async function load() {
      const [nr, pr, br, tr] = await Promise.all([
        fetch('/api/notes?root_only=true'),
        fetch('/api/people'),
        fetch('/api/bookmarks'),
        fetch('/api/tasks'),
      ])
      const [n, p, b, t] = await Promise.all([nr.json(), pr.json(), br.json(), tr.json()])
      setNotes(Array.isArray(n) ? n : [])
      setPeople(Array.isArray(p) ? p : [])
      setBookmarks(Array.isArray(b) ? b : [])
      setTasks(Array.isArray(t) ? t : [])
      setLoading(false)
      // Count items missing embeddings (not yet searchable via AI)
      const supabase = createSupabaseBrowserClient()
      const [{ count: notesNullEmbed }, { count: bmarksNullEmbed }] = await Promise.all([
        supabase.from('notes').select('id', { count: 'exact', head: true })
          .is('deleted_at', null).is('embedding', null),
        supabase.from('bookmarks').select('id', { count: 'exact', head: true })
          .is('embedding', null),
      ])
      const total = (notesNullEmbed ?? 0) + (bmarksNullEmbed ?? 0)
      if (total > 0) setUnindexedCount(total)
    }
    load()
  }, [])

  const openTasks    = tasks.filter(t => t.status !== 'done')
  const overdueTasks = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done')
  const doneTasks    = tasks.filter(t => t.status === 'done')
  const inProgress   = tasks.filter(t => t.status === 'in_progress')
  const progress     = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0

  // Live clock — updates every minute
  const [clockDate, setClockDate] = useState(() => new Date())
  useEffect(() => {
    const tick = () => setClockDate(new Date())
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [])
  const clockTime = clockDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const clockDay  = clockDate.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  const now             = Date.now()
  const STALE_MS           = 30 * 24 * 60 * 60 * 1000
  const STALE_BMARK_MS     = 90 * 24 * 60 * 60 * 1000
  const untaggedNoteItems  = notes.filter(n => !(n.tags ?? []).filter(t => !t.startsWith('nb:')).length)
  const untaggedBmarkItems = bookmarks.filter(b => !(b.tags ?? []).length)
  const untaggedNotes      = untaggedNoteItems.length
  const untaggedBmarks     = untaggedBmarkItems.length
  const staleNotes         = notes.filter(n => (now - new Date(n.updated_at).getTime()) > STALE_MS).length
  const staleBookmarks     = bookmarks.filter(b => (now - new Date(b.created_at).getTime()) > STALE_BMARK_MS).length
  const emptyNotes         = notes.filter(n => (n.content ?? '').replace(/<[^>]+>/g, '').trim().length < 10).length
  const uniqueTopics       = new Set(notes.flatMap(n => (n.tags ?? []).filter(t => !t.startsWith('nb:')))).size
  const activity14         = build14DayActivity(notes, bookmarks)
  const activityThisWeek   = activity14.slice(7).reduce((s, v) => s + v, 0)
  const activityLastWeek   = activity14.slice(0, 7).reduce((s, v) => s + v, 0)
  const activityStreak     = (() => { let s = 0; for (let i = activity14.length - 1; i >= 0; i--) { if (activity14[i] > 0) s++; else break } return s })()
  const pctOrganized       = notes.length > 0 ? Math.round(((notes.length - untaggedNotes) / notes.length) * 100) : 100
  const queueNotes  = untaggedNoteItems.slice(0, 4)
  const queueBmarks = untaggedBmarkItems.slice(0, Math.max(0, 5 - queueNotes.length))
  const focusTasks  = [...openTasks].sort((a, b) => {
    const aOv = a.due_date && new Date(a.due_date) < new Date()
    const bOv = b.due_date && new Date(b.due_date) < new Date()
    if (aOv && !bOv) return -1
    if (!aOv && bOv) return 1
    if (a.due_date && b.due_date) return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    if (a.due_date && !b.due_date) return -1
    if (!a.due_date && b.due_date) return 1
    const p: Record<string, number> = { high: 0, medium: 1, low: 2 }
    return (p[a.priority] ?? 1) - (p[b.priority] ?? 1)
  }).slice(0, 4)

  const connections = findKnowledgeConnections(notes, bookmarks)

  const STATS = [
    {
      label: 'Notes',     count: notes.length,      icon: FileText,  href: '/notes',
      color: 'var(--primary)',   spark: buildSparkline(notes),
    },
    {
      label: 'People',    count: people.length,     icon: Users,     href: '/people',
      color: '#10b981',   spark: buildSparkline(people),
    },
    {
      label: 'Bookmarks', count: bookmarks.length,  icon: Bookmark,  href: '/bookmarks',
      color: '#f59e0b',   spark: buildSparkline(bookmarks),
    },
    {
      label: 'Open tasks',count: openTasks.length,  icon: CheckSquare, href: '/tasks',
      color: overdueTasks.length > 0 ? '#ef4444' : 'var(--primary)',
      spark: buildSparkline(openTasks),
    },
  ]

  return (
    <AppLayout>
      <PageContainer>

        {/* ── Greeting + live clock ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 24, paddingTop: isMobile ? 8 : 0 }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{greeting} 👋</h1>
            <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginTop: 4 }}>
              {loading ? 'Loading your knowledge…' :
                `${openTasks.length} open task${openTasks.length !== 1 ? 's' : ''}${overdueTasks.length > 0 ? ` · ${overdueTasks.length} overdue` : ' · all on track'} · ${notes.length} notes · ${bookmarks.length} bookmarks`}
            </p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: isMobile ? 20 : 24, fontWeight: 700, color: 'var(--foreground)', margin: 0, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
              {clockTime}
            </p>
            <p style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 3 }}>{clockDay}</p>
          </div>
        </div>

        {/* ── Overdue alert ── */}
        {!loading && overdueTasks.length > 0 && (
          <div role='alert' aria-live='polite' style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '11px 16px', borderRadius: 10, marginBottom: 20,
            backgroundColor: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)',
          }}>
            <AlertCircle size={14} color="#ef4444" />
            <span style={{ fontSize: 13, color: '#ef4444', flex: 1 }}>
              {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}
              {overdueTasks[0] && <span style={{ color: '#f87171', marginLeft: 8, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160, display: 'inline-block', verticalAlign: 'bottom' }}>— "{overdueTasks[0].title}"</span>}
            </span>
            <Link href="/tasks" style={{ fontSize: 12, color: '#ef4444', textDecoration: 'underline', flexShrink: 0 }}>
              View &amp; resolve →
            </Link>
          </div>
        )}

        {/* ── Stat cards with sparklines ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
          {STATS.map(({ label, count, icon: Icon, href, color, spark }) => (
            <Link key={label} href={href} style={{ textDecoration: 'none' }}>
              <div style={{
                backgroundColor: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '16px 18px', cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
                display: 'flex', flexDirection: 'column', gap: 12,
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color + '55'; e.currentTarget.style.backgroundColor = 'var(--accent)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.backgroundColor = 'var(--card)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={color} />
                  </div>
                  <Sparkline data={spark} color={color} />
                </div>
                <div>
                  <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--foreground)', margin: 0, lineHeight: 1 }}>
                    {loading ? '—' : count}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '4px 0 0' }}>{label}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* ── Task progress — donut left, "Focus next" right ── */}
        {!loading && tasks.length > 0 && (
          <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
            {/* Header */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--secondary)', display: 'flex', alignItems: 'center' }}>
              <TrendingUp size={14} color="var(--primary)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginLeft: 8 }}>Task progress</span>
              <Link href="/tasks" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted-foreground)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
              >
                {tasks.length} total <ArrowRight size={10} />
              </Link>
            </div>

            {/* Body: 2-column on desktop */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr' }}>

              {/* Left — donut + legend */}
              <div style={{
                padding: '20px 28px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRight: isMobile ? 'none' : '1px solid var(--border)',
                borderBottom: isMobile ? '1px solid var(--border)' : 'none',
              }}>
                <TaskDonut
                  todo={tasks.filter(t => t.status === 'todo').length}
                  inProgress={inProgress.length}
                  done={doneTasks.length}
                  overdue={overdueTasks.length}
                />
              </div>

              {/* Right — focus next: tasks sorted by urgency */}
              <div style={{ padding: '14px 18px' }}>
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
                    Focus next
                  </p>
                  <p style={{ fontSize: 10, color: 'var(--muted-foreground)', opacity: 0.55, margin: '3px 0 0' }}>
                    Overdue first · then due date · then priority
                  </p>
                </div>
                {focusTasks.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0' }}>
                    <CheckCircle2 size={14} color="#10b981" />
                    <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>No open tasks — all caught up!</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {focusTasks.map(task => {
                      const overdue = task.due_date && new Date(task.due_date) < new Date()
                      return (
                        <Link key={task.id} href="/tasks"
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '7px 8px', borderRadius: 7, textDecoration: 'none', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <span style={{ flexShrink: 0, marginTop: 1 }}>{STATUS_ICON[task.status]}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {task.title}
                            </p>
                            <p style={{ fontSize: 10, color: overdue ? '#ef4444' : 'var(--muted-foreground)', margin: '2px 0 0' }}>
                              {overdue ? `⚠ Overdue · due ${formatDate(task.due_date!)}` : task.due_date ? `Due ${formatDate(task.due_date)}` : 'No deadline set'}
                            </p>
                          </div>
                          <span style={{ fontSize: 10, fontWeight: 700, color: PRIORITY_COLOR[task.priority] ?? 'var(--muted-foreground)', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 1 }}>
                            {task.priority}
                          </span>
                        </Link>
                      )
                    })}
                    {openTasks.length > 4 && (
                      <Link href="/tasks" style={{ fontSize: 11, color: 'var(--primary)', textDecoration: 'none', opacity: 0.75, padding: '4px 8px' }}>
                        +{openTasks.length - 4} more tasks →
                      </Link>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* ── AI Digest ── shown only when AI is configured */}
        {aiConfigured && (
          <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: digest || digestLoading ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={13} color="var(--primary)" />
                </div>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>AI Digest</span>
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)', marginLeft: 7, opacity: 0.6 }}>AI-powered summary</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: 6 }}>
                {/* Period toggle */}
                <div style={{ display: 'flex', borderRadius: 7, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  {(['day', 'week'] as const).map(p => (
                    <button key={p} type="button" onClick={() => setDigestPeriod(p)} style={{
                      padding: '4px 10px', fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer',
                      backgroundColor: digestPeriod === p ? 'var(--primary)' : 'transparent',
                      color: digestPeriod === p ? 'white' : 'var(--muted-foreground)',
                      transition: 'all 0.12s',
                    }}>
                      {p === 'day' ? 'Today' : 'This week'}
                    </button>
                  ))}
                </div>
                {/* Generate / Refresh */}
                <button type="button" onClick={() => generateDigest(digestPeriod)} disabled={digestLoading} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', borderRadius: 7,
                  border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                  backgroundColor: 'color-mix(in srgb, var(--primary) 8%, transparent)',
                  color: 'var(--primary)', fontSize: 12, fontWeight: 600,
                  cursor: digestLoading ? 'wait' : 'pointer', opacity: digestLoading ? 0.6 : 1,
                }}>
                  {digestLoading
                    ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
                    : digest
                    ? <><RefreshCw size={11} /> Regenerate</>
                    : <><Sparkles size={11} /> Generate digest</>
                  }
                </button>
              </div>
            </div>

            {digestError && (
              <div style={{ padding: '10px 16px', fontSize: 12, color: '#f87171' }}>
                {digestError}
              </div>
            )}

            {digest && !digestLoading && (
              <div style={{ padding: '16px 20px 20px', fontSize: 13, color: 'var(--foreground)' }}>
                <DigestContent text={digest} />
              </div>
            )}

            {digestEmpty && !digestLoading && (
              <div style={{ padding: '20px 16px', fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', lineHeight: 1.6 }}>
                Nothing captured yet today — add a note, task, or bookmark to get your briefing.
              </div>
            )}

            {!digest && !digestEmpty && !digestLoading && !digestError && (
              <div style={{ padding: '16px', fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center' }}>
                Click "Generate" for your AI Digest — notes, tasks, and bookmarks in one summary.
              </div>
            )}
          </div>
        )}

        {/* ── 3-column: Recent Notes / Open Tasks / Recent Bookmarks ── */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 14, marginBottom: 24 }}>

          {/* Recent Notes */}
          <Panel
            title="Recent Notes"
            icon={<FileText size={13} color="var(--primary)" />}
            href="/notes"
            action="New note"
            actionHref="/notes/new"
          >
            {loading ? <PanelLoading /> : notes.length === 0
              ? <PanelEmpty icon="📑" text="No notes yet" />
              : notes.slice(0, 6).map(note => (
                <Link key={note.id} href={`/notes/${note.id}`} style={rowStyle}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: NOTE_TYPE_COLOR[note.type] ?? 'var(--primary)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={rowTitleStyle} title={note.title || 'Untitled'}>{note.title || 'Untitled'}</p>
                    <p style={rowSubStyle}>{NOTE_TYPE_LABEL[note.type] ?? note.type}</p>
                  </div>
                  <span style={rowTimeStyle}>{formatRelative(note.updated_at)}</span>
                </Link>
              ))}
          </Panel>

          {/* Open Tasks */}
          <Panel
            title="Open Tasks"
            subtitle="All open · sorted by creation date"
            icon={<CheckSquare size={13} color="var(--primary)" />}
            href="/tasks"
            action="New task"
            actionHref="/tasks"
          >
            {loading ? <PanelLoading /> : openTasks.length === 0
              ? <PanelEmpty icon="🎉" text="All caught up!" />
              : openTasks.slice(0, 6).map(task => {
                const overdue = task.due_date && new Date(task.due_date) < new Date()
                return (
                  <div key={task.id} style={{ ...rowStyle, cursor: 'default' }}>
                    <span style={{ flexShrink: 0 }}>{STATUS_ICON[task.status]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={rowTitleStyle} title={task.title}>{task.title}</p>
                      {task.due_date && (
                        <p style={{ ...rowSubStyle, color: overdue ? '#ef4444' : 'var(--muted-foreground)' }}>
                          {overdue ? '⚠ ' : ''}Due {formatDate(task.due_date)}
                        </p>
                      )}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: PRIORITY_COLOR[task.priority], flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {task.priority}
                    </span>
                  </div>
                )
              })}
          </Panel>

          {/* Recent Bookmarks */}
          <Panel
            title="Recent Bookmarks"
            icon={<Bookmark size={13} color="#f59e0b" />}
            href="/bookmarks"
            action="All bookmarks"
            actionHref="/bookmarks"
          >
            {loading ? <PanelLoading /> : bookmarks.length === 0
              ? <PanelEmpty icon="🔖" text="No bookmarks yet" />
              : bookmarks.slice(0, 6).map(bm => (
                <a key={bm.id} href={bm.url} target="_blank" rel="noopener noreferrer" style={rowStyle}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  {bm.favicon_url
                    ? <img src={bm.favicon_url} alt="" style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                    : <div style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: '#f59e0b22', flexShrink: 0 }} />
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={rowTitleStyle} title={bm.title || bm.url}>{bm.title || bm.url}</p>
                    <p style={rowSubStyle}>{bm.hostname ?? (() => { try { return new URL(bm.url).hostname } catch { return bm.url } })()}</p>
                  </div>
                  <span style={rowTimeStyle}>{formatRelative(bm.created_at)}</span>
                </a>
              ))}
          </Panel>

        </div>

        {/* ── Knowledge health ── */}
        {!loading && (notes.length > 0 || bookmarks.length > 0) && (
          <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>

            {/* Header */}
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={14} color="var(--muted-foreground)" />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Knowledge health</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', opacity: 0.6 }}>Last 14 days</span>
            </div>

            {/* Activity area chart — full width */}
            <div style={{ padding: '16px 18px 0' }}>
              <ActivityChart data={activity14} />
            </div>

            {/* Stats strip — each cell explains both what the number is and what it counts */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              borderBottom: '1px solid var(--secondary)',
              margin: '10px 0 0',
            }}>
              {([
                {
                  icon: <TrendingUp size={11} color="var(--primary)" />,
                  value: activityThisWeek,
                  label: 'captured this week',
                  sub: 'notes + bookmarks',
                  valueColor: 'var(--primary)',
                  tip: 'Notes updated and bookmarks saved in the last 7 days',
                },
                {
                  icon: null,
                  value: `${activityThisWeek >= activityLastWeek ? '↑' : '↓'} ${activityLastWeek}`,
                  label: 'last week',
                  sub: activityThisWeek >= activityLastWeek ? 'trending up ✓' : 'quieter week',
                  valueColor: 'var(--foreground)',
                  tip: 'Items captured the previous 7 days — for comparison',
                },
                {
                  icon: <Tag size={11} color="var(--muted-foreground)" />,
                  value: uniqueTopics,
                  label: 'unique topics',
                  sub: 'distinct tags used',
                  valueColor: 'var(--foreground)',
                  tip: 'How many unique tags exist across all your notes',
                },
                {
                  icon: <CheckCircle2 size={11} color={pctOrganized >= 70 ? '#10b981' : '#f59e0b'} />,
                  value: `${pctOrganized}%`,
                  label: 'notes organized',
                  sub: `${notes.length - untaggedNotes} of ${notes.length} tagged`,
                  valueColor: pctOrganized >= 70 ? '#10b981' : pctOrganized >= 40 ? 'var(--foreground)' : '#f59e0b',
                  tip: `${notes.length - untaggedNotes} notes have at least one tag — ${100 - pctOrganized}% still need tagging`,
                },
              ] as { icon: React.ReactNode; value: string | number; label: string; sub: string; valueColor: string; tip: string }[]).map(({ icon, value, label, sub, valueColor, tip }, i) => {
                const tipKey = `stat-${i}`
                const open = activeTip === tipKey
                return (
                  <div
                    key={i}
                    onClick={() => setActiveTip(open ? null : tipKey)}
                    onMouseEnter={() => !isMobile && setActiveTip(tipKey)}
                    onMouseLeave={() => !isMobile && setActiveTip(null)}
                    style={{
                      padding: '10px 4px',
                      textAlign: 'center',
                      borderRight: i < 3 ? '1px solid var(--secondary)' : 'none',
                      cursor: 'pointer',
                      position: 'relative',
                    }}
                  >
                    {icon && (
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4, opacity: 0.7 }}>
                        {icon}
                      </div>
                    )}
                    <p style={{ fontSize: 17, fontWeight: 800, color: valueColor, margin: 0, lineHeight: 1 }}>{value}</p>
                    <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '3px 0 0', letterSpacing: '0.04em' }}>{label}</p>
                    <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '2px 0 0', opacity: 0.7 }}>{sub}</p>
                    {open && (
                      <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 6px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '6px 10px',
                        fontSize: 11,
                        color: 'var(--popover-foreground)',
                        whiteSpace: 'normal',
                        maxWidth: 'min(200px, calc(100vw - 32px))',
                        width: 'max-content',
                        zIndex: 50,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        pointerEvents: 'none',
                      }}>
                        {tip}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Unindexed items notice — shown only when some items lack embeddings */}
            {unindexedCount !== null && unindexedCount > 0 && (
              <div style={{ padding: '6px 18px', borderBottom: '1px solid var(--secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={11} color="#f59e0b" style={{ flexShrink: 0, opacity: 0.8 }} />
                <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>{unindexedCount} items</span> not yet searchable via AI
                </span>
                <span style={{ fontSize: 10, color: 'var(--muted-foreground)', marginLeft: 'auto', opacity: 0.55 }}>
                  Open AI Settings → Build search index
                </span>
              </div>
            )}

            {/* Capture streak badge — emoji and message vary with streak length */}
            {activityStreak >= 2 && (() => {
              const emoji   = activityStreak >= 21 ? '👑' : activityStreak >= 14 ? '🏆' : activityStreak >= 7 ? '🔥' : activityStreak >= 4 ? '⚡' : '✨'
              const message = activityStreak >= 21 ? 'legendary streak — unstoppable!' : activityStreak >= 14 ? 'two-week streak — incredible!' : activityStreak >= 7 ? 'one-week streak — on fire!' : activityStreak >= 4 ? 'building momentum!' : 'keep it going!'
              return (
                <div
                  onClick={() => setActiveTip(activeTip === 'streak' ? null : 'streak')}
                  onMouseEnter={() => !isMobile && setActiveTip('streak')}
                  onMouseLeave={() => !isMobile && setActiveTip(null)}
                  style={{ padding: '8px 18px', borderBottom: '1px solid var(--secondary)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', position: 'relative' }}
                >
                  <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>{emoji} {activityStreak}-day capture streak</span>
                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>— {message}</span>
                  {activeTip === 'streak' && (
                    <div style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 6px)',
                      left: 18,
                      background: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      padding: '6px 10px',
                      fontSize: 11,
                      color: 'var(--popover-foreground)',
                      whiteSpace: 'normal',
                      maxWidth: 'min(280px, calc(100vw - 36px))',
                      width: 'max-content',
                      zIndex: 50,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      pointerEvents: 'none',
                    }}>
                      You&apos;ve added or updated at least one note or bookmark every day for {activityStreak} consecutive days
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Unorganized items — shown only when there's something to do */}
            {(queueNotes.length > 0 || queueBmarks.length > 0 || staleNotes > 0 || staleBookmarks > 0 || emptyNotes > 0) ? (
              <div style={{ padding: '12px 18px' }}>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Needs a tag
                    </span>
                    {(untaggedNotes + untaggedBmarks) > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                        {untaggedNotes + untaggedBmarks} items waiting
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--muted-foreground)', opacity: 0.55, margin: '3px 0 0' }}>
                    Notes → opens editor to add tags · Bookmarks → opens bookmarks manager
                  </p>
                  {aiConfigured && queueNotes.length > 0 && (
                    <button type="button" onClick={generateTagSuggestions} disabled={suggestingTags}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '4px 10px', borderRadius: 6,
                        border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                        backgroundColor: 'color-mix(in srgb, var(--primary) 8%, transparent)',
                        color: 'var(--primary)', fontSize: 11, fontWeight: 600,
                        cursor: suggestingTags ? 'wait' : 'pointer', opacity: suggestingTags ? 0.6 : 1,
                        marginTop: 6,
                      }}>
                      {suggestingTags ? <><Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> Getting suggestions…</> : <><Sparkles size={10} /> AI suggest tags</>}
                    </button>
                  )}
                  {tagSuggestError && !suggestingTags && (
                    <p style={{ fontSize: 11, color: '#f87171', margin: '4px 0 0' }}>{tagSuggestError}</p>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {queueNotes.map(n => (
                    <div key={n.id}>
                      <Link href={`/notes/${n.id}`}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '7px 8px', borderRadius: 7, textDecoration: 'none', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <FileText size={13} color="var(--muted-foreground)" style={{ flexShrink: 0, marginTop: 1, opacity: 0.55 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 500, color: n.title ? 'var(--foreground)' : 'var(--muted-foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: n.title ? 'normal' : 'italic' }}>
                            {n.title || 'Untitled note'}
                          </p>
                          <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
                            {NOTE_TYPE_LABEL[n.type] ?? n.type} · captured {formatRelative(n.created_at)} · no tags yet
                          </p>
                        </div>
                        <span style={{ fontSize: 10, color: 'var(--primary)', flexShrink: 0, opacity: 0.7, whiteSpace: 'nowrap', marginTop: 1 }}>Add tags →</span>
                      </Link>
                      {tagSuggestions[n.id] && !dismissedSugs.has(n.id) && (() => {
                        const sel = selectedTags[n.id] ?? new Set(tagSuggestions[n.id])
                        return (
                          <div style={{ padding: '2px 8px 8px 30px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                              <Sparkles size={9} color="var(--primary)" style={{ flexShrink: 0, opacity: 0.7 }} />
                              {tagSuggestions[n.id].map(tag => {
                                const on = sel.has(tag)
                                return (
                                  <button key={tag} type="button" onClick={() => toggleTagSelection(n.id, tag)}
                                    style={{
                                      fontSize: 10, padding: '2px 9px', borderRadius: 99, cursor: 'pointer',
                                      backgroundColor: on ? 'var(--primary)' : 'transparent',
                                      color: on ? 'white' : 'var(--muted-foreground)',
                                      fontWeight: on ? 600 : 400,
                                      border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                                      opacity: on ? 1 : 0.45,
                                      transition: 'all 0.12s',
                                    }}>
                                    {tag}
                                  </button>
                                )
                              })}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button type="button" onClick={() => applyTagSuggestion(n.id)}
                                disabled={sel.size === 0}
                                style={{
                                  fontSize: 10, fontWeight: 600, color: 'var(--primary)', cursor: sel.size === 0 ? 'default' : 'pointer',
                                  padding: '3px 9px', borderRadius: 5, background: 'none',
                                  border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
                                  opacity: sel.size === 0 ? 0.35 : 1,
                                }}>
                                Apply {sel.size > 0 ? `(${sel.size})` : ''}
                              </button>
                              <button type="button" onClick={() => applyTagSuggestion(n.id, true)}
                                style={{ fontSize: 10, color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', opacity: 0.65 }}>
                                Accept all
                              </button>
                              <button type="button" onClick={() => dismissTagSuggestion(n.id)}
                                style={{ fontSize: 10, color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', opacity: 0.45 }}>
                                ✕ Dismiss
                              </button>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  ))}
                  {queueBmarks.map(b => {
                    const bmSel = selectedTags[b.id] ?? new Set(tagSuggestions[b.id] ?? [])
                    return (
                      <div key={b.id}>
                        <Link href="/bookmarks"
                          style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '7px 8px', borderRadius: 7, textDecoration: 'none', transition: 'background 0.1s' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <Bookmark size={13} color="var(--muted-foreground)" style={{ flexShrink: 0, marginTop: 1, opacity: 0.55 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {b.title || b.hostname || 'Bookmark'}
                            </p>
                            <p style={{ fontSize: 10, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>
                              {b.hostname} · saved {formatRelative(b.created_at)} · needs tags
                            </p>
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--primary)', flexShrink: 0, opacity: 0.7, whiteSpace: 'nowrap', marginTop: 1 }}>Add tags →</span>
                        </Link>
                        {tagSuggestions[b.id] && !dismissedSugs.has(b.id) && (
                          <div style={{ padding: '2px 8px 8px 30px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', marginBottom: 6 }}>
                              <Sparkles size={9} color="#f59e0b" style={{ flexShrink: 0, opacity: 0.7 }} />
                              {tagSuggestions[b.id].map(tag => {
                                const on = bmSel.has(tag)
                                return (
                                  <button key={tag} type="button" onClick={() => toggleTagSelection(b.id, tag)}
                                    style={{
                                      fontSize: 10, padding: '2px 9px', borderRadius: 99, cursor: 'pointer',
                                      backgroundColor: on ? 'var(--primary)' : 'transparent',
                                      color: on ? 'white' : 'var(--muted-foreground)',
                                      fontWeight: on ? 600 : 400,
                                      border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                                      opacity: on ? 1 : 0.45, transition: 'all 0.12s',
                                    }}>
                                    {tag}
                                  </button>
                                )
                              })}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <button type="button" onClick={() => applyTagSuggestion(b.id)}
                                disabled={bmSel.size === 0}
                                style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary)', cursor: bmSel.size === 0 ? 'default' : 'pointer', padding: '3px 9px', borderRadius: 5, background: 'none', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', opacity: bmSel.size === 0 ? 0.35 : 1 }}>
                                Apply {bmSel.size > 0 ? `(${bmSel.size})` : ''}
                              </button>
                              <button type="button" onClick={() => applyTagSuggestion(b.id, true)}
                                style={{ fontSize: 10, color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', opacity: 0.65 }}>
                                Accept all
                              </button>
                              <button type="button" onClick={() => dismissTagSuggestion(b.id)}
                                style={{ fontSize: 10, color: 'var(--muted-foreground)', background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', opacity: 0.45 }}>
                                ✕ Dismiss
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                {(untaggedNotes > queueNotes.length || untaggedBmarks > queueBmarks.length) && (
                  <div style={{ display: 'flex', gap: 12, marginTop: 6, paddingLeft: 8 }}>
                    {untaggedNotes > queueNotes.length && (
                      <Link href="/notes" style={{ fontSize: 11, color: 'var(--primary)', textDecoration: 'none', opacity: 0.75 }}>
                        +{untaggedNotes - queueNotes.length} more notes →
                      </Link>
                    )}
                    {untaggedBmarks > queueBmarks.length && (
                      <Link href="/bookmarks" style={{ fontSize: 11, color: 'var(--muted-foreground)', textDecoration: 'none', opacity: 0.7 }}>
                        +{untaggedBmarks - queueBmarks.length} bookmarks →
                      </Link>
                    )}
                  </div>
                )}
                {(staleNotes > 0 || staleBookmarks > 0 || emptyNotes > 0) && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 8px 4px' }}>
                      Worth a cleanup
                    </span>
                    {staleNotes > 0 && (
                      <Link href="/notes"
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, textDecoration: 'none', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <AlertCircle size={12} color="#f59e0b" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', flex: 1 }}>
                          <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{staleNotes}</span> notes untouched 30+ days
                        </span>
                        <ArrowRight size={10} color="var(--muted-foreground)" style={{ flexShrink: 0, opacity: 0.4 }} />
                      </Link>
                    )}
                    {staleBookmarks > 0 && (
                      <Link href="/bookmarks"
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, textDecoration: 'none', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <AlertCircle size={12} color="#f59e0b" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', flex: 1 }}>
                          <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{staleBookmarks}</span> bookmarks saved 90+ days ago — still relevant?
                        </span>
                        <ArrowRight size={10} color="var(--muted-foreground)" style={{ flexShrink: 0, opacity: 0.4 }} />
                      </Link>
                    )}
                    {emptyNotes > 0 && (
                      <Link href="/notes"
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 7, textDecoration: 'none', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <AlertCircle size={12} color="var(--muted-foreground)" style={{ flexShrink: 0, opacity: 0.55 }} />
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)', flex: 1 }}>
                          <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{emptyNotes}</span> empty notes — fill them in or delete
                        </span>
                        <ArrowRight size={10} color="var(--muted-foreground)" style={{ flexShrink: 0, opacity: 0.4 }} />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <CheckCircle2 size={15} color="#10b981" />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>Knowledge base fully organized</p>
                  <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '2px 0 0' }}>Every note and bookmark is tagged — great discipline!</p>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ── Knowledge connections ── */}
        {!loading && connections && (
          <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
            <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={14} color="var(--primary)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>Connections to explore</span>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginLeft: 'auto', opacity: 0.6 }}>based on your recent notes</span>
            </div>
            <div style={{ padding: '12px 18px' }}>
              <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: '0 0 10px' }}>
                Your note <strong style={{ color: 'var(--foreground)' }}>&ldquo;{connections.source.title}&rdquo;</strong> shares topics with:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {connections.connections.map(c => (
                  c.external
                    ? <a key={c.id} href={c.href} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 7, textDecoration: 'none', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <Bookmark size={12} color="var(--muted-foreground)" style={{ flexShrink: 0, opacity: 0.55 }} />
                        <span style={{ fontSize: 12, color: 'var(--foreground)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                        <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0, opacity: 0.45 }}>bookmark ↗</span>
                      </a>
                    : <Link key={c.id} href={c.href}
                        style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 7, textDecoration: 'none', transition: 'background 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <FileText size={12} color="var(--primary)" style={{ flexShrink: 0, opacity: 0.7 }} />
                        <span style={{ fontSize: 12, color: 'var(--foreground)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                        <span style={{ fontSize: 10, color: 'var(--primary)', flexShrink: 0, opacity: 0.6 }}>note →</span>
                      </Link>
                ))}
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted-foreground)', margin: '10px 0 0', opacity: 0.6 }}>
                Shared keywords: {connections.keywords.map(k => <code key={k} style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, backgroundColor: 'var(--secondary)', marginRight: 4 }}>{k}</code>)}
              </p>
            </div>
          </div>
        )}

        {/* ── Quick actions ── */}
        <div>
          <p style={{ fontSize: 10, color: 'var(--muted-foreground)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Zap size={11} color="var(--muted-foreground)" /> Quick actions
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { href: '/notes/new', icon: <FileText    size={13} />, label: 'New note',     color: 'var(--primary)' },
              { href: '/people',    icon: <Users        size={13} />, label: 'Add person',   color: '#10b981' },
              { href: '/tasks',     icon: <CheckSquare  size={13} />, label: 'New task',     color: 'var(--primary)' },
              { href: '/bookmarks', icon: <Bookmark     size={13} />, label: 'Save bookmark',color: '#f59e0b' },
              { href: '/graph',     icon: <Activity     size={13} />, label: 'View graph',   color: '#22d3ee' },
            ].map(({ href, icon, label, color }) => (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '7px 14px', borderRadius: 8, textDecoration: 'none',
                backgroundColor: 'var(--card)', border: '1px solid var(--border)',
                fontSize: 12, color: 'var(--secondary-foreground)', transition: 'all 0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color + '55'; e.currentTarget.style.color = color; e.currentTarget.style.backgroundColor = color + '0d' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--secondary-foreground)'; e.currentTarget.style.backgroundColor = 'var(--card)' }}
              >
                {icon} {label}
              </Link>
            ))}
          </div>
        </div>

      </PageContainer>
    </AppLayout>
  )
}

// ── Shared panel shell ───────────────────────────────────────
function Panel({ title, subtitle, icon, href, action, actionHref, children }: {
  title: string; subtitle?: string; icon: React.ReactNode; href: string; action: string; actionHref: string; children: React.ReactNode
}) {
  return (
    <div style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--secondary)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {icon}
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{title}</span>
            {subtitle && <p style={{ fontSize: 10, color: 'var(--muted-foreground)', opacity: 0.55, margin: '2px 0 0' }}>{subtitle}</p>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href={actionHref} style={{ fontSize: 11, color: 'var(--muted-foreground)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
          >
            <Plus size={11} />
          </Link>
          <Link href={href} style={{ fontSize: 11, color: 'var(--muted-foreground)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
          >
            All <ArrowRight size={10} />
          </Link>
        </div>
      </div>
      <div style={{ padding: '6px', flex: 1 }}>
        {children}
      </div>
    </div>
  )
}

function PanelLoading() {
  return (
    <div style={{ padding: '12px 10px' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: 'var(--secondary)' }} />
          <div style={{ height: 11, borderRadius: 4, backgroundColor: 'var(--secondary)', flex: 1, opacity: 1 - i * 0.2 }} />
        </div>
      ))}
    </div>
  )
}

function PanelEmpty({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ padding: '24px 10px', textAlign: 'center' }}>
      <p style={{ fontSize: 20, margin: '0 0 4px' }}>{icon}</p>
      <p style={{ fontSize: 12, color: 'var(--muted-foreground)', margin: 0 }}>{text}</p>
    </div>
  )
}

// ── Shared row styles ────────────────────────────────────────
const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9,
  padding: '8px 8px', borderRadius: 7, textDecoration: 'none',
  transition: 'background 0.12s', backgroundColor: 'transparent',
}
const rowTitleStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: 'var(--foreground)', margin: 0,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}
const rowSubStyle: React.CSSProperties = {
  fontSize: 10, color: 'var(--muted-foreground)', margin: '1px 0 0',
}
const rowTimeStyle: React.CSSProperties = {
  fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0, marginLeft: 4,
}

// ── Smooth responsive area chart — theme-aware via CSS vars ──
function ActivityChart({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const W = 280, H = 54

  const coords = data.map((v, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - (v / max) * (H - 10) - 5,
  }))

  let linePath = `M ${coords[0].x},${coords[0].y}`
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1], curr = coords[i]
    const cpX = (prev.x + curr.x) / 2
    linePath += ` C ${cpX},${prev.y} ${cpX},${curr.y} ${curr.x},${curr.y}`
  }
  const first = coords[0], last = coords[coords.length - 1]
  const areaPath = `${linePath} L ${last.x},${H} L ${first.x},${H} Z`

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height: H }}
      >
        <defs>
          <linearGradient id="act-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--primary)', stopOpacity: 0.28 } as React.CSSProperties} />
            <stop offset="100%" style={{ stopColor: 'var(--primary)', stopOpacity: 0.02 } as React.CSSProperties} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#act-grad)" />
        <path d={linePath} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
        <circle cx={last.x} cy={last.y} r="3.5" fill="var(--primary)" />
        <circle cx={last.x} cy={last.y} r="6.5" fill="var(--primary)" opacity="0.15" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 9, color: 'var(--muted-foreground)', opacity: 0.5 }}>14 days ago</span>
        <span style={{ fontSize: 9, color: 'var(--primary)', opacity: 0.75, fontWeight: 600 }}>Today</span>
      </div>
    </div>
  )
}

// ── Task Donut ───────────────────────────────────────────────
function TaskDonut({ todo, inProgress, done, overdue }: {
  todo: number; inProgress: number; done: number; overdue: number
}) {
  const total = todo + inProgress + done
  if (total === 0) return null

  const R = 34, STROKE = 10, SIZE = 88, C = SIZE / 2
  const circ = 2 * Math.PI * R

  // Segments drawn clockwise from 12 o'clock: done → in-progress → todo
  const segments = [
    { label: 'Done',        value: done,       color: '#10b981' },
    { label: 'In progress', value: inProgress, color: 'var(--primary)' },
    { label: 'To do',       value: todo,       color: 'var(--border)' },
  ]

  let cumPct = 0
  const arcs = segments.map(seg => {
    const pct      = seg.value / total
    const dashLen  = circ * pct
    // strokeDashoffset = circ * 0.25 shifts start from 3 o'clock to 12 o'clock;
    // subtract cumulative arc so each segment follows the previous one.
    const dashOff  = circ * (0.25 - cumPct)
    cumPct += pct
    return { ...seg, dashLen, dashOff }
  })

  const pctDone = Math.round((done / total) * 100)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 28, flexWrap: 'wrap', justifyContent: 'center' }}>
      {/* SVG donut */}
      <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
        <svg width={SIZE} height={SIZE}>
          {/* Track ring */}
          <circle cx={C} cy={C} r={R} fill="none" stroke="var(--secondary)" strokeWidth={STROKE} />
          {arcs.map(arc => arc.value > 0 && (
            <circle
              key={arc.label}
              cx={C} cy={C} r={R}
              fill="none"
              stroke={arc.color}
              strokeWidth={STROKE}
              strokeLinecap="butt"
              strokeDasharray={`${arc.dashLen} ${circ - arc.dashLen}`}
              strokeDashoffset={arc.dashOff}
            />
          ))}
        </svg>
        {/* Center label */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--foreground)', lineHeight: 1 }}>{pctDone}%</span>
          <span style={{ fontSize: 9, color: 'var(--muted-foreground)', marginTop: 2, letterSpacing: '0.04em' }}>done</span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {segments.map(seg => (
          <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)', minWidth: 82 }}>{seg.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--foreground)', minWidth: 20, textAlign: 'right' }}>{seg.value}</span>
          </div>
        ))}
        {overdue > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <AlertCircle size={11} color="#ef4444" />
            <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 500 }}>{overdue} overdue</span>
          </div>
        )}
      </div>
    </div>
  )
}

