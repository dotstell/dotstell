'use client'
import { marked } from 'marked'
import { useMemo } from 'react'

interface Props {
  children: string
  className?: string
  /** Reduces paragraph/list spacing inside chat bubbles */
  compact?: boolean
}

// marked is already installed (v18) — use it instead of react-markdown
// to avoid ESM-only module issues during Next.js compilation.
// Content here is AI-generated markdown, not user-supplied HTML.
export function MarkdownContent({ children, className = '', compact = false }: Props) {
  const html = useMemo(() => {
    return marked(children, { gfm: true, breaks: false }) as string
  }, [children])

  return (
    <div
      className={`md-content${compact ? ' md-content--compact' : ''}${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
