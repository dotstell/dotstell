import { Node, mergeAttributes, type CommandProps } from '@tiptap/core'

export interface WikiLinkAttrs {
  noteId: string
  noteTitle: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikiLink: {
      insertWikiLink: (attrs: WikiLinkAttrs) => ReturnType
    }
  }
}

// ── WikiLink node ─────────────────────────────────────────────────────────────
// Stored in knowledge_links with label='__wikilink__' to distinguish from manual
// links. The `__wikilink__` sentinel lets queries separate auto-tracked wiki edges
// from user-created connections without a separate table.
export const WikiLinkExtension = Node.create({
  name: 'wikiLink',
  group: 'inline',
  inline: true,
  // atom: true makes the node indivisible — cursor cannot enter it, selection
  // treats it as a single character. Without this, typing inside [[...]] would
  // corrupt the node attributes instead of navigating within the link text.
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      noteId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-note-id'),
        renderHTML: (attrs: Record<string, unknown>) => ({ 'data-note-id': attrs.noteId }),
      },
      noteTitle: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-note-title') ?? '',
        renderHTML: (attrs: Record<string, unknown>) => ({ 'data-note-title': attrs.noteTitle }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'a[data-wikilink]' }]
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['a', mergeAttributes(HTMLAttributes, { 'data-wikilink': true }),
      `[[${HTMLAttributes['data-note-title'] || 'Untitled'}]]`]
  },

  addCommands() {
    return {
      insertWikiLink: (attrs: WikiLinkAttrs) => ({ commands }: CommandProps) => {
        return commands.insertContent({ type: 'wikiLink', attrs })
      },
    }
  },
})
