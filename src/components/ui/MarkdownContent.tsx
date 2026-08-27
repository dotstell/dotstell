'use client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  children: string
  className?: string
  /** When true, suppresses paragraph margins — useful inside chat bubbles */
  compact?: boolean
}

export function MarkdownContent({ children, className = '', compact = false }: Props) {
  return (
    <ReactMarkdown
      className={`md-content${compact ? ' md-content--compact' : ''}${className ? ` ${className}` : ''}`}
      remarkPlugins={[remarkGfm]}
    >
      {children}
    </ReactMarkdown>
  )
}
