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
  /**
   * The current guess of the phrase in progress, without anything already inserted. Show it in the note as provisional
   * text and replace it on every update; it becomes final when `insert` or `flush()` returns it. Empty when none.
   */
  live: string
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
/** A repeated start may differ from what was inserted by about this share of its words (a revised word or two). */
const FUZZY_ALLOWANCE = 0.15
const FUZZY_MAX_WORDS = 300
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

/** Scripts written without spaces between words, where a repeat can end inside what looks like one word. */
const UNSPACED = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u

/** Whether dropping the first `count` letters and digits of `text` would cut a word in half ("an" from "a note"). */
function cutsWord(text: string, count: number): boolean {
  let seen = 0
  const chars = Array.from(text)
  for (let i = 0; i < chars.length; i++) {
    if (ALNUM.test(chars[i]) && ++seen === count) {
      const next = chars[i + 1]
      return next !== undefined && ALNUM.test(next) && !UNSPACED.test(next)
    }
  }
  return false
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

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const above = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = above
    }
  }
  return row[b.length]
}

/** 0 for the same word, up to 1 for words with nothing in common. */
const wordCost = (a: string, b: string) => (a === b ? 0 : Math.min(1, levenshtein(a, b) / Math.max(a.length, b.length)))

/**
 * How many leading words of `next` repeat `earlier`, allowing a word or two to have been revised, or 0 when the
 * start of `next` is not a version of `earlier`. A word-level edit distance, so "make an" matches "make a".
 */
function repeatedWordCount(earlier: string[], next: string[]): number {
  if (earlier.length < 3 || earlier.length > FUZZY_MAX_WORDS || next.length === 0) return 0
  const rows = earlier.length
  const cols = next.length
  const d: number[][] = Array.from({ length: rows + 1 }, (_, i) => [i, ...new Array<number>(cols).fill(0)])
  for (let j = 1; j <= cols; j++) d[0][j] = j
  for (let i = 1; i <= rows; i++) {
    for (let j = 1; j <= cols; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + wordCost(earlier[i - 1], next[j - 1]))
    }
  }
  let best = 0
  let bestCost = Infinity
  for (let m = Math.max(1, rows - 3); m <= Math.min(cols, rows + 3); m++) {
    const cost = d[rows][m]
    if (cost < bestCost || (cost === bestCost && Math.abs(m - rows) < Math.abs(best - rows))) { best = m; bestCost = cost }
  }
  return bestCost <= Math.max(1, FUZZY_ALLOWANCE * rows) ? best : 0
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
  let insertedWords: string[] = []
  let sessionWordStart = 0
  let cumulative = assumeCumulative
  let guess: { text: string; index: number } | null = null
  let flushed: { keys: string[]; at: number } | null = null

  /** Removes what was already inserted from `text`, when `text` repeats it. */
  function withoutInserted(text: string): string {
    let rest = text
    const sessionKeys = emitted.slice(sessionStart)
    if (sessionKeys.length >= (cumulative ? 1 : DETECT_MIN_KEYS) && startsWithKeys(alnumKeys(rest), sessionKeys) && !cutsWord(rest, sessionKeys.length)) {
      cumulative = true
      rest = dropKeys(rest, sessionKeys.length)
    } else if (cumulative && sessionKeys.length > 0) {
      // The start may repeat what was inserted with a word or two revised since.
      const repeated = repeatedWordCount(insertedWords.slice(sessionWordStart), wordsOf(rest))
      if (repeated > 0) rest = dropWords(rest, repeated)
    }
    if (!cumulative) return rest

    const words = wordsOf(rest)
    if (words.length === 0) return rest
    const tailWords = insertedWords.slice(-TAIL_WORDS)
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
      else text = startsWithKeys(alnumKeys(transcript), seenKeys) && !cutsWord(transcript, seenKeys.length) ? dropKeys(transcript, seenKeys.length) : ''
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
    insertedWords = insertedWords.concat(wordsOf(clean))
    if (fromGuess) {
      flushed = { keys: alnumKeys(clean), at: now() }
      // Guesses of one phrase each repeat the phrase so far, so what follows this one will repeat it too.
      cumulative = true
    }
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
      sessionWordStart = insertedWords.length
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
      const live = guess ? withoutInserted(guess.text).trim() : ''
      if (!interim && guess) interim = live
      return { insert, interim: interim.trim(), live }
    },
  }
}

export type DictationAssembler = ReturnType<typeof createDictationAssembler>
