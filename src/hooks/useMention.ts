import { useState, useEffect, useRef } from 'react'
import { useDebounce } from './useDebounce'

export interface MentionSuggestion {
  id: string
  name: string
  role?: string
}

export function useMention(content: string, onInsert: (updated: string) => void) {
  const [suggestions, setSuggestions]   = useState<MentionSuggestion[]>([])
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [atIndex, setAtIndex]           = useState<number>(-1)
  const [selectedIdx, setSelectedIdx]   = useState(0)
  const debouncedQ = useDebounce(mentionQuery ?? '', 200)

  // Detect @ trigger in content
  useEffect(() => {
    const lastAt = content.lastIndexOf('@')
    if (lastAt === -1) { setMentionQuery(null); return }
    const after = content.slice(lastAt + 1)
    // Only trigger if no space after @
    if (/\s/.test(after) || after.length > 30) { setMentionQuery(null); return }
    setMentionQuery(after)
    setAtIndex(lastAt)
    setSelectedIdx(0)
  }, [content])

  // Fetch suggestions
  useEffect(() => {
    if (mentionQuery === null) { setSuggestions([]); return }
    fetch(`/api/people?q=${encodeURIComponent(debouncedQ)}`)
      .then(r => r.json())
      .then(d => setSuggestions(Array.isArray(d) ? d.slice(0, 6) : []))
      .catch(() => setSuggestions([]))
  }, [debouncedQ, mentionQuery])

  function pickSuggestion(person: MentionSuggestion) {
    const before = content.slice(0, atIndex)
    const after  = content.slice(atIndex + 1 + (mentionQuery?.length ?? 0))
    onInsert(`${before}@[${person.name}](person:${person.id})${after}`)
    setSuggestions([])
    setMentionQuery(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!suggestions.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && suggestions.length) { e.preventDefault(); pickSuggestion(suggestions[selectedIdx]) }
    if (e.key === 'Escape') { setSuggestions([]); setMentionQuery(null) }
  }

  return { suggestions, selectedIdx, pickSuggestion, handleKeyDown, active: suggestions.length > 0 }
}
