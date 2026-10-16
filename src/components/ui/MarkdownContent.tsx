'use client'
import { marked } from 'marked'
import { useMemo } from 'react'
import { sanitizeHtml } from '@/lib/sanitize-html'

interface Props {
  children: string
  className?: string
  /** Reduces paragraph/list spacing inside chat bubbles */
  compact?: boolean
}

// Small models (llama3.2 etc.) often output • ▸ · instead of markdown - syntax.
// Normalize these to proper markdown list markers before parsing so marked renders <li> elements.
// Also inject a blank line before any list block — marked requires it when list follows prose.
function normalizeMarkdown(text: string): string {
  const lines = text.split('\n').map(line => {
    const m = line.match(/^(\s*)[•·▸▪‣⁃➤→✦]\s+(.*)/)
    return m ? `${m[1]}- ${m[2]}` : line
  })
  const result: string[] = []
  for (const line of lines) {
    const isList = /^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line)
    const prevBlank = result.length === 0 || result[result.length - 1].trim() === ''
    if (isList && !prevBlank) result.push('')
    result.push(line)
  }
  return result.join('\n')
}

// marked is already installed (v18) — use it instead of react-markdown
// to avoid ESM-only module issues during Next.js compilation.
// Content here is AI-generated markdown, not user-supplied HTML.
export function MarkdownContent({ children, className = '', compact = false }: Props) {
  const html = useMemo(() => {
    const raw = marked(normalizeMarkdown(children), { gfm: true, breaks: false }) as string
    // marked passes raw HTML through, and the text can come from an AI echoing a note or bookmark,
    // so the result is rebuilt from an allow-list before it is put on the page.
    return sanitizeHtml(raw, 'markdown')
  }, [children])

  return (
    <div
      className={`md-content${compact ? ' md-content--compact' : ''}${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
