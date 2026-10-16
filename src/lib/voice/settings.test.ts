// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { loadSpeechSettings, saveSpeechSettings } from './settings'

describe('speech settings', () => {
  beforeEach(() => localStorage.clear())

  it('saves and loads a key, trimmed', () => {
    saveSpeechSettings({ provider: 'groq', apiKey: '  gsk-1 ' })
    expect(loadSpeechSettings()).toEqual({ provider: 'groq', apiKey: 'gsk-1' })
  })
  it('can be removed', () => {
    saveSpeechSettings({ provider: 'openai', apiKey: 'sk' })
    saveSpeechSettings(null)
    expect(loadSpeechSettings()).toBeNull()
  })
  it('ignores damaged or unexpected stored data', () => {
    for (const bad of ['not json', '{"provider":"evil","apiKey":"x"}', '{"provider":"groq","apiKey":"  "}', '{"provider":"groq"}', 'null']) {
      localStorage.setItem('dotstell-stt-config', bad)
      expect(loadSpeechSettings()).toBeNull()
    }
  })
})
