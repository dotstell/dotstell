'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// Key is scoped per user so different accounts on the same browser each get onboarding
function storageKey(userId: string) { return `dotstell-onboarding-done:${userId}` }

const STEPS = [
  {
    emoji: '👋',
    title: 'Welcome to Dotstell',
    body: 'Your personal knowledge graph — connect your notes, tasks, people, and bookmarks in one place. Nothing siloed. Everything linked.',
    cta: 'Get started',
    skip: true,
  },
  {
    emoji: '📝',
    title: 'Start with a note',
    body: 'Notes are the heart of Dotstell. Write anything — ideas, research, meeting notes. Use [[ to link notes together and build your knowledge graph.',
    cta: 'Create my first note',
    skip: true,
  },
  {
    emoji: '🗂️',
    title: 'Organise with notebooks',
    body: 'Group related notes into notebooks. Pin important ones to the top. Use bookmarks to save anything from the web, and tasks to track what needs doing.',
    cta: "I'm ready — let's go",
    skip: false,
  },
]

export function OnboardingFlow() {
  const [visible, setVisible] = useState(false)
  const [step, setStep]       = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [userId, setUserId]   = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id ?? null
      setUserId(uid)
      if (uid && !localStorage.getItem(storageKey(uid))) setVisible(true)
    })
  }, [])

  function dismiss() {
    setLeaving(true)
    setTimeout(() => {
      if (userId) localStorage.setItem(storageKey(userId), '1')
      setVisible(false)
    }, 260)
  }

  async function advance() {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
      return
    }
    // Last step — create first note and navigate to it
    dismiss()
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'My first note', content: '<p>Start writing here…</p>', type: 'markdown', tags: [] }),
      })
      if (res.ok) {
        const note = await res.json()
        router.push(`/notes/${note.id}`)
      } else {
        router.push('/notes')
      }
    } catch {
      router.push('/notes')
    }
  }

  if (!visible) return null

  const current = STEPS[step]

  return (
    // Backdrop
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      opacity: leaving ? 0 : 1,
      transition: 'opacity 0.26s ease',
    }}>
      {/* Card */}
      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        padding: '40px 40px 32px',
        maxWidth: 460, width: '100%',
        boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
        transform: leaving ? 'scale(0.96)' : 'scale(1)',
        transition: 'transform 0.26s ease',
        position: 'relative',
      }}>

        {/* Skip */}
        {current.skip && (
          <button type="button" onClick={dismiss} style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: 'var(--muted-foreground)',
            padding: '4px 8px', borderRadius: 6,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--foreground)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
          >
            Skip
          </button>
        )}

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              height: 3, borderRadius: 99,
              flex: i === step ? 2 : 1,
              backgroundColor: i <= step ? 'var(--primary)' : 'var(--border)',
              transition: 'flex 0.3s ease, background-color 0.3s ease',
            }} />
          ))}
        </div>

        {/* Emoji */}
        <div style={{ fontSize: 44, marginBottom: 16, lineHeight: 1 }}>
          {current.emoji}
        </div>

        {/* Title */}
        <h2 style={{
          fontSize: 22, fontWeight: 800,
          color: 'var(--foreground)',
          marginBottom: 12, lineHeight: 1.25,
        }}>
          {current.title}
        </h2>

        {/* Body */}
        <p style={{
          fontSize: 15, color: 'var(--muted-foreground)',
          lineHeight: 1.65, marginBottom: 32,
        }}>
          {current.body}
        </p>

        {/* CTA */}
        <button type="button" onClick={advance} style={{
          width: '100%', padding: '13px 24px',
          background: 'linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 75%, #000))',
          color: 'var(--primary-foreground)',
          border: 'none', borderRadius: 11,
          fontSize: 15, fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 4px 20px color-mix(in srgb, var(--primary) 40%, transparent)',
          transition: 'opacity 0.15s, transform 0.1s',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)' }}
        >
          {current.cta}
          {step < STEPS.length - 1 && <span style={{ marginLeft: 6, opacity: 0.75 }}>→</span>}
        </button>

        {/* Step counter */}
        <p style={{
          textAlign: 'center', marginTop: 14,
          fontSize: 12, color: 'var(--muted-foreground)', opacity: 0.6,
        }}>
          {step + 1} of {STEPS.length}
        </p>
      </div>
    </div>
  )
}
