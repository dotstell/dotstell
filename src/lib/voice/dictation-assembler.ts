/** One entry of a SpeechRecognition result list, reduced to what dictation needs. */
export interface SpeechPiece {
  isFinal: boolean
  transcript: string
}

export interface DictationUpdate {
  /** New finished text to insert, in order. Never repeats text that was inserted before. */
  insert: string[]
  /** What is still being recognised, for display only. */
  interim: string
}

/** A session must have produced at least this many letters and digits before a repeat is read as cumulative. */
const DETECT_MIN_KEYS = 8
const LEADING_PUNCTUATION = /^[\s,.;:!?。、！？，]+/u
const ALNUM = /[\p{L}\p{N}]/u

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

function startsWithKeys(keys: string[], prefix: string[]): boolean {
  return keys.length >= prefix.length && prefix.every((k, i) => keys[i] === k)
}

/**
 * Turns the raw result lists of one speech-recognition session into text to insert, once.
 *
 * Desktop engines report each phrase as its own final result. Android Chrome in continuous mode can instead report
 * every result as the whole session so far ("one", "one two", "one two three"), all marked final, and can send the
 * same result again. Inserting each final result as new text then repeats words. This keeps what has been inserted
 * and only returns what is new, whichever way the engine reports. Create one per recognition session.
 *
 * `assumeCumulative` starts in the cumulative mode (Android). Otherwise it switches on by itself the first time a
 * result repeats everything inserted so far (at least a few letters) and adds to it; a short repeated phrase
 * ("hello", then "hello there") is therefore still inserted in full on engines that do not repeat.
 */
export function createDictationAssembler({ assumeCumulative }: { assumeCumulative: boolean }) {
  const handled = new Map<number, string>()
  let emitted: string[] = []
  let cumulative = assumeCumulative

  /** Removes what was already inserted from the start of `text`, when `text` repeats it. */
  function withoutInserted(text: string): string {
    const needed = cumulative ? 1 : DETECT_MIN_KEYS
    if (emitted.length < needed) return text
    if (!startsWithKeys(alnumKeys(text), emitted)) return text
    cumulative = true
    return dropKeys(text, emitted.length)
  }

  return {
    /** Feed the full result list of one `result` event and the event's `resultIndex`. */
    update(resultIndex: number, pieces: ArrayLike<SpeechPiece>): DictationUpdate {
      const insert: string[] = []
      let interim = ''
      for (let i = resultIndex; i < pieces.length; i++) {
        const { isFinal, transcript } = pieces[i]
        if (!isFinal) {
          const rest = withoutInserted(transcript)
          interim = cumulative ? rest : interim + rest
          continue
        }

        let text = transcript
        const before = handled.get(i)
        if (before !== undefined) {
          // The same result sent again: only text added to it since is new.
          const seenKeys = alnumKeys(before)
          if (seenKeys.length === 0) text = transcript
          else text = startsWithKeys(alnumKeys(transcript), seenKeys) ? dropKeys(transcript, seenKeys.length) : ''
        } else {
          text = withoutInserted(transcript)
        }
        handled.set(i, transcript)

        const clean = text.trim()
        if (!clean || alnumKeys(clean).length === 0) continue
        insert.push(clean)
        emitted = emitted.concat(alnumKeys(clean))
      }
      return { insert, interim: interim.trim() }
    },
  }
}

export type DictationAssembler = ReturnType<typeof createDictationAssembler>
