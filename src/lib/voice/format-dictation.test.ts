import { describe, it, expect } from 'vitest'
import { formatDictation } from './format-dictation'

const on = { spoken: true, lang: 'en-US' }
const off = { spoken: false, lang: 'en-US' }

describe('spoken punctuation', () => {
  it('reads the unambiguous commands anywhere in a phrase', () => {
    expect(formatDictation('hello comma how are you question mark ', '', on)).toBe('Hello, how are you? ')
    expect(formatDictation('that is great exclamation mark ', '', on)).toBe('That is great! ')
    expect(formatDictation('we are done full stop ', '', on)).toBe('We are done. ')
    expect(formatDictation('wow exclamation point', '', on)).toBe('Wow!')
  })
  it('attaches the mark to the word before and puts a space after it', () => {
    expect(formatDictation('first comma second comma third', 'x', on)).toBe('first, second, third')
  })
  it('turns new line and new paragraph into a line break', () => {
    expect(formatDictation('end of item new line next item', 'x', on)).toBe('end of item\nNext item')
    expect(formatDictation('done new paragraph ', 'x', on)).toBe('done\n ')
  })
  it('reads period only at the end of a phrase or on its own', () => {
    expect(formatDictation('we are done period ', '', on)).toBe('We are done. ')
    expect(formatDictation('period', 'a sentence', on)).toBe('.')
    expect(formatDictation('the period of the loan ends', 'x', on)).toBe('the period of the loan ends')
    expect(formatDictation('in that time period', 'x', on)).toBe('in that time period')
  })
  it('leaves the words alone when the option is off', () => {
    expect(formatDictation('hello comma world', 'x', off)).toBe('hello comma world')
  })
  it('is case-insensitive and ignores case', () => {
    expect(formatDictation('Hello Comma world', 'x', on)).toBe('Hello, world')
  })
})

describe('automatic capitals', () => {
  it('capitalises the start of a note or paragraph', () => {
    expect(formatDictation('hello there ', '', on)).toBe('Hello there ')
    expect(formatDictation('hello there ', '   ', on)).toBe('Hello there ')
  })
  it('capitalises after a sentence end in the text before, but not mid-sentence', () => {
    expect(formatDictation('next point ', 'First point.', on)).toBe('Next point ')
    expect(formatDictation('is it ready ', 'Are we sure? ', on)).toBe('Is it ready ')
    expect(formatDictation('and more ', 'First point', on)).toBe('and more ')
  })
  it('capitalises after a sentence end inside the phrase', () => {
    expect(formatDictation('done full stop next thing ', 'x', on)).toBe('done. Next thing ')
  })
  it('writes I and its contractions in capitals', () => {
    expect(formatDictation('i think i am right and i will go', 'x', off)).toBe('I think I am right and I will go')
    expect(formatDictation("i'm sure i've seen it", 'x', off)).toBe("I'm sure I've seen it")
    expect(formatDictation('see i.e. this', 'x', off)).toMatch(/^see i.e./)
  })
  it('keeps surrounding spaces', () => {
    expect(formatDictation('hello ', '', on)).toBe('Hello ')
  })
  it('does nothing to other languages', () => {
    expect(formatDictation('hallo komma welt', '', { spoken: true, lang: 'de-DE' })).toBe('hallo komma welt')
    expect(formatDictation('こんにちは', '', { spoken: true, lang: 'ja-JP' })).toBe('こんにちは')
  })
})
