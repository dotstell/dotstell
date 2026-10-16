'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Loader2, Check, Users, Upload, ChevronLeft, ListChecks, Mic, Square } from 'lucide-react'
import { AIConfig } from '@/lib/ai/types'
import { parseTranscript, MAX_TRANSCRIPT_CHARS } from '@/lib/meetings/transcript'
import { digestToHtml, isoDue, type ActionItem, type MeetingDigest } from '@/lib/meetings/digest'
import { summariseMeeting } from '@/lib/meetings/run'
import { transcribeAudio, transcriptionTarget } from '@/lib/voice/transcribe'
import { useRecorder } from '@/hooks/useRecorder'

const MAX_FILE_BYTES = 2 * 1024 * 1024

const PROVIDER_NAMES: Record<AIConfig['provider'], string> = { ollama: 'Ollama', openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Google Gemini', groq: 'Groq' }

interface Person { id: string; name: string }

interface Props {
  config: AIConfig
  noteTitle?: string
  /** The saved note's id, so tasks created here can be linked back to it. Absent for an unsaved note. */
  noteId?: string
  onInsert: (html: string) => void
  onClose: () => void
}

/** The person an action item's owner most likely is: an exact name, or a first name that only one person has. */
function matchPerson(owner: string | null, people: Person[]): Person | null {
  if (!owner) return null
  const name = owner.trim().toLowerCase()
  const exact = people.filter(p => p.name.trim().toLowerCase() === name)
  if (exact.length === 1) return exact[0]
  const first = people.filter(p => p.name.trim().toLowerCase().split(/\s+/)[0] === name.split(/\s+/)[0])
  return first.length === 1 && !exact.length ? first[0] : null
}

export function AIMeetingPanel({ config, noteTitle, noteId, onInsert, onClose }: Props) {
  const [phase, setPhase] = useState<'input' | 'working' | 'result'>('input')
  const [raw, setRaw] = useState('')
  // An unnamed note is called "Untitled"; that is a placeholder, not a meeting title.
  const [title, setTitle] = useState(noteTitle && noteTitle !== 'Untitled' ? noteTitle : '')
  const [progress, setProgress] = useState<[number, number]>([0, 1])
  const [error, setError] = useState<string | null>(null)
  const [digest, setDigest] = useState<MeetingDigest | null>(null)
  const [attendees, setAttendees] = useState<string[]>([])
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [people, setPeople] = useState<Person[]>([])
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<number | null>(null)
  const [tabAudio, setTabAudio] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const parsed = useMemo(() => (raw.trim() ? parseTranscript(raw) : null), [raw])

  const target = useMemo(() => transcriptionTarget(config), [config])
  const recorder = useRecorder({
    transcribe: audio => (target ? transcribeAudio(audio, target) : Promise.reject(new Error('Add an OpenAI or Groq key in AI Settings to transcribe recordings.'))),
    onText: text => setRaw(prev => prev + text),
  })
  const recording = recorder.status !== 'idle'
  const busyTranscribing = recording || recorder.inFlight > 0

  function close() {
    if (recording && !window.confirm('A recording is in progress. Stop it and close?')) return
    onClose()
  }

  useEffect(() => {
    fetch('/api/people').then(r => (r.ok ? r.json() : [])).then(list => {
      if (Array.isArray(list)) setPeople(list.map((p: Person) => ({ id: p.id, name: p.name })))
    }).catch(() => {})
    return () => abortRef.current?.abort()
  }, [])

  async function loadFile(file: File | undefined) {
    if (!file) return
    setError(null)
    if (file.size > MAX_FILE_BYTES) { setError('That file is over 2 MB. Transcripts are plain text and are normally much smaller.'); return }
    if (!/\.(vtt|srt|txt|md)$/i.test(file.name)) { setError('Choose a transcript file: .vtt, .srt or .txt.'); return }
    setRaw(await file.text())
    if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim())
  }

  async function run() {
    if (!parsed || !parsed.text.trim()) return
    const ctl = new AbortController()
    abortRef.current = ctl
    setError(null); setPhase('working'); setProgress([0, 1])
    try {
      const result = await summariseMeeting(parsed.text, {
        config, title: title.trim() || undefined, attendees: parsed.speakers, signal: ctl.signal,
        onProgress: (done, total) => setProgress([done, total]),
      })
      setDigest(result)
      setAttendees(parsed.speakers)
      setPicked(new Set(result.actionItems.map((_, i) => i)))
      setPhase('result')
    } catch (err) {
      setPhase('input')
      if (ctl.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Could not summarise the meeting.')
    }
  }

  function removeFrom(key: 'keyPoints' | 'decisions' | 'openQuestions', index: number) {
    setDigest(d => (d ? { ...d, [key]: d[key].filter((_, i) => i !== index) } : d))
  }

  function removeAction(index: number) {
    setDigest(d => (d ? { ...d, actionItems: d.actionItems.filter((_, i) => i !== index) } : d))
    setPicked(prev => new Set([...prev].filter(i => i !== index).map(i => (i > index ? i - 1 : i))))
  }

  function togglePicked(index: number) {
    setPicked(prev => { const next = new Set(prev); if (next.has(index)) next.delete(index); else next.add(index); return next })
  }

  function insert() {
    if (!digest) return
    onInsert(digestToHtml(digest, { attendees }))
    onClose()
  }

  async function createTasks() {
    if (!digest) return
    setCreating(true); setError(null)
    let made = 0
    for (const [index, item] of digest.actionItems.entries()) {
      if (!picked.has(index)) continue
      const person = matchPerson(item.owner, people)
      const due = isoDue(item.due)
      const notes = [title.trim() && `From the meeting "${title.trim()}".`, item.owner && !person && `Owner: ${item.owner}.`, item.due && !due && `Due: ${item.due}.`].filter(Boolean).join(' ')
      try {
        const res = await fetch('/api/tasks', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: item.text.slice(0, 500), description: notes || undefined,
            person_id: person?.id, due_date: due ? new Date(`${due}T09:00:00`).toISOString() : undefined,
          }),
        })
        if (!res.ok) continue
        made++
        const task = await res.json()
        if (noteId) {
          await fetch('/api/links', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_id: noteId, source_type: 'note', target_id: task.id, target_type: 'task' }),
          }).catch(() => {})
        }
      } catch { /* counted below */ }
    }
    setCreating(false)
    setCreated(made)
    if (made < picked.size) setError(`Created ${made} of ${picked.size} tasks. The rest could not be saved; try again.`)
  }

  const [done, total] = progress
  const canRun = !!parsed?.text.trim() && !busyTranscribing

  return (
    <div role="dialog" aria-label="Meeting assistant" style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 200,
      width: '100%', maxWidth: 400, backgroundColor: 'var(--card)',
      borderLeft: '1px solid var(--border)', boxShadow: '-12px 0 40px rgba(0,0,0,0.18)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={14} color="var(--primary)" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>Meeting assistant</p>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)' }}>Summary, decisions and action items</p>
          </div>
        </div>
        <button type="button" onClick={close} aria-label="Close meeting assistant" style={iconBtn}><X size={14} /></button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && (
          <div role="alert" style={{ padding: '8px 10px', borderRadius: 7, backgroundColor: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', color: '#f87171', fontSize: 12 }}>{error}</div>
        )}

        {phase === 'input' && (
          <>
            <label style={labelStyle}>
              Meeting title
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Weekly security sync" style={inputStyle} />
            </label>

            <label style={labelStyle}>
              Transcript
              <textarea
                value={raw} onChange={e => setRaw(e.target.value)} rows={9}
                placeholder="Paste a transcript or your rough notes, or choose a file below."
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
              />
            </label>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <input ref={fileRef} type="file" accept=".vtt,.srt,.txt,.md,text/plain,text/vtt" hidden onChange={e => { loadFile(e.target.files?.[0]); e.target.value = '' }} />
              <button type="button" onClick={() => fileRef.current?.click()} style={secondaryBtn}><Upload size={13} /> Choose a file</button>
              <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>.vtt, .srt or .txt, up to 2 MB. Zoom, Teams and Meet transcripts work.</span>
            </div>

            {recorder.supported && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, backgroundColor: 'var(--muted)' }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>Record a meeting</p>
                {!target ? (
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                    Recording is turned into text by OpenAI or Groq. Add one of those keys in AI Settings to use it. Pasting a transcript, choosing a file and dictation work without it.
                  </p>
                ) : (
                  <>
                    {recording ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span aria-hidden className="animate-pulse" style={{ width: 10, height: 10, borderRadius: 99, backgroundColor: '#ef4444', flexShrink: 0 }} />
                        <span role="status" aria-live="polite" style={{ flex: 1, fontSize: 12, color: 'var(--foreground)' }}>
                          {recorder.status === 'finishing' ? 'Finishing…' : `Recording ${String(Math.floor(recorder.seconds / 60)).padStart(2, '0')}:${String(recorder.seconds % 60).padStart(2, '0')}`}
                          {recorder.inFlight > 0 && <span style={{ color: 'var(--muted-foreground)' }}> · transcribing</span>}
                        </span>
                        <button type="button" onClick={recorder.stop} disabled={recorder.status === 'finishing'} style={{ ...primaryBtn, width: 'auto', backgroundColor: '#dc2626', padding: '6px 12px', fontSize: 12 }}>
                          <Square size={12} /> Stop
                        </button>
                      </div>
                    ) : (
                      <>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--foreground)' }}>
                          <input type="checkbox" checked={tabAudio} onChange={e => setTabAudio(e.target.checked)} style={{ marginTop: 2 }} />
                          <span>Also capture an online meeting in another browser tab<span style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)' }}>Zoom, Teams or Meet in the browser. Choose the tab and tick &quot;Also share tab audio&quot;.</span></span>
                        </label>
                        <button type="button" onClick={() => recorder.start({ includeTabAudio: tabAudio })} style={{ ...secondaryBtn, justifyContent: 'center', padding: '8px 12px' }}>
                          <Mic size={13} /> Start recording
                        </button>
                      </>
                    )}
                    {recorder.failedCount > 0 && recorder.inFlight === 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#f87171' }}>
                        <span style={{ flex: 1 }}>{recorder.failedCount} {recorder.failedCount === 1 ? 'part' : 'parts'} could not be transcribed.</span>
                        <button type="button" onClick={recorder.retryFailed} style={secondaryBtn}>Try again</button>
                      </div>
                    )}
                    {recorder.error && <p role="alert" style={{ margin: 0, fontSize: 12, color: '#f87171' }}>{recorder.error}</p>}
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
                      Tell everyone you are recording. The sound is sent to {target.provider === 'openai' ? 'OpenAI' : 'Groq'} with your key to be turned into text. dotstell does not receive or keep the audio.
                    </p>
                  </>
                )}
              </div>
            )}

            {parsed && (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>
                {parsed.speakers.length > 0 ? `${parsed.speakers.length} ${parsed.speakers.length === 1 ? 'speaker' : 'speakers'} found: ${parsed.speakers.slice(0, 6).join(', ')}${parsed.speakers.length > 6 ? '…' : ''}. ` : ''}
                {parsed.text.length.toLocaleString()} characters.
                {parsed.truncated && ` Only the first ${MAX_TRANSCRIPT_CHARS.toLocaleString()} characters will be used.`}
              </p>
            )}

            <button type="button" disabled={!canRun} onClick={run} style={{ ...primaryBtn, opacity: canRun ? 1 : 0.5, cursor: canRun ? 'pointer' : 'default' }}>
              <ListChecks size={13} /> {busyTranscribing ? 'Waiting for the recording…' : 'Summarise meeting'}
            </button>
            <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
              {config.provider === 'ollama'
                ? 'Your transcript is processed by Ollama on your own computer.'
                : `Your transcript is sent to ${PROVIDER_NAMES[config.provider]} using your API key, through the dotstell server, and is not stored.`}
            </p>
          </>
        )}

        {phase === 'working' && (
          <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '24px 0', alignItems: 'center' }}>
            <Loader2 size={22} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ margin: 0, fontSize: 13, color: 'var(--foreground)' }}>
              {total > 1 ? (done >= total ? 'Finishing…' : `Reading part ${Math.min(done + 1, total - 1)} of ${total - 1}…`) : 'Reading the transcript…'}
            </p>
            <div style={{ width: '100%', height: 4, borderRadius: 4, backgroundColor: 'var(--muted)' }}>
              <div style={{ width: `${Math.round((done / total) * 100)}%`, height: '100%', borderRadius: 4, backgroundColor: 'var(--primary)', transition: 'width 0.3s' }} />
            </div>
            <button type="button" onClick={() => abortRef.current?.abort()} style={secondaryBtn}>Cancel</button>
          </div>
        )}

        {phase === 'result' && digest && (
          <>
            <button type="button" onClick={() => { setPhase('input'); setDigest(null); setCreated(null) }} style={{ ...iconBtn, alignSelf: 'flex-start', gap: 4, fontSize: 12 }}>
              <ChevronLeft size={14} /> Back
            </button>

            <Section title="Summary">
              <textarea value={digest.summary} onChange={e => setDigest({ ...digest, summary: e.target.value })} rows={4} aria-label="Summary" style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
            </Section>
            <Editable title="Key points" items={digest.keyPoints} onRemove={i => removeFrom('keyPoints', i)} />
            <Editable title="Decisions" items={digest.decisions} onRemove={i => removeFrom('decisions', i)} />

            {digest.actionItems.length > 0 && (
              <Section title="Action items">
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {digest.actionItems.map((a: ActionItem, i) => {
                    const person = matchPerson(a.owner, people)
                    return (
                      <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--foreground)' }}>
                        <input type="checkbox" checked={picked.has(i)} onChange={() => togglePicked(i)} aria-label={`Create a task for: ${a.text}`} style={{ marginTop: 3 }} />
                        <span style={{ flex: 1 }}>
                          {a.text}
                          {(a.owner || a.due) && (
                            <span style={{ display: 'block', fontSize: 11, color: 'var(--muted-foreground)' }}>
                              {a.owner && <>{a.owner}{person ? ' (in People)' : ''}</>}{a.owner && a.due ? ' · ' : ''}{a.due && `due ${a.due}`}
                            </span>
                          )}
                        </span>
                        <button type="button" onClick={() => removeAction(i)} aria-label={`Remove action item: ${a.text}`} style={iconBtn}><X size={12} /></button>
                      </li>
                    )
                  })}
                </ul>
              </Section>
            )}
            <Editable title="Open questions" items={digest.openQuestions} onRemove={i => removeFrom('openQuestions', i)} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button type="button" onClick={insert} style={primaryBtn}><Check size={13} /> Insert into note</button>
              {digest.actionItems.length > 0 && (
                <button type="button" onClick={createTasks} disabled={creating || picked.size === 0 || created !== null} style={{ ...secondaryBtn, justifyContent: 'center', padding: '8px 14px', opacity: picked.size === 0 || created !== null ? 0.5 : 1 }}>
                  {creating ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Creating…</>
                    : created !== null ? `${created} ${created === 1 ? 'task' : 'tasks'} created`
                      : `Create ${picked.size} ${picked.size === 1 ? 'task' : 'tasks'}`}
                </button>
              )}
              {!noteId && digest.actionItems.length > 0 && <p style={{ margin: 0, fontSize: 11, color: 'var(--muted-foreground)' }}>Save the note first if you want the tasks linked to it.</p>}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{title}</p>
      {children}
    </div>
  )
}

function Editable({ title, items, onRemove }: { title: string; items: string[]; onRemove: (index: number) => void }) {
  if (items.length === 0) return null
  return (
    <Section title={title}>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: 'var(--foreground)' }}>
            <span aria-hidden style={{ color: 'var(--muted-foreground)' }}>•</span>
            <span style={{ flex: 1 }}>{item}</span>
            <button type="button" onClick={() => onRemove(i)} aria-label={`Remove: ${item}`} style={iconBtn}><X size={12} /></button>
          </li>
        ))}
      </ul>
    </Section>
  )
}

const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, fontSize: 13, border: '1px solid var(--border)', backgroundColor: 'var(--muted)', color: 'var(--foreground)', outline: 'none', textTransform: 'none', letterSpacing: 'normal', fontWeight: 400 }
const primaryBtn: React.CSSProperties = { width: '100%', padding: '9px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }
const secondaryBtn: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: '1px solid var(--border)', cursor: 'pointer', backgroundColor: 'transparent', color: 'var(--foreground)', display: 'flex', alignItems: 'center', gap: 6 }
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 5, borderRadius: 6, display: 'flex', alignItems: 'center' }
