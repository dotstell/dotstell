import TurndownService from 'turndown'

/**
 * Builds a converter from the editor's HTML to Markdown that other tools can read.
 *
 * The editor's own converter (RichTextEditor) only needs to round-trip simple documents in
 * "source mode", so it has no rules for tables, task lists or wikilinks. An export has to
 * handle everything a note can contain.
 *
 * `linkTarget` maps a wikilink's note id to the text that goes between [[ and ]], so links
 * keep resolving after the notes have been written out as files named after their titles.
 */
export function createMarkdownConverter(
  linkTarget: (noteId: string | null, noteTitle: string) => string,
): (html: string) => string {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
  })

  // Tags with no Markdown equivalent stay as inline HTML, which Obsidian and GitHub both render.
  td.keep(['u', 'sub', 'sup'])

  td.addRule('strikethrough', {
    filter: ['del', 's'],
    replacement: c => `~~${c}~~`,
  })

  td.addRule('highlight', {
    filter: node => node.nodeName === 'MARK',
    replacement: c => `==${c}==`,
  })

  td.addRule('wikilink', {
    filter: node => node.nodeName === 'A' && (node as HTMLElement).hasAttribute('data-wikilink'),
    replacement: (_c, node) => {
      const el = node as HTMLElement
      return `[[${linkTarget(el.getAttribute('data-note-id'), el.getAttribute('data-note-title') ?? '')}]]`
    },
  })

  // The task item's checkbox is a <label><input></label> the editor draws itself; the
  // checked state lives on the <li>, so the label would only add noise.
  td.addRule('taskCheckboxLabel', {
    filter: node => node.nodeName === 'LABEL' && node.parentElement?.getAttribute('data-type') === 'taskItem',
    replacement: () => '',
  })

  td.addRule('taskItem', {
    filter: node => node.nodeName === 'LI' && (node as HTMLElement).getAttribute('data-type') === 'taskItem',
    replacement: (content, node) => {
      const checked = (node as HTMLElement).getAttribute('data-checked') === 'true'
      const body = content.replace(/^\n+/, '').replace(/\n+$/, '').replace(/\n/g, '\n    ')
      return `- [${checked ? 'x' : ' '}] ${body}\n`
    },
  })

  // GFM tables. A cell can hold paragraphs, so its content is flattened to one line
  // (<br> for line breaks) and pipes are escaped, otherwise a single cell would break the grid.
  td.addRule('table', {
    filter: 'table',
    replacement: (_c, node) => {
      const rows = Array.from((node as HTMLElement).querySelectorAll('tr'))
      if (rows.length === 0) return ''

      const cellText = (cell: Element) =>
        td.turndown(cell.innerHTML)
          .trim()
          .replace(/\n{2,}/g, '<br><br>')
          .replace(/\n/g, '<br>')
          .replace(/\|/g, '\\|')

      const grid = rows.map(tr => Array.from(tr.children).map(cellText))
      const width = Math.max(...grid.map(r => r.length), 1)
      const pad = (r: string[]) => Array.from({ length: width }, (_, i) => r[i] ?? '')
      const line = (r: string[]) => `| ${pad(r).join(' | ')} |`

      const [head, ...body] = grid
      return `\n\n${[line(head), line(Array(width).fill('---')), ...body.map(line)].join('\n')}\n\n`
    },
  })

  return (html: string) => td.turndown(html).replace(/\n{3,}/g, '\n\n').trim()
}

/** Plain-text notes can hold bare text rather than markup; only convert what is HTML. */
export function looksLikeHtml(content: string): boolean {
  return /<\/?[a-z][a-z0-9]*(\s[^>]*)?>/i.test(content)
}
