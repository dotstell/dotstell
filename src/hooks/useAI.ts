'use client'
import { useState, useCallback, useRef } from 'react'
import { AIConfig, AIStreamChunk, AssistOperation } from '@/lib/ai/types'
import { streamOllamaBrowser, completeOllamaBrowser } from '@/lib/ai/ollama-browser'
import { buildAssistMessages, buildSummarizeMessages, buildTitleMessages, buildTagMessages } from '@/lib/ai/prompts'

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
        const err = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(err.error ?? 'Request failed')
      }
      if (!res.body) throw new Error('No response body')

      const full = await processSseStream(res.body, abortRef.current.signal, options)
      return full
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Unknown error')
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
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setStreaming(false)
    }
  }, [processSseStream])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

  return { text, streaming, error, stream, streamDirect, cancel, setText }
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
    if (config.provider === 'ollama') {
      // Call Ollama directly from the browser — avoids the Vercel server-side
      // limitation where the server cannot reach the user's localhost:11434
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
      // When Ollama + raw text: call directly from browser
      // When entity ID is given: must go through server (DB access needed)
      if (config.provider === 'ollama' && params.text) {
        const content = params.text.slice(0, 12_000)
        const result  = await completeOllamaBrowser(
          config,
          buildSummarizeMessages(content, params.title, params.mode ?? 'bullets'),
        )
        setSummary(result)
        return result
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
      if (config.provider === 'ollama') {
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
      if (config.provider === 'ollama') {
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
