'use client'
import { useState, useEffect } from 'react'
import { Search, FileText, Users, Bookmark, CheckSquare } from 'lucide-react'
import Link from 'next/link'
import { AppLayout } from '@/components/layout/AppLayout'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/useDebounce'

const TYPE_META: Record<string, { icon: React.ElementType; color: string; href: (id: string) => string }> = {
  note: { icon: FileText, color: 'text-[var(--primary)]', href: () => '/notes' },
  person: { icon: Users, color: 'text-emerald-400', href: (id) => `/people/${id}` },
  bookmark: { icon: Bookmark, color: 'text-amber-400', href: () => '/bookmarks' },
  task: { icon: CheckSquare, color: 'text-red-400', href: () => '/tasks' },
}

interface SearchResult {
  id: string
  _type: string
  _label: string
  [key: string]: unknown
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(r => r.json())
      .then(data => { setResults(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [debouncedQuery])

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl">
        <h1 className="text-xl font-semibold mb-6">Search</h1>
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <Input
            className="pl-9 text-base"
            placeholder="Search notes, people, bookmarks, tasks..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {loading && <p className="text-sm text-[var(--muted-foreground)]">Searching...</p>}

        {!loading && results.length === 0 && debouncedQuery.length >= 2 && (
          <p className="text-sm text-[var(--muted-foreground)]">No results for &quot;{debouncedQuery}&quot;</p>
        )}

        {results.length > 0 && (
          <div className="space-y-1">
            {results.map(result => {
              const meta = TYPE_META[result._type]
              if (!meta) return null
              const Icon = meta.icon
              return (
                <Link
                  key={`${result._type}-${result.id}`}
                  href={meta.href(result.id)}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--accent)] transition-colors"
                >
                  <Icon size={16} className={meta.color} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{result._label}</p>
                    <p className="text-xs text-[var(--muted-foreground)] capitalize">{result._type}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {!query && (
          <p className="text-sm text-[var(--muted-foreground)] text-center mt-10">
            Type to search across all your knowledge
          </p>
        )}
      </div>
    </AppLayout>
  )
}
