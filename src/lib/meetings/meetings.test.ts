import { describe, it, expect } from 'vitest'
import { chunkTranscript, parseTranscript, MAX_TRANSCRIPT_CHARS } from './transcript'
import { digestToHtml, isoDue, mergeDigests, parseDigest } from './digest'
import { summariseMeeting } from './run'
import type { AIConfig } from '../ai/types'

describe('parseTranscript', () => {
  it('reads a Zoom WebVTT file and joins consecutive turns by the same speaker', () => {
    const vtt = [
      'WEBVTT', '', '1', '00:00:01.000 --> 00:00:04.000', 'Aiko Tanaka: Let us start with the release.', '',
      '2', '00:00:04.500 --> 00:00:07.000', 'Aiko Tanaka: It is planned for Friday.', '',
      '3', '00:00:08.000 --> 00:00:10.000', 'Sam Lee: I can write the notes.', '',
    ].join('\r\n')
    const t = parseTranscript(vtt)
    expect(t.format).toBe('vtt')
    expect(t.speakers).toEqual(['Aiko Tanaka', 'Sam Lee'])
    expect(t.text).toBe('Aiko Tanaka: Let us start with the release. It is planned for Friday.\nSam Lee: I can write the notes.')
  })

  it('reads Teams voice tags and strips other markup', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n<v Jo Smith>Hello <b>team</b><script>alert(1)</script></v>\n'
    const t = parseTranscript(vtt)
    expect(t.speakers).toEqual(['Jo Smith'])
    expect(t.text).toBe('Jo Smith: Hello teamalert(1)')
    expect(t.text).not.toContain('<')
  })

  it('reads SubRip files', () => {
    const srt = '1\n00:00:01,000 --> 00:00:03,000\nSam Lee: First point\n\n2\n00:00:04,000 --> 00:00:06,000\nA line with no speaker\n'
    const t = parseTranscript(srt)
    expect(t.format).toBe('srt')
    expect(t.text).toBe('Sam Lee: First point\nA line with no speaker')
  })

  it('reads the Zoom audio transcript and chat files', () => {
    const audio = '[Aiko Tanaka] 10:03:21\nWelcome everyone.\n\n[Sam Lee] 10:03:40\nThanks for joining.\n'
    expect(parseTranscript(audio)).toMatchObject({ format: 'zoom-audio', speakers: ['Aiko Tanaka', 'Sam Lee'] })
    const chat = '10:05:01\tFrom Aiko Tanaka to Everyone:\tLink is in the doc\n'.replace('\t', ' ').replace('\t', ' ')
    const c = parseTranscript(chat)
    expect(c.format).toBe('zoom-chat')
    expect(c.text).toBe('Aiko Tanaka: Link is in the doc')
  })

  it('keeps plain text, and only treats repeated prefixes as speakers', () => {
    const t = parseTranscript('Note: remember the budget\nAiko: yes\nSam: ok\nAiko: and the plan\n')
    expect(t.format).toBe('text')
    expect(t.speakers).toEqual(['Aiko'])
    expect(t.text.split('\n')[0]).toBe('Note: remember the budget')
  })

  it('cuts an oversized transcript and says so', () => {
    const t = parseTranscript('word '.repeat(MAX_TRANSCRIPT_CHARS))
    expect(t.truncated).toBe(true)
    expect(t.text.length).toBeLessThanOrEqual(MAX_TRANSCRIPT_CHARS)
  })

  it('handles hostile input quickly', () => {
    const start = Date.now()
    parseTranscript('<'.repeat(100_000))
    parseTranscript(('00:00:01.000 --> 00:00:02.000\n' + 'a: '.repeat(1000) + '\n').repeat(300))
    parseTranscript(':'.repeat(100_000))
    expect(Date.now() - start).toBeLessThan(3000)
  })
})

describe('chunkTranscript', () => {
  it('splits on line boundaries within the limit and loses nothing', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `Speaker ${i % 3}: ${'word '.repeat(20)}${i}`)
    const chunks = chunkTranscript(lines.join('\n'), 1000)
    expect(chunks.length).toBeGreaterThan(5)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1000)
    expect(chunks.join('\n')).toBe(lines.join('\n'))
  })
  it('cuts one very long line at sentence ends', () => {
    const chunks = chunkTranscript('Sentence number one is here. '.repeat(100), 500)
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(500)
    expect(chunks.every(c => c.endsWith('.'))).toBe(true)
  })
})

describe('parseDigest', () => {
  const good = { summary: 'We agreed the plan.', keyPoints: ['A'], decisions: ['Ship Friday'], actionItems: [{ text: 'Write notes', owner: 'Sam', due: '2026-10-30' }], openQuestions: [] }

  it('reads JSON wrapped in prose and code fences', () => {
    const d = parseDigest('Here you go:\n```json\n' + JSON.stringify(good) + '\n```\nHope that helps {not json}')
    expect(d?.actionItems[0]).toEqual({ text: 'Write notes', owner: 'Sam', due: '2026-10-30' })
    expect(d?.decisions).toEqual(['Ship Friday'])
  })
  it('turns "none"-style owners into null and accepts plain-string actions', () => {
    const d = parseDigest(JSON.stringify({ ...good, actionItems: [{ text: 'X', owner: 'None', due: 'TBD' }, 'Plain item', { owner: 'x' }] }))
    expect(d?.actionItems).toEqual([{ text: 'X', owner: null, due: null }, { text: 'Plain item', owner: null, due: null }])
  })
  it('handles braces inside strings and rejects non-JSON or empty replies', () => {
    expect(parseDigest('{"summary": "uses {braces} fine", "keyPoints": []}')?.summary).toBe('uses {braces} fine')
    expect(parseDigest('I could not do that.')).toBeNull()
    expect(parseDigest('{"summary": ""}')).toBeNull()
    expect(parseDigest('{"summary": "x"')).toBeNull()
  })
  it('limits sizes and ignores wrong types', () => {
    const d = parseDigest(JSON.stringify({ summary: 5, keyPoints: Array.from({ length: 500 }, (_, i) => 'point ' + i), decisions: 'no' }))
    expect(d?.summary).toBe('')
    expect(d?.keyPoints).toHaveLength(40)
    expect(d?.decisions).toEqual([])
  })
})

describe('digest helpers', () => {
  it('merges parts without repeating items', () => {
    const a = { summary: 'One.', keyPoints: ['Budget is set'], decisions: [], actionItems: [{ text: 'Send the plan', owner: 'Sam', due: null }], openQuestions: [] }
    const b = { summary: 'Two.', keyPoints: ['budget is set!'], decisions: ['Go'], actionItems: [{ text: 'send the plan.', owner: null, due: null }], openQuestions: [] }
    const m = mergeDigests([a, b])
    expect(m.summary).toBe('One. Two.')
    expect(m.keyPoints).toEqual(['Budget is set'])
    expect(m.actionItems).toHaveLength(1)
  })
  it('only trusts real ISO dates', () => {
    expect(isoDue('2026-10-30')).toBe('2026-10-30')
    expect(isoDue('2026-02-31')).toBeNull()
    expect(isoDue('Friday')).toBeNull()
    expect(isoDue(null)).toBeNull()
  })
  it('escapes everything it puts in the note', () => {
    const html = digestToHtml({
      summary: '<img src=x onerror=alert(1)>', keyPoints: ['<script>x</script>'], decisions: [],
      actionItems: [{ text: '"><b>do</b>', owner: '<i>Sam</i>', due: null }], openQuestions: [],
    }, { attendees: ['A&B'] })
    expect(html).not.toMatch(/<(img|script|b|i)[ >]/)
    expect(html).toContain('data-type="taskList"')
    expect(html).toContain('A&amp;B')
  })
})


describe('summariseMeeting', () => {
  const config = { provider: 'ollama', model: 'm', embeddingProvider: 'ollama', embeddingModel: 'e' } as AIConfig
  const digest = (summary: string, action?: string) => ({
    summary, keyPoints: [], decisions: [], openQuestions: [], actionItems: action ? [{ text: action, owner: null, due: null }] : [],
  })
  const reply = (body: object, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }))
  const longTranscript = Array.from({ length: 60 }, (_, i) => `Aiko: ${'sentence '.repeat(40)}${i}`).join('\n')

  it('sends one request for a short transcript and none to combine', async () => {
    const calls: { mode: string }[] = []
    const fetchImpl = (async (_u: string, init: RequestInit) => { calls.push(JSON.parse(String(init.body))); return reply({ digest: digest('Short meeting.') }) }) as unknown as typeof fetch
    const d = await summariseMeeting('Aiko: hello', { config, fetchImpl })
    expect(d.summary).toBe('Short meeting.')
    expect(calls.map(c => c.mode)).toEqual(['chunk'])
  })

  it('summarises each piece, then combines, reporting progress', async () => {
    const modes: string[] = []
    const progress: string[] = []
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      const b = JSON.parse(String(init.body)); modes.push(b.mode)
      return reply({ digest: digest(b.mode === 'combine' ? 'Whole meeting.' : 'Part.') })
    }) as unknown as typeof fetch
    const d = await summariseMeeting(longTranscript, { config, fetchImpl, onProgress: (a, b) => progress.push(`${a}/${b}`) })
    expect(d.summary).toBe('Whole meeting.')
    expect(modes.at(-1)).toBe('combine')
    expect(modes.filter(m => m === 'chunk').length).toBeGreaterThan(1)
    expect(progress.at(-1)).toMatch(/^(\d+)\/\1$/)
  })

  it('retries a failed piece once', async () => {
    let n = 0
    const fetchImpl = (async () => (++n === 1 ? reply({ error: 'bad json' }, 502) : reply({ digest: digest('Ok.') }))) as unknown as typeof fetch
    expect((await summariseMeeting('Aiko: hi', { config, fetchImpl })).summary).toBe('Ok.')
    expect(n).toBe(2)
  })

  it('gives up with the server message after the retry also fails', async () => {
    const fetchImpl = (async () => reply({ error: 'The model did not return usable notes.' }, 502)) as unknown as typeof fetch
    await expect(summariseMeeting('Aiko: hi', { config, fetchImpl })).rejects.toThrow('did not return usable notes')
  })

  it('keeps the parts when combining fails', async () => {
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      const b = JSON.parse(String(init.body))
      return b.mode === 'combine' ? reply({ error: 'nope' }, 502) : reply({ digest: digest(`Part ${b.index}.`, `Task ${b.index}`) })
    }) as unknown as typeof fetch
    const d = await summariseMeeting(longTranscript, { config, fetchImpl })
    expect(d.actionItems.length).toBeGreaterThan(1)
    expect(d.summary).toContain('Part 0.')
  })

  it('stops when cancelled', async () => {
    const ctl = new AbortController()
    const fetchImpl = (async () => { ctl.abort(); return reply({ digest: digest('x') }) }) as unknown as typeof fetch
    await expect(summariseMeeting(longTranscript, { config, fetchImpl, signal: ctl.signal })).rejects.toThrow()
  })
})

describe('providers and safety of what the model says', () => {
  const config = { provider: 'ollama', model: 'm', embeddingProvider: 'ollama', embeddingModel: 'e' } as AIConfig
  const reply = JSON.stringify({ summary: 'Local.', keyPoints: [], decisions: [], actionItems: [{ text: 'Do it', owner: 'Sam', due: 'Monday the 26th' }], openQuestions: [] })

  it('runs Ollama from the browser without calling the dotstell server', async () => {
    const seen: string[][] = []
    const fetchImpl = (async () => { throw new Error('must not call the server') }) as unknown as typeof fetch
    const d = await summariseMeeting('Aiko: hello there', {
      config, fetchImpl,
      completeLocal: async messages => { seen.push(messages.map(m => m.role)); return reply },
    })
    expect(d.summary).toBe('Local.')
    expect(seen).toEqual([['system', 'user']])
  })

  it('reports an unusable local reply', async () => {
    await expect(summariseMeeting('Aiko: hello', { config, completeLocal: async () => 'I cannot do that' })).rejects.toThrow('did not return usable notes')
  })

  it('uses smaller pieces for Ollama than for hosted providers', async () => {
    const text = Array.from({ length: 400 }, (_, i) => `Aiko: ${'word '.repeat(20)}${i}`).join('\n')
    let local = 0, hosted = 0
    await summariseMeeting(text, { config, completeLocal: async () => { local++; return reply } })
    const fetchImpl = (async () => new Response(JSON.stringify({ digest: JSON.parse(reply) }))) as unknown as typeof fetch
    const openai = { ...config, provider: 'openai' } as AIConfig
    await summariseMeeting(text, { config: openai, fetchImpl: (async (...a: Parameters<typeof fetch>) => { hosted++; return fetchImpl(...a) }) as typeof fetch })
    expect(local).toBeGreaterThan(hosted)
  })

  it('treats "Not specified" and similar as no value', () => {
    const d = parseDigest(JSON.stringify({ summary: 's', actionItems: [{ text: 'a', owner: 'Not specified', due: 'N/A' }, { text: 'b', owner: 'Unassigned', due: 'not mentioned' }] }))
    expect(d?.actionItems.every(a => a.owner === null && a.due === null)).toBe(true)
  })

  it('only trusts an ISO due date that appears in the transcript', () => {
    expect(isoDue('2023-04-26', 'Sam: by Monday the 26th')).toBeNull() // a year the model invented
    expect(isoDue('2026-10-30', 'Sam: notes by 2026-10-30')).toBe('2026-10-30')
    expect(isoDue('2026-10-30')).toBe('2026-10-30')
  })
})

describe('action items are never lost when combining', () => {
  const config = { provider: 'openai', model: 'm', embeddingProvider: 'openai', embeddingModel: 'e' } as AIConfig
  const part = (action: { text: string; owner: string | null }) => ({ summary: 's', keyPoints: [], decisions: [], openQuestions: [], actionItems: [{ ...action, due: null }] })
  const text = Array.from({ length: 400 }, (_, i) => `Aiko: ${'word '.repeat(20)}${i}`).join('\n')

  it('keeps every distinct task even when the model combines them into one', async () => {
    let n = 0
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      const b = JSON.parse(String(init.body))
      return new Response(JSON.stringify({ digest: b.mode === 'combine'
        ? { ...part({ text: 'Only one survived', owner: null }), summary: 'Whole.' }
        : part({ text: `Task number ${++n} for someone`, owner: `Person ${n}` }) }))
    }) as unknown as typeof fetch
    const d = await summariseMeeting(text, { config, fetchImpl })
    expect(d.summary).toBe('Whole.')
    expect(d.actionItems.length).toBeGreaterThanOrEqual(2)
    expect(d.actionItems.map(a => a.text)).not.toContain('Only one survived')
  })

  it('still removes the same task worded twice', () => {
    const a = { summary: '', keyPoints: [], decisions: [], openQuestions: [], actionItems: [{ text: 'Send the updated release plan to finance', owner: 'Sam', due: null }] }
    const b = { ...a, actionItems: [{ text: 'Send updated release plan to the finance team', owner: 'sam', due: null }, { text: 'Send the updated release plan to finance', owner: 'Priya', due: null }] }
    expect(mergeDigests([a, b]).actionItems.map(x => x.owner)).toEqual(['Sam', 'Priya'])
  })
})

describe('long meetings on a small local model', () => {
  const config = { provider: 'ollama', model: 'm', embeddingProvider: 'ollama', embeddingModel: 'e' } as AIConfig
  const text = Array.from({ length: 800 }, (_, i) => `Aiko: ${'word '.repeat(20)}${i}`).join('\n') // ~80k characters

  it('merges many pieces in groups that fit a small context window, and loses no task', async () => {
    let chunkCalls = 0
    const combineSizes: number[] = []
    const progress: [number, number][] = []
    const completeLocal = async (messages: { role: string; content: string }[]) => {
      if (messages[0].content.startsWith('You turn part')) {
        chunkCalls++
        return JSON.stringify({ summary: `Piece ${chunkCalls}.`, keyPoints: [], decisions: [], openQuestions: [], actionItems: [{ text: `Unique job number ${chunkCalls} for the team`, owner: `Owner ${chunkCalls}`, due: null }] })
      }
      combineSizes.push(JSON.parse(messages[1].content).length)
      return JSON.stringify({ summary: 'Merged.', keyPoints: [], decisions: [], openQuestions: [], actionItems: [{ text: 'Only this survived', owner: null, due: null }] })
    }
    const d = await summariseMeeting(text, { config, completeLocal, onProgress: (a, b) => progress.push([a, b]) })
    expect(chunkCalls).toBeGreaterThan(30)                       // small pieces
    expect(Math.max(...combineSizes)).toBeLessThanOrEqual(8)     // never more than a small model can take at once
    expect(combineSizes.length).toBeGreaterThan(1)               // grouped, then merged again
    expect(d.actionItems).toHaveLength(Math.min(chunkCalls, 40)) // every distinct task kept, up to the list limit
    expect(progress.at(-1)![0]).toBe(progress.at(-1)![1])        // progress ends complete
    expect(progress.every(([a, b]) => a <= b)).toBe(true)
  })
})
