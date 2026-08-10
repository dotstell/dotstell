'use client'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface Template {
  id: string
  label: string
  icon: string
  description: string
  title: string
  content: string
}

export const NOTE_TEMPLATES: Template[] = [
  {
    id: 'blank',
    label: 'Blank note',
    icon: '📄',
    description: 'Start from scratch',
    title: '',
    content: '<p></p>',
  },
  {
    id: '1on1',
    label: '1-on-1',
    icon: '👥',
    description: 'Structured notes for 1-on-1 meetings',
    title: '1-on-1 — ',
    content: `<h2>1-on-1 Notes</h2>
<p><strong>Date:</strong> </p>
<p><strong>With:</strong> </p>
<h3>Their updates</h3>
<ul><li><p></p></li></ul>
<h3>My updates</h3>
<ul><li><p></p></li></ul>
<h3>Topics discussed</h3>
<ul><li><p></p></li></ul>
<h3>Action items</h3>
<ul data-type="taskList"><li data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li></ul>
<h3>Notes for next time</h3>
<p></p>`,
  },
  {
    id: 'meeting',
    label: 'Meeting notes',
    icon: '📋',
    description: 'Agenda, decisions and action items',
    title: 'Meeting — ',
    content: `<h2>Meeting Notes</h2>
<p><strong>Date:</strong> </p>
<p><strong>Attendees:</strong> </p>
<p><strong>Goal:</strong> </p>
<h3>Agenda</h3>
<ol><li><p></p></li></ol>
<h3>Discussion</h3>
<p></p>
<h3>Decisions made</h3>
<ul><li><p></p></li></ul>
<h3>Action items</h3>
<ul data-type="taskList"><li data-checked="false"><label><input type="checkbox"></label><div><p><strong>Owner:</strong> | <strong>Due:</strong> </p></div></li></ul>`,
  },
  {
    id: 'decision',
    label: 'Decision log',
    icon: '⚖️',
    description: 'Document options, reasoning and outcomes',
    title: 'Decision — ',
    content: `<h2>Decision Log</h2>
<p><strong>Date:</strong> </p>
<p><strong>Decision:</strong> </p>
<h3>Context</h3>
<p>Why does this decision need to be made?</p>
<h3>Options considered</h3>
<ol><li><p><strong>Option A:</strong> </p></li><li><p><strong>Option B:</strong> </p></li></ol>
<h3>Decision made</h3>
<blockquote><p></p></blockquote>
<h3>Reasoning</h3>
<p></p>
<h3>Consequences &amp; risks</h3>
<ul><li><p></p></li></ul>
<h3>Follow-up</h3>
<ul data-type="taskList"><li data-checked="false"><label><input type="checkbox"></label><div><p></p></div></li></ul>`,
  },
  {
    id: 'standup',
    label: 'Daily standup',
    icon: '☀️',
    description: 'Yesterday · Today · Blockers',
    title: 'Daily standup — ',
    content: `<h2>Daily Standup</h2>
<p><strong>Date:</strong> </p>
<h3>Yesterday</h3>
<ul><li><p></p></li></ul>
<h3>Today</h3>
<ul><li><p></p></li></ul>
<h3>Blockers</h3>
<ul><li><p></p></li></ul>`,
  },
  {
    id: 'feedback',
    label: 'Feedback',
    icon: '💬',
    description: 'Situation · Behaviour · Impact framework',
    title: 'Feedback — ',
    content: `<h2>Feedback Notes</h2>
<p><strong>For:</strong> </p>
<p><strong>Context:</strong> </p>
<h3>Situation</h3>
<p>What happened?</p>
<h3>Behaviour observed</h3>
<p></p>
<h3>Impact</h3>
<p></p>
<h3>Desired outcome</h3>
<p></p>`,
  },
]

interface Props {
  open: boolean
  onClose: () => void
  onSelect: (template: Template) => void
}

export function NoteTemplateModal({ open, onClose, onSelect }: Props) {
  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          backgroundColor: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(3px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 1001,
        width: '100%', maxWidth: 560,
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--foreground)' }}>
              Choose a template
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--muted-foreground)' }}>
              Pick a starting point for your note
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted-foreground)', padding: 6, borderRadius: 8,
              display: 'flex', alignItems: 'center',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--foreground)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          padding: 16,
        }}>
          {NOTE_TEMPLATES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => { onSelect(t); onClose() }}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '14px 16px', borderRadius: 10,
                border: '1px solid var(--border)',
                backgroundColor: 'transparent',
                cursor: 'pointer', textAlign: 'left',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--primary) 8%, transparent)'
                e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--primary) 40%, transparent)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              <span style={{ fontSize: 24, flexShrink: 0, lineHeight: 1, marginTop: 1 }}>{t.icon}</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>{t.label}</p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.4 }}>{t.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>,
    document.body
  )
}

// Keep old NoteTemplates export for any remaining references
export function NoteTemplates({ onSelect }: { onSelect: (t: Template) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {NOTE_TEMPLATES.map(t => (
        <button key={t.id} type="button" onClick={() => onSelect(t)} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px', borderRadius: 8,
          border: '1px solid var(--border)', backgroundColor: 'transparent',
          cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(124,106,255,0.08)'; e.currentTarget.style.borderColor = 'var(--primary)44' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = 'var(--border)' }}
        >
          <span style={{ fontSize: 18 }}>{t.icon}</span>
          <span style={{ fontSize: 13, color: 'var(--foreground)' }}>{t.label}</span>
        </button>
      ))}
    </div>
  )
}
