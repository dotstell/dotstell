import { describe, expect, it } from 'vitest'
import { createDictationAssembler, type SpeechPiece } from './dictation-assembler'

const fin = (transcript: string): SpeechPiece => ({ isFinal: true, transcript })
const part = (transcript: string): SpeechPiece => ({ isFinal: false, transcript })

/** Everything inserted over a run of events, joined the way the editor shows it. */
function run(assumeCumulative: boolean, events: { index: number; pieces: SpeechPiece[] }[]) {
  const assembler = createDictationAssembler({ assumeCumulative })
  const inserted: string[] = []
  for (const e of events) inserted.push(...assembler.update(e.index, e.pieces).insert)
  return inserted.join(' ')
}

describe('desktop engines (each phrase is its own final result)', () => {
  it('inserts every phrase once, in order', () => {
    expect(run(false, [
      { index: 0, pieces: [part('hello wor')] },
      { index: 0, pieces: [fin('hello world')] },
      { index: 1, pieces: [fin('hello world'), fin('how are you')] },
    ])).toBe('hello world how are you')
  })

  it('keeps a short repeated phrase', () => {
    expect(run(false, [
      { index: 0, pieces: [fin('hello')] },
      { index: 1, pieces: [fin('hello'), fin('hello there')] },
    ])).toBe('hello hello there')
  })

  it('keeps a phrase said twice', () => {
    expect(run(false, [
      { index: 0, pieces: [fin('no no no')] },
      { index: 1, pieces: [fin('no no no'), fin('no no no')] },
    ])).toBe('no no no no no no')
  })
})

describe('Android Chrome (every result repeats the session so far, all final)', () => {
  it('inserts only the new words', () => {
    expect(run(true, [
      { index: 0, pieces: [fin('one')] },
      { index: 1, pieces: [fin('one'), fin('one two')] },
      { index: 2, pieces: [fin('one'), fin('one two'), fin('one two three')] },
    ])).toBe('one two three')
  })

  it('ignores a result sent again, and adds only what grew', () => {
    expect(run(true, [
      { index: 0, pieces: [fin('hello world')] },
      { index: 0, pieces: [fin('hello world')] },
      { index: 0, pieces: [fin('hello world how are you')] },
    ])).toBe('hello world how are you')
  })

  it('ignores an identical duplicate final result at a new index', () => {
    expect(run(true, [
      { index: 0, pieces: [fin('hello world')] },
      { index: 1, pieces: [fin('hello world'), fin('hello world')] },
    ])).toBe('hello world')
  })

  it('works when the first utterance is short', () => {
    expect(run(true, [
      { index: 0, pieces: [fin('yes')] },
      { index: 1, pieces: [fin('yes'), fin('yes please')] },
    ])).toBe('yes please')
  })

  it('is not thrown off by punctuation and capital letters added later', () => {
    expect(run(true, [
      { index: 0, pieces: [fin('hello world')] },
      { index: 1, pieces: [fin('hello world'), fin('Hello world, how are you?')] },
    ])).toBe('hello world how are you?')
  })

  it('shows only the new part of an interim result', () => {
    const assembler = createDictationAssembler({ assumeCumulative: true })
    assembler.update(0, [fin('hello world')])
    expect(assembler.update(1, [fin('hello world'), part('hello world how are')]).interim).toBe('how are')
  })

  it('handles languages written without spaces', () => {
    expect(run(true, [
      { index: 0, pieces: [fin('今日は')] },
      { index: 1, pieces: [fin('今日は'), fin('今日は天気がいい')] },
    ])).toBe('今日は 天気がいい')
  })

  it('does not insert punctuation alone', () => {
    expect(run(true, [
      { index: 0, pieces: [fin('hello world')] },
      { index: 0, pieces: [fin('hello world.')] },
    ])).toBe('hello world')
  })
})

describe('an engine that turns cumulative without saying so', () => {
  it('switches on once a result repeats everything inserted so far', () => {
    expect(run(false, [
      { index: 0, pieces: [fin('good morning everyone')] },
      { index: 1, pieces: [fin('good morning everyone'), fin('good morning everyone welcome')] },
      { index: 2, pieces: [fin('good morning everyone'), fin('good morning everyone welcome'), fin('good morning everyone welcome back')] },
    ])).toBe('good morning everyone welcome back')
  })
})

describe('sessions', () => {
  it('a new session starts clean', () => {
    const first = createDictationAssembler({ assumeCumulative: true })
    first.update(0, [fin('hello world')])
    const second = createDictationAssembler({ assumeCumulative: true })
    expect(second.update(0, [fin('hello world')]).insert).toEqual(['hello world'])
  })
})
