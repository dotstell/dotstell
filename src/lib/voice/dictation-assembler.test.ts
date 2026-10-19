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

describe('restarts and repeated chunks (Android, earbuds that reconnect)', () => {
  it('does not insert again the end of the previous session when a restarted session repeats it', () => {
    const assembler = createDictationAssembler({ assumeCumulative: true })
    const out: string[] = []
    assembler.startSession()
    out.push(...assembler.update(0, [fin('please send the report to marcus')]).insert)
    assembler.startSession()
    out.push(...assembler.update(0, [fin('send the report to marcus by friday')]).insert)
    expect(out.join(' ')).toBe('please send the report to marcus by friday')
  })

  it('drops a long chunk that was already inserted, from either session', () => {
    const assembler = createDictationAssembler({ assumeCumulative: true })
    const out: string[] = []
    assembler.startSession()
    out.push(...assembler.update(0, [fin('we agreed to ship the release on friday')]).insert)
    assembler.startSession()
    out.push(...assembler.update(0, [fin('we agreed to ship the release on friday')]).insert)
    expect(out.join(' ')).toBe('we agreed to ship the release on friday')
  })

  it('removes a window that slides forward', () => {
    expect(run(true, [
      { index: 0, pieces: [fin('the quick brown fox')] },
      { index: 1, pieces: [fin('the quick brown fox'), fin('brown fox jumps over the dog')] },
    ])).toBe('the quick brown fox jumps over the dog')
  })

  it('keeps short common words that happen to appear earlier', () => {
    expect(run(true, [
      { index: 0, pieces: [fin('yes I will send it')] },
      { index: 1, pieces: [fin('yes I will send it'), fin('yes')] },
      { index: 2, pieces: [fin('yes I will send it'), fin('yes'), fin('and no problem')] },
    ])).toBe('yes I will send it yes and no problem')
  })

  it('keeps a repeated phrase on engines that do not repeat results', () => {
    const assembler = createDictationAssembler({ assumeCumulative: false })
    assembler.startSession()
    const first = assembler.update(0, [fin('thank you very much')]).insert
    assembler.startSession()
    const second = assembler.update(0, [fin('thank you very much')]).insert
    expect([...first, ...second].join(' ')).toBe('thank you very much thank you very much')
  })
})

describe('guesses (Chrome on Android: every update is a new result, final but with confidence 0)', () => {
  const guess = (transcript: string): SpeechPiece => ({ isFinal: true, transcript, confidence: 0 })
  const sure = (transcript: string, confidence = 0.88): SpeechPiece => ({ isFinal: true, transcript, confidence })

  // The sequence captured on a Pixel: indexes 17 to 24, each result the phrase so far, only the last with a confidence.
  const base = 'hello dark still could you please make'
  const captured = [
    guess(base), guess(`${base} a`), guess(`${base} a note`), guess(`${base} a note`), guess(`${base} a note`),
    guess(`${base} a note what`), guess(`${base} a note what we're`), sure(`${base} a note what are you talking`),
  ]

  it('inserts the confident result once and none of the guesses before it', () => {
    const assembler = createDictationAssembler()
    assembler.startSession()
    const inserted: string[] = []
    const list: SpeechPiece[] = []
    captured.forEach((piece, n) => {
      list.push(piece)
      const result = assembler.update(n, [...list])
      if (n < captured.length - 1) expect(result.insert).toEqual([])
      inserted.push(...result.insert)
    })
    expect(inserted).toEqual([`${base} a note what are you talking`])
  })

  it('shows the latest guess while the phrase is going', () => {
    const assembler = createDictationAssembler()
    assembler.update(0, [guess('hello there')])
    expect(assembler.update(1, [guess('hello there'), guess('hello there my friend')]).interim).toBe('hello there my friend')
  })

  it('inserts the last guess when no confident result ever comes', () => {
    const assembler = createDictationAssembler()
    assembler.update(0, [guess('please call marcus')])
    assembler.update(1, [guess('please call marcus'), guess('please call marcus tomorrow')])
    expect(assembler.hasGuess()).toBe(true)
    expect(assembler.flush()).toEqual(['please call marcus tomorrow'])
    expect(assembler.hasGuess()).toBe(false)
    expect(assembler.flush()).toEqual([])
  })

  it('does not insert again a confident result that arrives after its guess was flushed', () => {
    const assembler = createDictationAssembler()
    assembler.update(0, [guess('please call marcus tomorrow')])
    const first = assembler.flush()
    const late = assembler.update(1, [guess('please call marcus tomorrow'), sure('Please call Marcus tomorrow.')]).insert
    expect([...first, ...late]).toEqual(['please call marcus tomorrow'])
  })

  it('adds only the extra words when the confident result is longer than the flushed guess', () => {
    const assembler = createDictationAssembler()
    assembler.update(0, [guess('please call marcus')])
    const first = assembler.flush()
    const late = assembler.update(1, [guess('please call marcus'), sure('please call marcus tomorrow')]).insert
    expect([...first, ...late].join(' ')).toBe('please call marcus tomorrow')
  })

  it('finishes a guess of one phrase when a different phrase starts', () => {
    const assembler = createDictationAssembler()
    const out: string[] = []
    out.push(...assembler.update(0, [guess('send the report')]).insert)
    out.push(...assembler.update(1, [guess('send the report'), guess('book a meeting room')]).insert)
    out.push(...assembler.update(2, [guess('send the report'), guess('book a meeting room'), sure('book a meeting room for friday')]).insert)
    expect(out).toEqual(['send the report', 'book a meeting room for friday'])
  })

  it('handles two phrases in a row', () => {
    const assembler = createDictationAssembler()
    const out: string[] = []
    out.push(...assembler.update(0, [guess('first phrase'), ]).insert)
    out.push(...assembler.update(1, [guess('first phrase'), sure('first phrase here')]).insert)
    out.push(...assembler.update(2, [guess('first phrase'), sure('first phrase here'), guess('second one')]).insert)
    out.push(...assembler.update(3, [guess('first phrase'), sure('first phrase here'), guess('second one'), sure('second one now')]).insert)
    expect(out).toEqual(['first phrase here', 'second one now'])
  })
})
