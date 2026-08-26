'use client'
import { useState, useCallback, useRef } from 'react'
import { AIConfig, AIStreamChunk, AssistOperation } from '@/lib/ai/types'

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

  const stream = useCallback(async (
    endpoint: string,
    body:     Record<string, unknown>,
    options?: { onChunk?: (delta: string) => void; onDone?: (full: string) => void }
  ) => {
    // Cancel any in-flight request before starting a new one
    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setText('')
    setError(null)
    setStreaming(true)
    let full = ''

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

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buf     = ''

      while (true) {
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
            if (chunk.done) { options?.onDone?.(full); break }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== 'Unexpected end') throw parseErr
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setStreaming(false)
    }

    return full
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setStreaming(false)
  }, [])

  return { text, streaming, error, stream, cancel, setText }
}

/** Wrap `useAIStream` with AI Assist specifics — wires the correct endpoint and body shape. */
export function useAIAssist(config: AIConfig) {
  const { text, streaming, error, stream, cancel } = useAIStream()

  const assist = useCallback(async (
    operation: AssistOperation,
    selectedText: string,
    noteContext?: string,
    onDone?: (result: string) => void,
  ) => {
    await stream('/api/ai/assist', {
      config,
      operation,
      text:        selectedText,
      noteContext,
      stream:      true,
    }, { onDone })
  }, [config, stream])

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
