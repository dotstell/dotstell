import { describe, it, expect } from 'vitest'
import { createSegmenter } from './segmenter'
import { cleanTranscript, languageCode } from './transcript-filter'

/** Feeds `ms` of audio at `level`, 50 ms at a time, and returns the cuts that happened. */
function run(seg: ReturnType<typeof createSegmenter>, clock: { t: number }, level: number, ms: number) {
  const cuts: { hadSpeech: boolean; speechMs: number; at: number }[] = []
  for (let i = 0; i < ms / 50; i++) {
    clock.t += 50
    const { cut } = seg.push(level, clock.t)
    if (cut) cuts.push({ ...cut, at: clock.t })
  }
  return cuts
}

describe('createSegmenter', () => {
  it('cuts after a pause that follows speech', () => {
    const seg = createSegmenter(); const clock = { t: 0 }
    expect(run(seg, clock, 0.002, 500)).toEqual([])
    expect(run(seg, clock, 0.1, 2000)).toEqual([])
    const cuts = run(seg, clock, 0.002, 1000)
    expect(cuts).toHaveLength(1)
    expect(cuts[0].hadSpeech).toBe(true)
    expect(cuts[0].speechMs).toBeGreaterThanOrEqual(1900)
  })

  it('does not cut on a short pause between words', () => {
    const seg = createSegmenter(); const clock = { t: 0 }
    run(seg, clock, 0.1, 1000)
    expect(run(seg, clock, 0.002, 400)).toEqual([])
    expect(run(seg, clock, 0.1, 1000)).toEqual([])
  })

  it('reports a piece that was only silence as having no speech, at the hard limit', () => {
    const seg = createSegmenter(); const clock = { t: 0 }
    const cuts = run(seg, clock, 0.002, 30_000)
    expect(cuts).toHaveLength(1)
    expect(cuts[0].hadSpeech).toBe(false)
  })

  it('ignores a click that is too short to be speech', () => {
    const seg = createSegmenter(); const clock = { t: 0 }
    run(seg, clock, 0.002, 500)
    run(seg, clock, 0.2, 100)
    const cuts = run(seg, clock, 0.002, 28_000)
    expect(cuts.every(c => !c.hadSpeech)).toBe(true)
  })

  it('cuts at a short breath once a monologue is long, and always before the hard limit', () => {
    const seg = createSegmenter(); const clock = { t: 0 }
    expect(run(seg, clock, 0.1, 19_000)).toEqual([])
    const cuts = run(seg, clock, 0.002, 400)
    expect(cuts).toHaveLength(1)
    const seg2 = createSegmenter(); const clock2 = { t: 0 }
    const hard = run(seg2, clock2, 0.1, 40_000)
    expect(hard[0].at).toBeLessThanOrEqual(28_100)
  })

  it('learns a noisy room: steady noise is not speech', () => {
    const seg = createSegmenter(); const clock = { t: 0 }
    run(seg, clock, 0.02, 2000)
    run(seg, clock, 0.1, 1000)
    const cuts = run(seg, clock, 0.02, 1500)
    expect(cuts.length).toBeGreaterThanOrEqual(1)
  })

  it('finish describes the piece in progress', () => {
    const seg = createSegmenter(); const clock = { t: 0 }
    run(seg, clock, 0.1, 1000)
    expect(seg.finish().hadSpeech).toBe(true)
    expect(seg.finish().hadSpeech).toBe(false)
  })
})

describe('cleanTranscript', () => {
  it('drops nothing but punctuation', () => {
    expect(cleanTranscript(' ... ', { speechMs: 5000 })).toBe('')
    expect(cleanTranscript('', { speechMs: 5000 })).toBe('')
  })
  it('drops phrases made up for near-silence, only when little was said', () => {
    expect(cleanTranscript('Thank you.', { speechMs: 600 })).toBe('')
    expect(cleanTranscript('Thanks for watching!', { speechMs: 1200 })).toBe('')
    expect(cleanTranscript('Thank you.', { speechMs: 6000 })).toBe('Thank you.')
    expect(cleanTranscript('Thank you for the update, Daniel.', { speechMs: 600 })).toBe('Thank you for the update, Daniel.')
  })
  it('drops the context hint when the service echoes it back', () => {
    expect(cleanTranscript('We agreed to ship on Friday.', { speechMs: 3000, context: 'Earlier, we agreed to ship on Friday.' })).toBe('')
    expect(cleanTranscript('Then we test it.', { speechMs: 3000, context: 'We agreed to ship on Friday.' })).toBe('Then we test it.')
  })
  it('keeps normal text as the service wrote it', () => {
    expect(cleanTranscript('  Hello, world.  ', { speechMs: 2000 })).toBe('Hello, world.')
    expect(cleanTranscript('こんにちは。', { speechMs: 2000 })).toBe('こんにちは。')
  })
})

describe('languageCode', () => {
  it('takes the language from a locale', () => {
    expect(languageCode('en-US')).toBe('en')
    expect(languageCode('ja-JP')).toBe('ja')
    expect(languageCode('bn-BD')).toBe('bn')
    expect(languageCode('')).toBeUndefined()
  })
})
