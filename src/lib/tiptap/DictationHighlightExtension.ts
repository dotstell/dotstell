import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface DictationRange {
  from: number
  to: number
}

/** Set a range (or null) with `tr.setMeta(dictationHighlightKey, range)`. */
export const dictationHighlightKey = new PluginKey<DictationRange | null>('dictationHighlight')

/**
 * Tints the text that dictation is still working on, so it is clear where spoken words are going. It is a decoration:
 * it is drawn over the text but never becomes part of the note, so it is not saved, copied or exported.
 */
export const DictationHighlightExtension = Extension.create({
  name: 'dictationHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<DictationRange | null>({
        key: dictationHighlightKey,
        state: {
          init: () => null,
          apply(tr, range) {
            const set = tr.getMeta(dictationHighlightKey) as DictationRange | null | undefined
            if (set !== undefined) return set
            if (!range || !tr.docChanged) return range
            const from = tr.mapping.map(range.from, 1)
            return { from, to: Math.max(from, tr.mapping.map(range.to, -1)) }
          },
        },
        props: {
          decorations(state) {
            const range = dictationHighlightKey.getState(state)
            if (!range || range.to <= range.from) return DecorationSet.empty
            return DecorationSet.create(state.doc, [Decoration.inline(range.from, range.to, { class: 'dictation-live' })])
          },
        },
      }),
    ]
  },
})
