'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Sparkles, User, Loader2, Trash2, Globe, FileText, Users, Copy, Check } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { AIConfig, AIMessage } from '@/lib/ai/types'
import { useAIStream } from '@/hooks/useAI'
import { streamOllamaBrowser, isLocalHostname } from '@/lib/ai/ollama-browser'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'
import { AIPersonPanel } from './AIPersonPanel'
import { MarkdownContent } from '@/components/ui/MarkdownContent'

interface AIChatPanelProps {
  config:       AIConfig
  noteId?:      string    // if set, the panel is scoped to a specific note
  noteTitle?:   string
  noteContent?: string    // raw note content (HTML); stripped and injected in "This note" mode
  onClose:      () => void
}

interface ChatMessage {
  role:    'user' | 'assistant'
  content: string
}

type ChatMode = 'note' | 'global'
type PanelTab = 'chat' | 'people'

export function AIChatPanel({ config, noteId, noteTitle, noteContent, onClose }: AIChatPanelProps) {
  const router = useRouter()
  const [activeTab,  setActiveTab]  = useState<PanelTab>('chat')
  const [messages,   setMessages]   = useState<ChatMessage[]>([])
  const [input,      setInput]      = useState('')
  const [mode,       setMode]       = useState<ChatMode>(noteId ? 'note' : 'global')
  const [ragActive,  setRagActive]  = useState(true)
  const [copiedIdx,  setCopiedIdx]  = useState<number | null>(null)
  const { text: streamText, streaming, error, clearError, stream, streamDirect, cancel, setText } = useAIStream()
  const bottomRef   = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLTextAreaElement>(null)
  const pendingRole = useRef(false)   // true while assistant message slot is being filled

  // Scroll to bottom on new tokens
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [streamText, messages.length])

  // Auto-focus input when panel opens
  useEffect(() => { inputRef.current?.focus() }, [])

  // Sync the in-flight streaming text into the last assistant message slot
  useEffect(() => {
    if (!pendingRole.current) return
    setMessages(prev => {
      const copy = [...prev]
      const last = copy[copy.length - 1]
      if (last?.role === 'assistant') copy[copy.length - 1] = { ...last, content: streamText }
      return copy
    })
  }, [streamText])

  const sendingRef = useRef(false)  // guards the RAG fetch gap before streaming starts

  async function send() {
    const text = input.trim()
    if (!text || streaming || sendingRef.current) return
    sendingRef.current = true
    setInput('')

    const userMsg: ChatMessage = { role: 'user', content: text }
    const placeholder: ChatMessage = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, userMsg, placeholder])
    pendingRole.current = true

    // Build context — current note first (always in "This note" mode), then RAG results
    let context: string | undefined

    // In "This note" mode, always inject the open note's content directly so the model
    // has it regardless of whether semantic search also surfaces it.
    if (mode === 'note' && noteContent && noteTitle) {
      const plain = noteContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4000)
      context = `## ${noteTitle}\n${plain}`
    }

    if (ragActive) {
      try {
        const ragRes = await fetch('/api/ai/semantic-search', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            config,
            query:  text,
            types:  ['note', 'bookmark', 'task'],
            limit:  5,
          }),
        })
        if (ragRes.ok) {
          const results: Array<{ id: string; title: string; type: string; body: string }> = await ragRes.json()
          // Filter out the current note (already injected above) so it isn't duplicated
          const others = results.filter(r => !(r.type === 'note' && r.id === noteId))
          if (others.length) {
            const ragContext = others.map(r => {
              const prefix = r.type === 'task' ? '### Task' : r.type === 'bookmark' ? '### Bookmark' : '##'
              return `${prefix}: ${r.title}\n${r.body ?? ''}`
            }).join('\n\n')
            context = context ? `${context}\n\n${ragContext}` : ragContext
          }
        }
      } catch { /* RAG is best-effort — proceed without it */ }
    }

    // "All knowledge" mode: tasks may be missing from RAG context if their embeddings
    // haven't been built yet — supplement with a direct DB fetch.
    if (mode === 'global') {
      try {
        const supabase = createSupabaseBrowserClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error()  // caught below; skip the fallback quietly

        if (!context) {
          // RAG returned nothing — full fallback: recent notes + tasks
          const [{ data: recentNotes }, { data: recentTasks }] = await Promise.all([
            supabase.from('notes').select('title, content, updated_at')
              .eq('user_id', user.id).is('deleted_at', null)
              .order('updated_at', { ascending: false }).limit(3),
            supabase.from('tasks').select('title, description, status, priority, due_date, updated_at')
              .eq('user_id', user.id).order('updated_at', { ascending: false }).limit(5),
          ])
          const parts: string[] = []
          if (recentNotes?.length) {
            parts.push(...recentNotes.map(n =>
              `## Note: ${n.title || 'Untitled'}\n${n.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600)}`
            ))
          }
          if (recentTasks?.length) {
            parts.push(...recentTasks.map(t => {
              const meta = [`Status: ${t.status}`, `Priority: ${t.priority}`]
              if (t.due_date) meta.push(`Due: ${t.due_date.split('T')[0]}`)
              return `### Task: ${t.title}${t.description ? `\n${t.description.slice(0, 300)}` : ''}\n${meta.join(' · ')}`
            }))
          }
          if (parts.length) context = parts.join('\n\n')
        } else if (!context.includes('### Task')) {
          // RAG returned notes/bookmarks but no tasks — supplement so the model always sees them.
          const { data: recentTasks } = await supabase
            .from('tasks').select('title, description, status, priority, due_date, updated_at')
            .eq('user_id', user.id).order('updated_at', { ascending: false }).limit(5)
          if (recentTasks?.length) {
            const taskContext = recentTasks.map(t => {
              const meta = [`Status: ${t.status}`, `Priority: ${t.priority}`]
              if (t.due_date) meta.push(`Due: ${t.due_date.split('T')[0]}`)
              return `### Task: ${t.title}${t.description ? `\n${t.description.slice(0, 300)}` : ''}\n${meta.join(' · ')}`
            }).join('\n\n')
            context = `${context}\n\n${taskContext}`
          }
        }
      } catch { /* fallback is best-effort */ }
    }

    // History for the model (exclude the placeholder we just added)
    const history: AIMessage[] = messages.concat(userMsg).map(m => ({ role: m.role, content: m.content }))

    try {
      let finalText: string | undefined

      if (config.provider === 'ollama' && !isLocalHostname()) {
        // On the live app Vercel can't reach local Ollama — stream directly through the Local Agent.
        // Inject context as a system message the same way the server route does.
        const ollamaMessages: AIMessage[] = context
          // Wrap context in XML tags to prevent user content from overriding instructions.
          ? [{ role: 'system', content: `You are a helpful personal assistant with access to the user's knowledge base.\n\nFormatting rules:\n- Use markdown: **bold** for labels, numbered or bullet lists for multiple items\n- For tasks: show title in bold, then Status, Priority, Due Date as sub-bullets\n- Write field values in title case (e.g. "In Progress" not "in_progress", "High" not "high")\n- Be concise and structured\n\nCite specific notes, bookmarks, or tasks by name when relevant.\n\n<context>\n${context}\n</context>` }, ...history]
          : history
        finalText = await streamDirect(() => streamOllamaBrowser(config, ollamaMessages))
      } else {
        finalText = await stream('/api/ai/chat', { config, messages: history, context })
      }

      if (finalText !== undefined) {
        setMessages(prev => {
          const copy = [...prev]
          const last = copy[copy.length - 1]
          if (last?.role === 'assistant') copy[copy.length - 1] = { ...last, content: finalText! }
          return copy
        })
      }
      setText('')
    } finally {
      pendingRole.current = false
      sendingRef.current  = false
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  async function copyMessage(content: string, idx: number) {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 2000)
    } catch { /* clipboard unavailable */ }
  }

  function injectPrompt(text: string) {
    setInput(text)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const clearHistory = useCallback(() => {
    setMessages([])
    cancel()
    setText('')
  }, [cancel, setText])

  const isEmpty = messages.length === 0

  return (
    <div style={{
      position:        'fixed', right: 0, top: 0, bottom: 0, zIndex: 200,
      width:           380, display: 'flex', flexDirection: 'column',
      backgroundColor: 'var(--card)', borderLeft: '1px solid var(--border)',
      boxShadow:       '-8px 0 32px rgba(0,0,0,0.3)',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 16px 0', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={14} color="var(--primary)" />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
                {activeTab === 'people' ? 'Person Intelligence' : 'AI Chat'}
              </p>
              {activeTab === 'chat' && mode === 'note' && noteTitle && (
                <p style={{ margin: 0, fontSize: 10, color: 'var(--muted-foreground)' }}>{noteTitle}</p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {activeTab === 'chat' && messages.length > 0 && (
              <button type="button" title="Clear history" onClick={clearHistory} style={iconBtn}>
                <Trash2 size={13} />
              </button>
            )}
            <button type="button" onClick={onClose} style={iconBtn}><X size={13} /></button>
          </div>
        </div>

        {/* Tab bar — Chat / People */}
        <div style={{ display: 'flex', gap: 0 }}>
          {([['chat', 'Chat', Sparkles], ['people', 'People', Users]] as const).map(([tab, label, Icon]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600,
                border: 'none', background: 'none', cursor: 'pointer',
                color: activeTab === tab ? 'var(--primary)' : 'var(--muted-foreground)',
                borderBottom: `2px solid ${activeTab === tab ? 'var(--primary)' : 'transparent'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                transition: 'all 0.15s',
              }}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Person intelligence tab */}
      {activeTab === 'people' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          <AIPersonPanel config={config} onOpenNote={id => router.push(`/notes/${id}`)} />
        </div>
      )}

      {/* Mode switcher (only shown when noteId is available, chat tab only) */}
      {activeTab === 'chat' && noteId && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 4, flexShrink: 0 }}>
          {([['note', 'This note', FileText], ['global', 'All knowledge', Globe]] as const).map(([m, label, Icon]) => (
            <button key={m} type="button" onClick={() => setMode(m)} style={{
              flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border)',
              backgroundColor: mode === m ? 'var(--primary)' : 'transparent',
              color:           mode === m ? 'white' : 'var(--muted-foreground)',
              fontSize: 11, cursor: 'pointer', fontWeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>
      )}

      {/* Messages — chat tab only */}
      {activeTab === 'chat' && <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isEmpty && <WelcomeMessage mode={mode} noteTitle={noteTitle} onPrompt={injectPrompt} />}

        {messages.map((msg, i) => {
          const isStreaming = streaming && i === messages.length - 1 && msg.role === 'assistant'
          return (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {msg.role === 'assistant' && (
                <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <Sparkles size={12} color="var(--primary)" />
                </div>
              )}
              <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 4, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  padding:         '8px 11px',
                  borderRadius:    msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  backgroundColor: msg.role === 'user' ? 'var(--primary)' : 'var(--muted)',
                  color:           msg.role === 'user' ? 'white' : 'var(--foreground)',
                  fontSize:        13, lineHeight: 1.5, wordBreak: 'break-word',
                }}>
                  {msg.role === 'assistant' && msg.content
                    ? <><MarkdownContent compact>{msg.content}</MarkdownContent>{isStreaming && <span className="streaming-cursor">▌</span>}</>
                    : msg.content || (isStreaming
                        ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                        : null)
                  }
                </div>
                {/* Copy button — shown below completed assistant messages only */}
                {msg.role === 'assistant' && msg.content && !isStreaming && (
                  <button
                    type="button"
                    title="Copy response"
                    onClick={() => copyMessage(msg.content, i)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: copiedIdx === i ? 'var(--primary)' : 'var(--muted-foreground)',
                      fontSize: 10, padding: '1px 4px', borderRadius: 4,
                      transition: 'color 0.15s', opacity: 0.6,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0.6' }}
                  >
                    {copiedIdx === i ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
                  </button>
                )}
              </div>
              {msg.role === 'user' && (
                <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                  <User size={12} color="var(--muted-foreground)" />
                </div>
              )}
            </div>
          )
        })}

        {error && (
          <div style={{ padding: '10px 12px', borderRadius: 8, backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <span style={{ color: '#f87171' }}>{error}</span>
                <button
                  type="button"
                  onClick={() => { clearError(); setTimeout(() => { const ta = document.querySelector<HTMLTextAreaElement>('[data-chat-input]'); ta?.focus() }, 50) }}
                  style={{ display: 'block', marginTop: 6, fontSize: 11, color: 'var(--primary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} style={{ height: 12 }} />
      </div>}

      {/* RAG toggle — chat tab only */}
      {activeTab === 'chat' && <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setRagActive(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, border: '1px solid var(--border)', backgroundColor: ragActive ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent', color: ragActive ? 'var(--primary)' : 'var(--muted-foreground)', fontSize: 10, cursor: 'pointer', fontWeight: 500, transition: 'all 0.15s' }}
        >
          <Globe size={9} /> {ragActive ? 'RAG on' : 'RAG off'}
        </button>
        <p style={{ margin: 0, fontSize: 10, color: 'var(--muted-foreground)' }}>
          {ragActive ? 'Answers grounded in your notes, tasks & bookmarks' : 'Direct model answers only'}
        </p>
      </div>}

      {/* Input — chat tab only */}
      {activeTab === 'chat' && <div style={{ padding: '8px 12px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexShrink: 0 }}>
        <textarea
          ref={inputRef}
          data-chat-input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
          rows={2}
          style={{
            flex: 1, resize: 'none', padding: '8px 10px', borderRadius: 8,
            border: '1px solid var(--border)', backgroundColor: 'var(--muted)',
            color: 'var(--foreground)', fontSize: 12, outline: 'none', lineHeight: 1.4,
            fontFamily: 'inherit',
          }}
        />
        <button
          type="button"
          onClick={streaming ? cancel : send}
          style={{
            width: 34, height: 34, borderRadius: 8, border: 'none', alignSelf: 'flex-end',
            backgroundColor: streaming ? 'rgba(248,113,113,0.15)' : 'var(--primary)',
            color: streaming ? '#f87171' : 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {streaming ? <X size={13} /> : <Send size={13} />}
        </button>
      </div>}
    </div>
  )
}

const NOTE_PROMPTS   = ['Summarize this note', 'What are the key tasks?', 'Explain the main concepts']
const GLOBAL_PROMPTS = ['What have I been working on?', 'What are my high-priority tasks?', "What's overdue or needs attention?", 'Summarize recent activity', 'Find connections between my notes']

function WelcomeMessage({ mode, noteTitle, onPrompt }: { mode: ChatMode; noteTitle?: string; onPrompt: (p: string) => void }) {
  const prompts = mode === 'note' ? NOTE_PROMPTS : GLOBAL_PROMPTS
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '32px 16px', gap: 12, color: 'var(--muted-foreground)', textAlign: 'center' }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Sparkles size={22} color="var(--primary)" />
      </div>
      <div>
        <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
          {mode === 'note' && noteTitle ? `Chat about "${noteTitle}"` : 'Chat with your knowledge base'}
        </p>
        <p style={{ margin: 0, fontSize: 12, maxWidth: 260, lineHeight: 1.5 }}>
          {mode === 'note'
            ? 'Ask questions, explore ideas, or get summaries about this note.'
            : 'Ask anything about your notes, bookmarks, tasks, or ideas. RAG finds relevant context automatically.'}
        </p>
      </div>
      {/* Suggested prompts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 280 }}>
        {prompts.map(p => (
          <button
            key={p}
            type="button"
            onClick={() => onPrompt(p)}
            style={{
              padding: '7px 12px', borderRadius: 8, textAlign: 'left',
              border: '1px solid var(--border)', background: 'var(--muted)',
              color: 'var(--foreground)', fontSize: 12, cursor: 'pointer',
              transition: 'border-color 0.12s, background 0.12s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--primary) 50%, transparent)'; (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--primary) 6%, var(--muted))' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--muted)' }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--muted-foreground)', padding: 5, borderRadius: 6, display: 'flex',
}
