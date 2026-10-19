/** A pause this long after speech ends a piece of audio. */
const SILENCE_MS = 700
/** Past the soft limit a shorter pause is enough, so a long monologue is cut at a breath and not in the middle of a word. */
const SOFT_LIMIT_MS = 18_000
const SOFT_SILENCE_MS = 250
/** The longest a piece may get; transcription services cap the size of a file. */
const HARD_LIMIT_MS = 28_000
/** Less voice than this in a piece is a click or a cough, not speech worth sending. */
export const MIN_SPEECH_MS = 300
/** Sound below this level is never speech, however quiet the room is. */
const MIN_LEVEL = 0.012
/** Speech must be this many times louder than the background noise... */
const NOISE_RATIO = 2.5
/** ...but a noisy room never raises the bar above this. */
const MAX_THRESHOLD = 0.05
/** The background level is the quietest moment of the last few of these windows. */
const FLOOR_WINDOW_MS = 1000
const FLOOR_WINDOWS = 4

export interface Cut {
  /** The piece of audio that just ended had enough speech to be worth transcribing. */
  hadSpeech: boolean
  /** How much of the piece was voice, in ms. */
  speechMs: number
}

/**
 * Decides where to cut a continuous recording into pieces for transcription. It is fed the loudness of the audio
 * a few times a second and cuts at pauses, so words are not split between two pieces and silence is not sent.
 * The background noise level is the quietest moment of the last few seconds, so a steady hum is learned and speech,
 * which always has small gaps, does not raise it.
 */
export function createSegmenter() {
  let quietest: number[] = []
  let windowStart = 0
  let windowMin = Infinity
  let segmentStart: number | null = null
  let lastVoice: number | null = null
  let lastPush = 0
  let speechMs = 0

  function reset(now: number) {
    segmentStart = now
    lastVoice = null
    speechMs = 0
  }

  return {
    /** Feed the loudness (0 to 1) of the audio at time `now` (ms). Returns a cut when a piece has ended. */
    push(level: number, now: number): { speaking: boolean; cut: Cut | null } {
      if (segmentStart === null) { reset(now); lastPush = now; windowStart = now }
      const elapsed = now - lastPush
      lastPush = now
      if (now - windowStart >= FLOOR_WINDOW_MS) {
        if (windowMin !== Infinity) quietest = [...quietest, windowMin].slice(-FLOOR_WINDOWS)
        windowStart = now
        windowMin = Infinity
      }
      windowMin = Math.min(windowMin, level)
      const floor = Math.min(windowMin, ...quietest)
      const speaking = level > Math.max(MIN_LEVEL, Math.min(floor * NOISE_RATIO, MAX_THRESHOLD))
      if (speaking) {
        lastVoice = now
        speechMs += elapsed
      }

      const length = now - segmentStart!
      const quiet = lastVoice === null ? length : now - lastVoice
      const enough = speechMs >= MIN_SPEECH_MS
      const needed = length > SOFT_LIMIT_MS ? SOFT_SILENCE_MS : SILENCE_MS
      if ((enough && quiet >= needed) || length >= HARD_LIMIT_MS) {
        const cut = { hadSpeech: enough, speechMs }
        reset(now)
        return { speaking: false, cut }
      }
      return { speaking, cut: null }
    },

    /** The recording ended: describes the piece in progress. */
    finish(): Cut {
      const cut = { hadSpeech: speechMs >= MIN_SPEECH_MS, speechMs }
      segmentStart = null
      lastVoice = null
      speechMs = 0
      return cut
    },
  }
}
