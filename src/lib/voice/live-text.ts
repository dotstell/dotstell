import type { Editor } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'

/**
 * Provisional dictated text in a note. While a phrase is being recognised the engine keeps changing its guess, so the
 * guess is shown in the note and replaced in place on every update instead of appended. `commit` turns it into final
 * text. The position is kept in step with edits made elsewhere in the note while dictating.
 *
 * Text is inserted as a text node, never parsed as HTML, so nothing dictated can be read as markup.
 */
export function createLiveText(editorRef: { current: Editor | null }) {
  let range: { from: number; to: number } | null = null
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

  /** Replaces \`from..to\` with \`text\` and leaves the cursor after it. */
  function write(editor: Editor, from: number, to: number, text: string) {
    applying = true
    try {
      const chain = editor.chain().focus()
      if (text) chain.insertContentAt({ from, to }, { type: 'text', text }).run()
      else if (to > from) chain.deleteRange({ from, to }).run()
    } finally {
      applying = false
    }
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
      }
      write(editor, range.from, range.to, text)
      range = text ? { from: range.from, to: range.from + text.length } : null
    },

    /** Makes `text` final: it takes the place of the provisional text, or goes in at the cursor when there is none. */
    commit(text: string): void {
      const editor = editorRef.current
      if (!editor) return
      track(editor)
      if (range) {
        const { from, to } = range
        range = null
        write(editor, from, to, text)
      } else {
        write(editor, editor.state.selection.from, editor.state.selection.to, text)
      }
    },

    /** Forgets the provisional text without changing the note, for when dictation ends and the text stays. */
    release(): void {
      range = null
    },
  }
}

export type LiveText = ReturnType<typeof createLiveText>
