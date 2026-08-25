'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Bot, User, Loader2, ChevronDown, Trash2, Globe, FileText } from 'lucide-react'
import { AIConfig, AIMessage } from '@/lib/ai/types'
import { useAIStream } from '@/hooks/useAI'

interface AIChatPanelProps {
  config:    AIConfig
  noteId?:   string    // if set, the panel is scoped to a specific note
  noteTitle?: string
  onClose:   () => void
}

interface ChatMessage {
  role:    'user' | 'assistant'
  content: string
}

type ChatMode = 'note' | 'global'

export function AIChatPanel({ config, noteId, noteTitle, onClose }: AIChatPanelProps) {
  const [messages,  setMessages]  = useState<ChatMessage[]>([])
  const [input,     setInput]     = useState('')
  const [mode,      setMode]      = useState<ChatMode>(noteId ? 'note' : 'global')
  const [ragActive, setRagActive] = useState(true)
  const { text: streamText, streaming, error, stream, cancel, setText } = useAIStream()
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

  async function send() {
    const text = input.trim()
    if (!text || streaming) return
    setInput('')

    const userMsg: ChatMessage = { role: 'user', content: text }
    const placeholder: ChatMessage = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, userMsg, placeholder])
    pendingRole.current = true

    // Build context via RAG when enabled
    let context: string | undefined
    if (ragActive) {
      try {
        const ragRes = await fetch('/api/ai/semantic-search', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            config,
            query:      text,
            types:      ['note'],
            // If in note mode, bias results toward the current note's neighbourhood
            noteId:     mode === 'note' ? noteId : undefined,
            limit:      3,
            threshold:  0.5,
          }),
        })
        if (ragRes.ok) {
          const results: Array<{ title: string; content: string }> = await ragRes.json()
          if (results.length) {
            context = results.map(r => `## ${r.title}\n${r.content.replace(/<[^>]+>/g, ' ').trim().slice(0, 800)}`).join('\n\n')
          }
        }
      } catch { /* RAG is best-effort — proceed without it */ }
    }

    // History for the model (exclude the placeholder we just added)
    const history: AIMessage[] = messages.concat(userMsg).map(m => ({ role: m.role, content: m.content }))

    const finalText = await stream('/api/ai/chat', { config, messages: history, context })
    pendingRole.current = false

    // Replace the streaming placeholder with the finished message
    if (finalText !== undefined) {
      setMessages(prev => {
        const copy = [...prev]
        const last = copy[copy.length - 1]
        if (last?.role === 'assistant') copy[copy.length - 1] = { ...last, content: finalText }
        return copy
      })
    }
    setText('')
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
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
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bot size={14} color="var(--primary)" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>AI Chat</p>
            {mode === 'note' && noteTitle && (
              <p style={{ margin: 0, fontSize: 10, color: 'var(--muted-foreground)' }}>{noteTitle}</p>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {messages.length > 0 && (
            <button type="button" title="Clear history" onClick={clearHistory} style={iconBtn}>
              <Trash2 size={13} />
            </button>
          )}
          <button type="button" onClick={onClose} style={iconBtn}><X size={13} /></button>
        </div>
      </div>

      {/* Mode switcher (only shown when noteId is available) */}
      {noteId && (
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

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {isEmpty && <WelcomeMessage mode={mode} noteTitle={noteTitle} />}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'assistant' && (
              <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <Bot size={12} color="var(--primary)" />
              </div>
            )}
            <div style={{
              maxWidth:        '80%',
              padding:         '8px 11px',
              borderRadius:    msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
              backgroundColor: msg.role === 'user' ? 'var(--primary)' : 'var(--muted)',
              color:           msg.role === 'user' ? 'white' : 'var(--foreground)',
              fontSize:        13, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.content || (streaming && i === messages.length - 1 ? (
                <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              ) : null)}
            </div>
            {msg.role === 'user' && (
              <div style={{ width: 24, height: 24, borderRadius: 6, backgroundColor: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <User size={12} color="var(--muted-foreground)" />
              </div>
            )}
          </div>
        ))}

        {error && (
          <div style={{ padding: '8px 12px', borderRadius: 8, backgroundColor: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontSize: 12 }}>
            {error}
          </div>
        )}
        <div ref={bottomRef} style={{ height: 12 }} />
      </div>

      {/* RAG toggle */}
      <div style={{ padding: '6px 12px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button
          type="button"
          onClick={() => setRagActive(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 20, border: '1px solid var(--border)', backgroundColor: ragActive ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent', color: ragActive ? 'var(--primary)' : 'var(--muted-foreground)', fontSize: 10, cursor: 'pointer', fontWeight: 500, transition: 'all 0.15s' }}
        >
          <Globe size={9} /> {ragActive ? 'RAG on' : 'RAG off'}
        </button>
        <p style={{ margin: 0, fontSize: 10, color: 'var(--muted-foreground)' }}>
          {ragActive ? 'Answers grounded in your notes' : 'Direct model answers only'}
        </p>
      </div>

      {/* Input */}
      <div style={{ padding: '8px 12px 12px', borderTop: '1px solid var(--border)', display: 'flex', gap: 6, flexShrink: 0 }}>
        <textarea
          ref={inputRef}
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
      </div>
    </div>
  )
}

function WelcomeMessage({ mode, noteTitle }: { mode: ChatMode; noteTitle?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '32px 16px', gap: 8, color: 'var(--muted-foreground)', textAlign: 'center' }}>
      <Bot size={28} color="var(--primary)" style={{ opacity: 0.7 }} />
      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
        {mode === 'note' && noteTitle ? `Chat about "${noteTitle}"` : 'Chat with your knowledge base'}
      </p>
      <p style={{ margin: 0, fontSize: 12, maxWidth: 260, lineHeight: 1.5 }}>
        {mode === 'note'
          ? 'Ask questions, explore ideas, or get summaries about this note. Your other relevant notes are used as context.'
          : 'Ask anything about your notes, bookmarks, or ideas. RAG finds relevant context automatically.'}
      </p>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--muted-foreground)', padding: 5, borderRadius: 6, display: 'flex',
}
