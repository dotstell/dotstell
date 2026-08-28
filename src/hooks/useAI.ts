'use client'
import { useState, useCallback, useRef } from 'react'
import { AIConfig, AIStreamChunk, AssistOperation } from '@/lib/ai/types'
import { streamOllamaBrowser, completeOllamaBrowser, isLocalHostname } from '@/lib/ai/ollama-browser'
import { buildAssistMessages, buildSummarizeMessages, buildTitleMessages, buildTagMessages } from '@/lib/ai/prompts'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'

function friendlyAIError(msg: string): string {
  const m = msg.toLowerCase()
  if (m.includes('401') || m.includes('unauthorized') || m.includes('api_key') || m.includes('incorrect api key') || m.includes('invalid api key'))
    return 'Invalid API key — check your key in AI Settings.'
  if (m.includes('403') || m.includes('forbidden'))
    return 'Access denied — your API key may not have permission for this model.'
  if (m.includes('429') || m.includes('rate limit') || m.includes('quota'))
    return 'Rate limit reached — wait a moment and try again.'
  if (m.includes('404') || m.includes('model not found') || m.includes('no such model'))
    return 'Model not found — check the model name in AI Settings.'
  if (m.includes('econnrefused') || m.includes('fetch failed') || m.includes('failed to fetch') || m.includes('local agent'))
    return 'Could not reach the AI provider. If using Ollama, make sure the Local Agent is running: npx @dotstell/agent'
  if (m.includes('timeout') || m.includes('timed out'))
    return 'Request timed out — the model may be overloaded. Try again.'
  if (m.includes('context length') || m.includes('token') || m.includes('too long'))
    return 'Input too long for this model — try a shorter query or switch to a model with a larger context window.'
  return msg || 'Something went wrong. Please try again.'
}

/**
 * Low-level hook for consuming AI streaming responses.
 * Handles the full fetch → SSE parse → state update cycle.
 * Cancels any in-flight request before starting a new one via an AbortController.
 */
export function useAIStream() {
  const [text,      setText]      = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Core SSE processor shared by stream() and streamDirect()
  const processSseStream = useCallback(async (
    readable: ReadableStream<Uint8Array>,
    signal:   AbortSignal,
    options?: { onChunk?: (delta: string) => void; onDone?: (full: string) => void },
  ): Promise<string> => {
    const reader  = readable.getReader()
    const decoder = new TextDecoder()
    let   buf     = ''
    let   full    = ''

    while (true) {
      if (signal.aborted) break
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const chunk: AIStreamChunk = JSON.parse(line.slice(6))
          if (chunk.error) throw new Error(chunk.error)
          if (chunk.delta) {
            full += chunk.delta
            setText(full)
            options?.onChunk?.(chunk.delta)
          }
          if (chunk.done) { options?.onDone?.(full); return full }
        } catch (parseErr) {
          if (parseErr instanceof Error && parseErr.message !== 'Unexpected end') throw parseErr
        }
      }
    }
    return full
  }, [])

  /** Fetch from a server-side SSE endpoint. */
  const stream = useCallback(async (
    endpoint: string,
    body:     Record<string, unknown>,
    options?: { onChunk?: (delta: string) => void; onDone?: (full: string) => void }
  ) => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setText('')
    setError(null)
    setStreaming(true)

    try {
      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  abortRef.current.signal,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `Request failed (${res.status})` }))
        throw new Error(err.error ?? `Request failed (${res.status})`)
      }
      if (!res.body) throw new Error('No response body')

      const full = await processSseStream(res.body, abortRef.current.signal, options)
      return full
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(friendlyAIError(err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setStreaming(false)
    }
  }, [processSseStream])

  /** Process a pre-built ReadableStream (e.g. from Ollama browser calls) through the same SSE parser. */
  const streamDirect = useCallback(async (
    getStream: () => Promise<ReadableStream<Uint8Array>>,
    options?:  { onChunk?: (delta: string) => void; onDone?: (full: string) => void },
  ) => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setText('')
    setError(null)
    setStreaming(true)

    try {
      const readable = await getStream()
      const full = await processSseStream(readable, abortRef.current.signal, options)
      return full
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(friendlyAIError(err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setStreaming(false)
    }
  }, [processSseStream])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

  return { text, streaming, error, clearError: () => setError(null), stream, streamDirect, cancel, setText }
}

/** Wrap `useAIStream` with AI Assist specifics — wires the correct endpoint and body shape. */
export function useAIAssist(config: AIConfig) {
  const { text, streaming, error, stream, streamDirect, cancel } = useAIStream()

  const assist = useCallback(async (
    operation:   AssistOperation,
    selectedText: string,
    noteContext?: string,
    onDone?:      (result: string) => void,
  ) => {
    if (config.provider === 'ollama' && !isLocalHostname()) {
      // On the live app: call Ollama directly from the browser.
      // On localhost: corporate proxies can block browser→Ollama; use the server route instead
      // (Next.js dev server is on the same machine as Ollama and can reach it directly).
      await streamDirect(
        () => streamOllamaBrowser(config, buildAssistMessages(operation, selectedText, noteContext)),
        { onDone },
      )
    } else {
      await stream('/api/ai/assist', {
        config,
        operation,
        text:        selectedText,
        noteContext,
        stream:      true,
      }, { onDone })
    }
  }, [config, stream, streamDirect])

  return { result: text, streaming, error, assist, cancel }
}

/** Fetch a one-shot AI summary for a note, bookmark, or raw text block. */
export function useAISummarize(config: AIConfig) {
  const [summary,    setSummary]    = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const summarize = useCallback(async (params: {
    entityType?: 'note' | 'bookmark' | 'notebook'
    entityId?:   string
    text?:       string
    title?:      string
    mode?:       'short' | 'bullets' | 'detailed'
  }) => {
    setSummary('')
    setLoading(true)
    setError(null)
    try {
      // On live app + Ollama: run entirely in the browser (Vercel server can't reach local Ollama).
      // Fetch entity content browser-side when entityId is given; use params.text if already available.
      if (config.provider === 'ollama' && !isLocalHostname()) {
        let text = params.text ?? ''
        if (!text && params.entityId && params.entityType && params.entityType !== 'notebook') {
          const supabase = createSupabaseBrowserClient()
          if (params.entityType === 'note') {
            const { data } = await supabase.from('notes').select('title, content').eq('id', params.entityId).single()
            if (data) text = `${data.title}\n${data.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}`
          } else if (params.entityType === 'bookmark') {
            const { data } = await supabase.from('bookmarks').select('title, description').eq('id', params.entityId).single()
            if (data) text = `${data.title}\n${data.description ?? ''}`
          }
        }
        if (text) {
          const content = text.slice(0, 12_000)
          const result  = await completeOllamaBrowser(
            config,
            buildSummarizeMessages(content, params.title, params.mode ?? 'bullets'),
          )
          setSummary(result)
          return result
        }
        // Fall through to server route for notebooks or when fetch returned no content
      }

      const res = await fetch('/api/ai/summarize', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ config, ...params }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Summarization failed')
      setSummary(data.summary)
      return data.summary as string
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
    return ''
  }, [config])

  return { summary, loading, error, summarize, setSummary }
}

/**
 * Suggest a concise, specific title for a note from its content.
 * Pass `hint` if the user has started typing — the model will complete/improve it.
 */
export function useAITitleSuggest(config: AIConfig) {
  const [title,   setTitle]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const suggest = useCallback(async (content: string, hint?: string) => {
    setLoading(true)
    setError(null)
    try {
      if (config.provider === 'ollama' && !isLocalHostname()) {
        const plainText = content
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 2000)
        const result = await completeOllamaBrowser(config, buildTitleMessages(plainText, hint))
        const clean  = result.replace(/^["']|["']$/g, '').trim()
        setTitle(clean)
        return clean
      }

      const res  = await fetch('/api/ai/title', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ config, content, hint }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Title generation failed')
      setTitle(data.title)
      return data.title as string
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
    return ''
  }, [config])

  return { title, loading, error, suggest, setTitle }
}

/**
 * Suggest 3–6 relevant tags for a note based on its content.
 * Already-applied tags are passed in so the model never suggests duplicates.
 */
export function useAITagSuggest(config: AIConfig) {
  const [tags,    setTags]    = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const suggest = useCallback(async (content: string, existingTags?: string[], title?: string) => {
    setTags([])
    setLoading(true)
    setError(null)
    try {
      if (config.provider === 'ollama' && !isLocalHostname()) {
        const plainText = content
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 3000)
        const raw     = await completeOllamaBrowser(config, buildTagMessages(plainText, title, existingTags))
        const cleaned = raw.replace(/```[a-z]*\n?/g, '').trim()
        const parsed  = JSON.parse(cleaned)
        if (!Array.isArray(parsed)) throw new Error('Model did not return an array')
        const result = parsed
          .filter((t): t is string => typeof t === 'string')
          .map(t => t.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
          .filter(t => t.length > 0 && t.length < 40)
          .filter(t => !existingTags?.includes(t))
        setTags(result)
        return result
      }

      const res  = await fetch('/api/ai/tags', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ config, content, title, existingTags }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Tag generation failed')
      setTags(data.tags ?? [])
      return data.tags as string[]
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
    return []
  }, [config])

  const dismiss = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag))
  }, [])

  return { tags, loading, error, suggest, dismiss, setTags }
}

/**
 * Aggregate and summarise everything the user has written about a named person.
 * Searches notes + bookmarks by name, then generates a structured intelligence brief.
 * Note: requires server-side DB access — always goes through the API route.
 */
export function useAIPersonIntel(config: AIConfig) {
  const [summary,  setSummary]  = useState('')
  const [sources,  setSources]  = useState<Array<{ id: string; title: string; type: 'note' | 'bookmark'; updatedAt: string }>>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const search = useCallback(async (name: string) => {
    setSummary('')
    setSources([])
    setLoading(true)
    setError(null)
    try {
      // On the live app with Ollama, Vercel cannot reach local Ollama.
      // Fetch notes/bookmarks from Supabase browser client, build context, call Ollama directly.
      if (config.provider === 'ollama' && !isLocalHostname()) {
        const supabase = createSupabaseBrowserClient()
        const pattern  = `%${name}%`
        const [notesRes, bookmarksRes] = await Promise.all([
          supabase.from('notes').select('id, title, content, updated_at')
            .is('deleted_at', null)
            .or(`title.ilike.${pattern},content.ilike.${pattern}`)
            .order('updated_at', { ascending: false }).limit(20),
          supabase.from('bookmarks').select('id, title, description, url, updated_at')
            .or(`title.ilike.${pattern},description.ilike.${pattern}`)
            .order('updated_at', { ascending: false }).limit(10),
        ])
        const notes     = notesRes.data     ?? []
        const bookmarks = bookmarksRes.data ?? []
        if (notes.length === 0 && bookmarks.length === 0) {
          setSummary(`No notes or bookmarks found that mention "${name}".`)
          setSources([])
          return
        }
        const sourcesData = [
          ...notes.map(n => ({
            id: n.id, title: n.title || 'Untitled', type: 'note' as const, updatedAt: n.updated_at,
            snippet: n.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600),
          })),
          ...bookmarks.map(b => ({
            id: b.id, title: b.title || b.url, type: 'bookmark' as const, updatedAt: b.updated_at,
            snippet: (b.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 400),
          })),
        ]
        const context = sourcesData.map(s => `[${s.type.toUpperCase()} — ${s.title}]\n${s.snippet}`).join('\n\n---\n\n')
        const messages = [
          { role: 'system' as const, content: `You are a personal intelligence assistant. The user has notes and bookmarks about "${name}". Produce a structured summary covering: 1. Who they are 2. Key facts, decisions, or interactions 3. Open items or follow-ups if any 4. Overall relationship or status summary. Be concise (150–250 words). Use short paragraphs. Write in second person ("You met…", "They mentioned…"). If the sources are thin, say so honestly.` },
          { role: 'user'   as const, content: `Everything I have about "${name}":\n\n${context}` },
        ]
        const summary = await completeOllamaBrowser(config, messages)
        setSummary(summary)
        setSources(sourcesData.map(({ id, title, type, updatedAt }) => ({ id, title, type, updatedAt })))
        return
      }

      const res  = await fetch('/api/ai/person', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ config, name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Person lookup failed')
      setSummary(data.summary)
      setSources(data.sources ?? [])
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }, [config])

  return { summary, sources, loading, error, search }
}

/** Scan a note for potential cross-links to other notes via the auto-link API. */
export function useAIAutoLink() {
  const [suggestions, setSuggestions] = useState<Array<{ id: string; title: string }>>([])
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const scan = useCallback(async (noteId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/auto-link', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ noteId }),
      })
      if (res.ok) {
        setSuggestions(await res.json())
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? `Auto-link failed (${res.status})`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  return { suggestions, loading, error, scan, setSuggestions }
}
