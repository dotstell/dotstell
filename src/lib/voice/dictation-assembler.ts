/** One entry of a SpeechRecognition result list, reduced to what dictation needs. */
export interface SpeechPiece {
  isFinal: boolean
  transcript: string
  confidence?: number
}

export interface DictationUpdate {
  /** New finished text to insert, in order. Never repeats text that was inserted before. */
  insert: string[]
  /** What is still being recognised, for display only. */
  interim: string
}

export interface AssemblerOptions {
  /** Start already treating each result as repeating the session so far. Otherwise this is detected. */
  assumeCumulative?: boolean
  /** Clock, replaceable in tests. */
  now?: () => number
}

/** A session must have produced at least this many letters and digits before a repeat is read as cumulative. */
const DETECT_MIN_KEYS = 8
/** A repeated chunk is only dropped when it is at least this long, so short common words are never lost. */
const CHUNK_MIN_WORDS = 3
const CHUNK_MIN_KEYS = 10
const OVERLAP_MIN_WORDS = 2
const OVERLAP_MIN_KEYS = 6
/** How many recent words are compared against when looking for a repeated chunk. */
const TAIL_WORDS = 80
/** A new guess is a revision of the last one when they share at least this many leading letters (or all of a shorter one). */
const REVISION_MIN_KEYS = 6
/** A confident result that repeats text inserted from a guess this recently only adds what is new. */
const FLUSH_ECHO_MS = 5000
const LEADING_PUNCTUATION = /^[\s,.;:!?。、！？，]+/u
const ALNUM = /[\p{L}\p{N}]/u
const WORD = /[\p{L}\p{N}]+/gu

/** Letters and digits in lower case, one entry per character, so case, spacing and punctuation never matter. */
function alnumKeys(text: string): string[] {
  const keys: string[] = []
  for (const ch of text) if (ALNUM.test(ch)) keys.push(ch.toLowerCase())
  return keys
}

/** The text after its first `count` letters and digits, without the punctuation that follows them. */
function dropKeys(text: string, count: number): string {
  let seen = 0
  let end = 0
  for (const ch of text) {
    end += ch.length
    if (ALNUM.test(ch) && ++seen === count) return text.slice(end).replace(LEADING_PUNCTUATION, '')
  }
  return ''
}

function wordsOf(text: string): string[] {
  return (text.match(WORD) ?? []).map(w => w.toLowerCase())
}

/** The text after its first `count` words, without the punctuation that follows them. */
function dropWords(text: string, count: number): string {
  let seen = 0
  for (const m of text.matchAll(WORD)) {
    if (++seen === count) return text.slice((m.index ?? 0) + m[0].length).replace(LEADING_PUNCTUATION, '')
  }
  return ''
}

function startsWithKeys(keys: string[], prefix: string[]): boolean {
  return keys.length >= prefix.length && prefix.every((k, i) => keys[i] === k)
}

function commonPrefixLength(a: string[], b: string[]): number {
  let n = 0
  while (n < a.length && n < b.length && a[n] === b[n]) n++
  return n
}

function sameRun(a: string[], aStart: number, b: string[], bStart: number, length: number): boolean {
  for (let i = 0; i < length; i++) if (a[aStart + i] !== b[bStart + i]) return false
  return true
}

function containsRun(tail: string[], run: string[]): boolean {
  for (let i = 0; i + run.length <= tail.length; i++) if (sameRun(tail, i, run, 0, run.length)) return true
  return false
}

const lettersIn = (words: string[]) => words.reduce((n, w) => n + w.length, 0)

/**
 * Turns the raw result lists of speech-recognition sessions into text to insert, once.
 *
 * Desktop engines report each phrase as one final result with a confidence. Chrome on Android instead sends a new
 * result for every update of a phrase, all marked final but with confidence 0 ("make", "make a", "make a note", ...),
 * revises words between them ("we're" becomes "are you talking"), and marks only the last one with a real confidence.
 * Inserting each final result as new text repeats and garbles words. So a final result with confidence 0 is treated
 * as a live guess: shown, but not inserted. The confident result is what gets inserted. If none ever comes (the
 * session ended, dictation stopped, or the engine went quiet), the last guess is inserted by `flush()` instead.
 *
 * Engines can also repeat the session so far in every result, send a result again, or repeat the end of the session
 * before. The assembler remembers what it inserted and only returns what is new. One assembler serves a whole
 * dictation run; call `startSession()` each time recognition (re)starts.
 */
export function createDictationAssembler({ assumeCumulative = false, now = Date.now }: AssemblerOptions = {}) {
  const handled = new Map<number, string>()
  let emitted: string[] = []
  let sessionStart = 0
  let tailWords: string[] = []
  let cumulative = assumeCumulative
  let guess: { text: string; index: number } | null = null
  let flushed: { keys: string[]; at: number } | null = null

  /** Removes what was already inserted from `text`, when `text` repeats it. */
  function withoutInserted(text: string): string {
    let rest = text
    const sessionKeys = emitted.slice(sessionStart)
    if (sessionKeys.length >= (cumulative ? 1 : DETECT_MIN_KEYS) && startsWithKeys(alnumKeys(rest), sessionKeys)) {
      cumulative = true
      rest = dropKeys(rest, sessionKeys.length)
    }
    if (!cumulative) return rest

    const words = wordsOf(rest)
    if (words.length === 0) return rest
    // A long enough chunk that was already inserted (a resent result, or the end of the previous session)
    if (words.length >= CHUNK_MIN_WORDS && lettersIn(words) >= CHUNK_MIN_KEYS && containsRun(tailWords, words)) return ''
    // The start of this text is the end of what was inserted: a window that slides forward
    for (let k = Math.min(tailWords.length, words.length); k >= OVERLAP_MIN_WORDS; k--) {
      if (lettersIn(words.slice(0, k)) >= OVERLAP_MIN_KEYS && sameRun(tailWords, tailWords.length - k, words, 0, k)) {
        return dropWords(rest, k)
      }
    }
    return rest
  }

  /** What of a finished result at `index` is new, remembering it as inserted. Empty when there is nothing new. */
  function finish(index: number, transcript: string, fromGuess: boolean): string {
    let text: string
    const before = handled.get(index)
    if (before !== undefined) {
      // The same result sent again: only text added to it since is new.
      const seenKeys = alnumKeys(before)
      if (seenKeys.length === 0) text = transcript
      else text = startsWithKeys(alnumKeys(transcript), seenKeys) ? dropKeys(transcript, seenKeys.length) : ''
    } else {
      text = withoutInserted(transcript)
    }
    handled.set(index, transcript)

    if (!fromGuess && flushed) {
      // A confident result right after its guess was inserted: only what the guess did not have is new.
      const echo = flushed
      flushed = null
      if (now() - echo.at <= FLUSH_ECHO_MS) {
        const keys = alnumKeys(text)
        if (startsWithKeys(keys, echo.keys)) text = dropKeys(text, echo.keys.length)
        else if (commonPrefixLength(keys, echo.keys) >= Math.min(REVISION_MIN_KEYS, echo.keys.length)) text = ''
      }
    }

    const clean = text.trim()
    if (!clean || alnumKeys(clean).length === 0) return ''
    emitted = emitted.concat(alnumKeys(clean))
    tailWords = tailWords.concat(wordsOf(clean)).slice(-TAIL_WORDS)
    if (fromGuess) flushed = { keys: alnumKeys(clean), at: now() }
    return clean
  }

  /** Whether `next` carries on the waiting guess (a longer or revised version of it) rather than being a new phrase. */
  function revisesGuess(next: string): boolean {
    if (!guess) return false
    const a = alnumKeys(guess.text)
    return commonPrefixLength(a, alnumKeys(next)) >= Math.min(REVISION_MIN_KEYS, a.length)
  }

  function commitGuess(): string {
    if (!guess) return ''
    const { text, index } = guess
    guess = null
    return finish(index, text, true)
  }

  return {
    /** Call when recognition starts or restarts. What was inserted stays remembered; the result numbering begins again. */
    startSession(): void {
      handled.clear()
      sessionStart = emitted.length
    },

    /** Whether a guess is waiting for its confident result, so the caller can flush it after a quiet moment. */
    hasGuess(): boolean {
      return guess !== null
    },

    /** Inserts the waiting guess, when no confident result came for it. Call when recognition ends or stops. */
    flush(): string[] {
      const text = commitGuess()
      return text ? [text] : []
    },

    /** Feed the full result list of one `result` event and the event's `resultIndex`. */
    update(resultIndex: number, pieces: ArrayLike<SpeechPiece>): DictationUpdate {
      const insert: string[] = []
      let interim = ''
      for (let i = resultIndex; i < pieces.length; i++) {
        const { isFinal, transcript, confidence } = pieces[i]

        if (!isFinal) {
          const rest = withoutInserted(transcript)
          interim = cumulative ? rest : interim + rest
          continue
        }

        if (confidence === 0) {
          // A live guess. A guess that only revises the last one replaces it; a different phrase finishes the last one first.
          if (guess && !revisesGuess(transcript)) {
            const done = commitGuess()
            if (done) insert.push(done)
          }
          guess = { text: transcript, index: i }
          interim = withoutInserted(transcript)
          continue
        }

        // The confident result replaces the guess it belongs to; a guess of some other phrase is finished first.
        if (guess && !revisesGuess(transcript)) {
          const earlier = commitGuess()
          if (earlier) insert.push(earlier)
        }
        guess = null
        const done = finish(i, transcript, false)
        if (done) insert.push(done)
      }
      if (!interim && guess) interim = withoutInserted(guess.text)
      return { insert, interim: interim.trim() }
    },
  }
}

export type DictationAssembler = ReturnType<typeof createDictationAssembler>
