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
