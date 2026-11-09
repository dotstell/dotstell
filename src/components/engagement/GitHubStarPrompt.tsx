'use client'
import { useSyncExternalStore } from 'react'
import { Star } from 'lucide-react'
import { markStarPromptDone, readStarPrompt, REPO_URL, type StarPromptState } from '@/lib/engagement/star-prompt'

const CHANGED = 'dotstell:star-prompt-changed'

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(CHANGED, onChange)
    window.removeEventListener('storage', onChange)
  }
}

const snapshot = (): StarPromptState => readStarPrompt(window.localStorage)
// The server cannot know, and a hidden invitation that appears is better than a visible one that vanishes.
const serverSnapshot = (): StarPromptState => 'done'

function finish() {
  markStarPromptDone(window.localStorage)
  window.dispatchEvent(new Event(CHANGED))
}

interface Props {
  /** `card` is the dashboard invitation; `inline` is the single line shown after a successful export. */
  variant: 'card' | 'inline'
}

/**
 * Asks, once, whether the person would star dotstell on GitHub. Choosing to star or choosing not now both end it
 * for good. The caller decides when it is a good moment to show it.
 */
export function GitHubStarPrompt({ variant }: Props) {
  const state = useSyncExternalStore(subscribe, snapshot, serverSnapshot)
  if (state === 'done') return null

  const inline = variant === 'inline'
  return (
    <aside
      aria-label="Support dotstell"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        padding: inline ? '10px 12px' : '12px 16px', borderRadius: 10, marginTop: inline ? 12 : 0, marginBottom: inline ? 0 : 20,
        backgroundColor: 'color-mix(in srgb, var(--primary) 7%, transparent)',
        border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
      }}
    >
      <Star size={16} color="var(--primary)" aria-hidden style={{ flexShrink: 0 }} />
      <p style={{ margin: 0, flex: '1 1 220px', fontSize: 13, lineHeight: 1.5, color: 'var(--foreground)' }}>
        {inline
          ? 'Glad it worked. dotstell is free and open source; a star on GitHub helps other people find it.'
          : 'Enjoying dotstell? It is free and open source, and a star on GitHub helps other people find it.'}
      </p>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <a
          href={REPO_URL} target="_blank" rel="noopener noreferrer" onClick={finish}
          className="touch-target-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: 'none', backgroundColor: 'var(--primary)', color: 'white' }}
        >
          <Star size={13} aria-hidden /> Star on GitHub
        </a>
        <button
          type="button" onClick={finish} className="touch-target-sm"
          style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--muted-foreground)', cursor: 'pointer' }}
        >
          Not now
        </button>
      </div>
    </aside>
  )
}
