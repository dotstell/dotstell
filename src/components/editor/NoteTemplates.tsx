'use client'
import { FileText } from 'lucide-react'

interface Template {
  id: string
  label: string
  icon: string
  title: string
  content: string
}

export const NOTE_TEMPLATES: Template[] = [
  {
    id: '1on1',
    label: '1-on-1',
    icon: '👥',
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
    label: 'Meeting',
    icon: '📋',
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
    label: 'Decision',
    icon: '⚖️',
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
    label: 'Standup',
    icon: '☀️',
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
  {
    id: 'blank',
    label: 'Blank',
    icon: '📄',
    title: '',
    content: '<p></p>',
  },
]

interface NoteTemplatesProps {
  onSelect: (template: Template) => void
}

export function NoteTemplates({ onSelect }: NoteTemplatesProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <p style={{ fontSize: 11, color: '#3a3a5e', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
        Templates
      </p>
      {NOTE_TEMPLATES.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 8,
            border: '1px solid #2a2a3e', backgroundColor: 'transparent',
            cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(124,106,255,0.08)'; e.currentTarget.style.borderColor = '#7c6aff44' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.borderColor = '#2a2a3e' }}
        >
          <span style={{ fontSize: 20, flexShrink: 0 }}>{t.icon}</span>
          <span style={{ fontSize: 13, color: '#e8e8f0' }}>{t.label}</span>
        </button>
      ))}
    </div>
  )
}
