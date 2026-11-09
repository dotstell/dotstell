import { describe, it, expect } from 'vitest'
import { markStarPromptDone, readStarPrompt, STAR_PROMPT_KEY } from './star-prompt'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v }, data }
}

const blocked = {
  getItem: () => { throw new Error('blocked') },
  setItem: () => { throw new Error('blocked') },
}

describe('star prompt state', () => {
  it('is open until the person acts on it', () => {
    expect(readStarPrompt(memoryStorage())).toBe('open')
    expect(readStarPrompt(memoryStorage({ [STAR_PROMPT_KEY]: 'something else' }))).toBe('open')
  })

  it('stays done once marked, for good', () => {
    const storage = memoryStorage()
    markStarPromptDone(storage)
    expect(readStarPrompt(storage)).toBe('done')
    markStarPromptDone(storage)
    expect(readStarPrompt(storage)).toBe('done')
  })

  it('stays quiet when storage is blocked, rather than asking on every visit', () => {
    expect(readStarPrompt(blocked)).toBe('done')
    expect(() => markStarPromptDone(blocked)).not.toThrow()
  })
})
