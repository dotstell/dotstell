/**
 * The one-time invitation to star dotstell on GitHub. It appears when someone has clearly got value from the app and
 * is never shown again once they act on it or say not now, so it can never become a nag.
 */

export const REPO_URL = 'https://github.com/dotstell/dotstell'
export const STAR_PROMPT_KEY = 'dotstell:star-prompt'
/** Notes a person needs before the dashboard asks; fewer than this and they are still finding their feet. */
export const STAR_MIN_NOTES = 10

export type StarPromptState = 'open' | 'done'

type Reader = Pick<Storage, 'getItem'>
type Writer = Pick<Storage, 'setItem'>

/** `done` once the person has clicked through or dismissed the invitation; anything unreadable counts as still open. */
export function readStarPrompt(storage: Reader): StarPromptState {
  try {
    return storage.getItem(STAR_PROMPT_KEY) === 'done' ? 'done' : 'open'
  } catch {
    // Storage can be blocked (private mode, strict settings). Asking again is worse than not asking, so stay quiet.
    return 'done'
  }
}

export function markStarPromptDone(storage: Writer): void {
  try {
    storage.setItem(STAR_PROMPT_KEY, 'done')
  } catch {
    // Nothing to remember it with; the invitation simply stays hidden for this visit.
  }
}
