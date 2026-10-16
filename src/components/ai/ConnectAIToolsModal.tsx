'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Plug, Copy, Check, Loader2, AlertCircle, KeyRound, Activity, Trash2, ShieldCheck } from 'lucide-react'

interface TokenRow {
  id: string
  name: string
  prefix: string
  expires_at: string
  revoked_at: string | null
  last_used_at: string | null
  use_count: number
  created_at: string
}

interface EventRow { tool: string; at: string }

type SetupTab = 'claude-code' | 'cursor' | 'claude-desktop'

const EXPIRY_CHOICES = [
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days (recommended)' },
  { days: 180, label: '180 days' },
  { days: 365, label: '1 year' },
]

const TOOL_LABELS: Record<string, string> = {
  search_notes: 'Searched notes', get_note: 'Read a note', recent_notes: 'Listed recent notes', list_meetings: 'Listed meetings',
  list_tasks: 'Listed tasks', list_people: 'Listed people', get_person: 'Read a person',
}

function ago(iso: string | null): string {
  if (!iso) return 'never'
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)} h ago`
  return `${Math.floor(seconds / 86_400)} days ago`
}

const dateOnly = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

function status(token: TokenRow): 'active' | 'revoked' | 'expired' {
  if (token.revoked_at) return 'revoked'
  return new Date(token.expires_at).getTime() <= Date.now() ? 'expired' : 'active'
}

function setupText(tab: SetupTab, url: string, token: string): string {
  if (tab === 'claude-code') {
    return `claude mcp add --transport http dotstell ${url} --header "Authorization: Bearer ${token}"`
  }
  if (tab === 'cursor') {
    return JSON.stringify({ mcpServers: { dotstell: { url, headers: { Authorization: `Bearer ${token}` } } } }, null, 2)
  }
  return JSON.stringify({
    mcpServers: { dotstell: { command: 'npx', args: ['-y', 'mcp-remote', url, '--header', 'Authorization:${DOTSTELL_AUTH}'], env: { DOTSTELL_AUTH: `Bearer ${token}` } } },
  }, null, 2)
}

const SETUP_HELP: Record<SetupTab, string> = {
  'claude-code': 'Run this once in a terminal.',
  cursor: 'Add this to .cursor/mcp.json (or Settings, MCP).',
  'claude-desktop': 'Add this to claude_desktop_config.json. Needs Node.js; mcp-remote connects Claude Desktop to remote servers.',
}

interface LoadResult { tokens: TokenRow[]; notSetUp: boolean; error: string | null }

async function loadTokens(): Promise<LoadResult> {
  try {
    const res = await fetch('/api/mcp-tokens')
    const data = await res.json().catch(() => ({}))
    if (res.status === 503 && data.notSetUp) return { tokens: [], notSetUp: true, error: null }
    if (!res.ok) throw new Error(data.error ?? 'Could not load your tokens.')
    return { tokens: data, notSetUp: false, error: null }
  } catch (err) {
    return { tokens: [], notSetUp: false, error: err instanceof Error ? err.message : 'Could not load your tokens.' }
  }
}

interface ConnectAIToolsModalProps {
  onClose: () => void
}

/** Create, copy once, list, revoke and review the activity of the tokens that let AI tools read notes (docs/MCP.md). */
export function ConnectAIToolsModal({ onClose }: ConnectAIToolsModalProps) {
  const [tokens, setTokens] = useState<TokenRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notSetUp, setNotSetUp] = useState(false)
  const [name, setName] = useState('')
  const [days, setDays] = useState(90)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [fresh, setFresh] = useState<{ token: string; name: string } | null>(null)
  const [tab, setTab] = useState<SetupTab>('claude-code')
  const [copied, setCopied] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [openActivity, setOpenActivity] = useState<string | null>(null)
  const [events, setEvents] = useState<Record<string, EventRow[] | 'loading' | 'error'>>({})
  const dialogRef = useRef<HTMLDivElement>(null)

  const url = typeof window === 'undefined' ? '' : `${window.location.origin}/api/mcp`

  const apply = useCallback((result: LoadResult) => {
    setNotSetUp(result.notSetUp)
    setLoadError(result.error)
    setTokens(result.tokens)
  }, [])

  const load = useCallback(async () => apply(await loadTokens()), [apply])

  useEffect(() => {
    let live = true
    loadTokens().then(result => { if (live) apply(result) })
    return () => { live = false }
  }, [apply])

  useEffect(() => {
    dialogRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function create() {
    setCreating(true); setCreateError(null)
    try {
      const res = await fetch('/api/mcp-tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), days }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not create the token.')
      setFresh({ token: data.token, name: data.name })
      setName('')
      await load()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create the token.')
    } finally {
      setCreating(false)
    }
  }

  async function revoke(id: string) {
    setConfirming(null)
    const res = await fetch(`/api/mcp-tokens/${id}`, { method: 'DELETE' })
    if (!res.ok) { setLoadError('Could not revoke that token. Try again.'); return }
    if (fresh && tokens?.find(t => t.id === id)?.prefix === fresh.token.slice(0, 8)) setFresh(null)
    await load()
  }

  async function toggleActivity(id: string) {
    if (openActivity === id) { setOpenActivity(null); return }
    setOpenActivity(id)
    setEvents(prev => ({ ...prev, [id]: 'loading' }))
    try {
      const res = await fetch(`/api/mcp-tokens/${id}/events`)
      if (!res.ok) throw new Error()
      const rows: EventRow[] = await res.json()
      setEvents(prev => ({ ...prev, [id]: rows }))
    } catch {
      setEvents(prev => ({ ...prev, [id]: 'error' }))
    }
  }

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(c => (c === key ? null : c)), 1800)
    } catch { /* clipboard blocked: the text stays selectable on screen */ }
  }

  const card: React.CSSProperties = { padding: 12, borderRadius: 10, border: '1px solid var(--border)', backgroundColor: 'var(--muted)' }
  const small: React.CSSProperties = { fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.5 }
  const input: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--background)', color: 'var(--foreground)', fontSize: 13, boxSizing: 'border-box' }
  const code: React.CSSProperties = { margin: 0, padding: 10, borderRadius: 8, backgroundColor: 'var(--background)', border: '1px solid var(--border)', fontSize: 11, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: 'var(--foreground)', whiteSpace: 'pre-wrap', wordBreak: 'break-all', userSelect: 'all' }
  const ghost: React.CSSProperties = { padding: '5px 9px', borderRadius: 7, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--foreground)', fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-ai-title"
        tabIndex={-1}
        style={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 22px 18px', width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', outline: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'color-mix(in srgb, var(--primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plug size={16} color="var(--primary)" />
            </div>
            <div>
              <p id="connect-ai-title" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}>Connect AI tools</p>
              <p style={{ margin: 0, ...small }}>Let Claude, Cursor and other AI tools read your notes</p>
            </div>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 4 }}><X size={15} /></button>
        </div>

        <div style={{ ...card, display: 'flex', gap: 10, marginBottom: 14 }}>
          <ShieldCheck size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, ...small }}>
            Tokens are <strong>read-only</strong>: a connected tool can search and read your notes, tasks, people and meetings, but cannot change or delete anything.
            Each token expires, and you can revoke it at any time. Only a fingerprint of the token is kept, so it is shown once. Treat it like a password.
            Note text is shared with the tool you connect, and with the AI service behind it.
          </p>
        </div>

        {notSetUp && (
          <div role="alert" style={{ ...card, display: 'flex', gap: 8, marginBottom: 14, borderColor: 'var(--destructive, #ef4444)' }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} color="var(--destructive, #ef4444)" />
            <p style={{ margin: 0, ...small }}>This server has not been set up for MCP yet. The database needs <code>supabase/migrations/012_mcp.sql</code> (see docs/MCP.md).</p>
          </div>
        )}

        {!notSetUp && (
          <section aria-label="New token" style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>New token</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input
                aria-label="Token name"
                placeholder="Name, for example Claude Code on my laptop"
                maxLength={60}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && name.trim() && !creating) create() }}
                style={{ ...input, flex: '1 1 220px', width: 'auto' }}
              />
              <select aria-label="Expires after" value={days} onChange={e => setDays(Number(e.target.value))} style={{ ...input, width: 'auto', flex: '0 0 auto' }}>
                {EXPIRY_CHOICES.map(c => <option key={c.days} value={c.days}>{c.label}</option>)}
              </select>
              <button
                type="button"
                onClick={create}
                disabled={!name.trim() || creating}
                style={{ padding: '8px 14px', borderRadius: 8, border: 'none', backgroundColor: 'var(--primary)', color: 'white', fontSize: 13, fontWeight: 700, cursor: !name.trim() || creating ? 'default' : 'pointer', opacity: !name.trim() || creating ? 0.55 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {creating ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <KeyRound size={13} />} Create token
              </button>
            </div>
            {createError && <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--destructive, #ef4444)' }}>{createError}</p>}
          </section>
        )}

        {fresh && (
          <section aria-label="Your new token" style={{ ...card, marginBottom: 16, borderColor: 'color-mix(in srgb, var(--primary) 45%, transparent)' }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>Your token for &ldquo;{fresh.name}&rdquo;</p>
            <p style={{ margin: '0 0 8px', ...small }}>Copy it now. For your security it cannot be shown again; if you lose it, revoke it and make a new one.</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', marginBottom: 12 }}>
              <pre aria-label="Token" style={{ ...code, flex: 1 }}>{fresh.token}</pre>
              <button type="button" onClick={() => copy('token', fresh.token)} style={ghost}>{copied === 'token' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}</button>
            </div>

            <div role="tablist" aria-label="Tool to connect" style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
              {([['claude-code', 'Claude Code'], ['cursor', 'Cursor'], ['claude-desktop', 'Claude Desktop']] as const).map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
                  style={{ ...ghost, backgroundColor: tab === key ? 'color-mix(in srgb, var(--primary) 18%, transparent)' : 'transparent', borderColor: tab === key ? 'var(--primary)' : 'var(--border)', fontWeight: tab === key ? 700 : 500 }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
              <p style={{ margin: 0, ...small }}>{SETUP_HELP[tab]}</p>
              <button type="button" onClick={() => copy('setup', setupText(tab, url, fresh.token))} style={{ ...ghost, flexShrink: 0 }}>{copied === 'setup' ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}</button>
            </div>
            <pre aria-label={`Setup for ${tab}`} style={code}>{setupText(tab, url, fresh.token)}</pre>
          </section>
        )}

        <section aria-label="Your tokens">
          <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}>Your tokens</p>
          {loadError && <p role="alert" style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--destructive, #ef4444)' }}>{loadError}</p>}
          {tokens === null && <p style={small}><Loader2 size={12} style={{ animation: 'spin 1s linear infinite', verticalAlign: 'middle' }} /> Loading…</p>}
          {tokens?.length === 0 && !notSetUp && !loadError && <p style={small}>No tokens yet. Nothing is shared until you create one.</p>}
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tokens?.map(t => {
              const s = status(t)
              const rows = events[t.id]
              return (
                <li key={t.id} style={{ ...card, opacity: s === 'active' ? 1 : 0.7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--foreground)', overflowWrap: 'anywhere' }}>
                        {t.name} <span style={{ ...small, fontFamily: 'ui-monospace, monospace' }}>{t.prefix}…</span>
                      </p>
                      <p style={{ margin: '2px 0 0', ...small }}>
                        {s === 'active' ? `Expires ${dateOnly(t.expires_at)}` : s === 'expired' ? `Expired ${dateOnly(t.expires_at)}` : `Revoked ${ago(t.revoked_at)}`}
                        {' · '}last used {ago(t.last_used_at)}{' · '}{t.use_count} {Number(t.use_count) === 1 ? 'request' : 'requests'}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button type="button" onClick={() => toggleActivity(t.id)} aria-expanded={openActivity === t.id} style={ghost}><Activity size={12} /> Activity</button>
                      {confirming === t.id ? (
                        <>
                          <button type="button" onClick={() => revoke(t.id)} style={{ ...ghost, borderColor: 'var(--destructive, #ef4444)', color: 'var(--destructive, #ef4444)' }}>{t.revoked_at ? 'Yes, remove' : 'Yes, revoke'}</button>
                          <button type="button" onClick={() => setConfirming(null)} style={ghost}>Keep</button>
                        </>
                      ) : (
                        <button type="button" onClick={() => setConfirming(t.id)} style={ghost}><Trash2 size={12} /> {t.revoked_at ? 'Remove' : 'Revoke'}</button>
                      )}
                    </div>
                  </div>
                  {openActivity === t.id && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                      {rows === 'loading' && <p style={small}>Loading…</p>}
                      {rows === 'error' && <p style={small}>Could not load the activity.</p>}
                      {Array.isArray(rows) && rows.length === 0 && <p style={small}>Not used yet. What was read is never recorded, only which tool ran and when.</p>}
                      {Array.isArray(rows) && rows.length > 0 && (
                        <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 140, overflowY: 'auto' }}>
                          {rows.map((e, i) => <li key={i} style={{ ...small, display: 'flex', justifyContent: 'space-between' }}><span>{TOOL_LABELS[e.tool] ?? e.tool}</span><span>{ago(e.at)}</span></li>)}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
