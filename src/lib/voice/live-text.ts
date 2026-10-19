import type { Editor } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'
import { dictationHighlightKey } from '@/lib/tiptap/DictationHighlightExtension'
import { dictationLayout } from './layout'

/** Extra space left under the words being dictated when the note has to scroll to keep them in view. */
const SCROLL_MARGIN = 48

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && node.scrollHeight > node.clientHeight) return node
  }
  return null
}

/**
 * Scrolls the note, only when needed, so the words being dictated at `pos` are visible and not behind the dictation
 * bar or the keyboard. On a phone the bar and keyboard can cover most of the note.
 */
function keepInView(editor: Editor, pos: number) {
  try {
    const caret = editor.view.coordsAtPos(pos)
    const viewport = window.visualViewport
    const viewportBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight
    let limitTop = 8
    let limitBottom = viewportBottom - 16
    const bar = dictationLayout.rect
    if (bar) {
      if (bar.top > viewportBottom / 2) limitBottom = Math.min(limitBottom, bar.top - 16)
      else limitTop = Math.max(limitTop, bar.bottom + 16)
    }
    const container = scrollParent(editor.view.dom as HTMLElement)
    if (container) {
      const box = container.getBoundingClientRect()
      limitTop = Math.max(limitTop, box.top + 8)
      limitBottom = Math.min(limitBottom, box.bottom - 8)
    }
    let delta = 0
    if (caret.bottom > limitBottom) delta = caret.bottom - limitBottom + SCROLL_MARGIN
    else if (caret.top < limitTop) delta = caret.top - limitTop - SCROLL_MARGIN
    if (delta === 0) return
    if (container) container.scrollBy({ top: delta })
    else window.scrollBy({ top: delta })
  } catch {
    // The position is not in view yet; nothing to scroll to.
  }
}

/**
 * A space to put before dictated `text` inserted at `pos`, when the character before it is not already a space or the
 * start of a line, and the text does not begin with punctuation that belongs against the previous word.
 */
function leadingSpace(editor: Editor, pos: number, text: string): string {
  if (!text || /^[\s,.;:!?)\]}%]/.test(text)) return ''
  const $pos = editor.state.doc.resolve(pos)
  if ($pos.parentOffset === 0) return ''
  // Something that is not text (an inline node such as a link to another note) counts as a word.
  const before = $pos.parent.textBetween($pos.parentOffset - 1, $pos.parentOffset, undefined, '\u0000')
  return before && !/\s/.test(before) ? ' ' : ''
}

/**
 * Provisional dictated text in a note. While a phrase is being recognised the engine keeps changing its guess, so the
 * guess is shown in the note, tinted, and replaced in place on every update instead of appended. `commit` turns it
 * into final text. The position is kept in step with edits made elsewhere in the note while dictating, and the note
 * scrolls to keep the words in view.
 *
 * Text is inserted as a text node, never parsed as HTML, so nothing dictated can be read as markup.
 */
export function createLiveText(editorRef: { current: Editor | null }) {
  let range: { from: number; to: number } | null = null
  /** The space put before the phrase in progress, kept the same for every update of it. */
  let lead = ''
  let tracked: Editor | null = null
  let applying = false

  const follow = ({ transaction }: { transaction: Transaction }) => {
    if (applying || !range || !transaction.docChanged) return
    const from = transaction.mapping.map(range.from, 1)
    const to = Math.max(from, transaction.mapping.map(range.to, -1))
    range = { from, to }
  }

  function track(editor: Editor) {
    if (tracked === editor) return
    tracked?.off('transaction', follow)
    editor.on('transaction', follow)
    tracked = editor
  }

  /** Replaces `from..to` with `text` and leaves the cursor after it. `tint` marks the new text as still provisional. */
  function write(editor: Editor, from: number, to: number, text: string, tint: boolean) {
    applying = true
    try {
      const chain = editor.chain().focus()
      if (text) chain.insertContentAt({ from, to }, { type: 'text', text })
      else if (to > from) chain.deleteRange({ from, to })
      chain.command(({ tr }) => {
        tr.setMeta(dictationHighlightKey, tint && text ? { from, to: from + text.length } : null)
        return true
      }).run()
    } finally {
      applying = false
    }
    if (tint && text) keepInView(editor, from + text.length)
  }

  return {
    /** Shows `text` as the provisional text of the phrase in progress, replacing the previous guess. Empty removes it. */
    live(text: string): void {
      const editor = editorRef.current
      if (!editor) return
      if (!text && !range) return
      track(editor)
      if (!range) {
        // The first guess replaces anything the user had selected, like typing over a selection.
        const { from, to } = editor.state.selection
        range = { from, to }
        lead = leadingSpace(editor, from, text)
      }
      const shown = text ? lead + text : ''
      write(editor, range.from, range.to, shown, true)
      range = shown ? { from: range.from, to: range.from + shown.length } : null
    },

    /** Makes `text` final: it takes the place of the provisional text, or goes in at the cursor when there is none. */
    commit(text: string): void {
      const editor = editorRef.current
      if (!editor) return
      track(editor)
      if (range) {
        const { from, to } = range
        range = null
        write(editor, from, to, lead + text, false)
      } else {
        const { from, to } = editor.state.selection
        write(editor, from, to, leadingSpace(editor, from, text) + text, false)
      }
      lead = ''
      keepInView(editor, editor.state.selection.to)
    },

    /** Forgets the provisional text without changing the note, for when dictation ends and the text stays. */
    release(): void {
      range = null
    },
  }
}

export type LiveText = ReturnType<typeof createLiveText>
