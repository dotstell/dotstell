import { Marked, type Tokens, type TokenizerAndRendererExtension } from 'marked'

/**
 * Markdown (as written in Obsidian, Logseq, Bear, Joplin, Notion's export …) to the HTML the
 * editor stores.
 *
 * Imported text is untrusted: a vault zip from the internet can contain `<script>`, event
 * handlers or `javascript:` links, and the editor's HTML is later rendered in several places.
 * So raw HTML is escaped (a short allow-list of formatting tags excepted) and link/image
 * targets are restricted to safe schemes.
 */

export interface RenderContext {
  /** Finds the note a `[[wikilink]]` or relative Markdown link points at. */
  resolveLink(target: string): { id: string; title: string } | null
  /** Returns an `<img src>` value for an image reference, or null when it cannot be imported. */
  resolveImage(src: string): string | null
  /** Called for conditions the user should hear about in the import report. */
  warn(kind: string, detail: string): void
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Inline tags that survive an export/import round trip and carry no attributes. */
const SAFE_INLINE_TAG = /^<\/?(u|sub|sup|mark|br)\s*\/?>$/i

const SAFE_SCHEME = /^(https?|mailto|tel):/i
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i

/** Only web, mail and phone links may keep a scheme; relative links and anchors are fine. */
function isSafeHref(href: string): boolean {
  const h = href.trim().replace(/[\u0000-\u001f\u007f\s]+/g, '')
  return SAFE_SCHEME.test(h) || !ANY_SCHEME.test(h)
}

function isSafeImageSrc(src: string): boolean {
  return /^https?:/i.test(src) || /^data:image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml);base64,/i.test(src)
}

function wikilinkAnchor(id: string, title: string): string {
  return `<a data-wikilink="true" data-note-id="${escapeHtml(id)}" data-note-title="${escapeHtml(title)}">[[${escapeHtml(title)}]]</a>`
}

/** `Note#Heading|Alias` → its parts. Anything after # (heading or ^block) is dropped. */
export function parseWikiTarget(inner: string): { target: string; alias: string | null } {
  const bar = inner.indexOf('|')
  const left = bar === -1 ? inner : inner.slice(0, bar)
  const alias = bar === -1 ? null : inner.slice(bar + 1).trim() || null
  return { target: left.split('#')[0].trim(), alias }
}

const wikilinkExtension = (ctx: RenderContext): TokenizerAndRendererExtension => ({
  name: 'wikilink',
  level: 'inline',
  start: src => src.indexOf('[['),
  tokenizer(src) {
    const m = /^\[\[([^\]\n]+)\]\]/.exec(src)
    if (m) return { type: 'wikilink', raw: m[0], inner: m[1] } as Tokens.Generic
  },
  renderer(token) {
    const { target, alias } = parseWikiTarget(String(token.inner))
    if (!target) return escapeHtml(token.raw)
    const hit = ctx.resolveLink(target)
    if (hit) return wikilinkAnchor(hit.id, hit.title)
    ctx.warn('unresolved-link', target)
    return escapeHtml(alias ? `[[${target}|${alias}]]` : `[[${target}]]`)
  },
})

const embedExtension = (ctx: RenderContext): TokenizerAndRendererExtension => ({
  name: 'embed',
  level: 'inline',
  start: src => src.indexOf('![['),
  tokenizer(src) {
    const m = /^!\[\[([^\]\n]+)\]\]/.exec(src)
    if (m) return { type: 'embed', raw: m[0], inner: m[1] } as Tokens.Generic
  },
  renderer(token) {
    const { target } = parseWikiTarget(String(token.inner).split('|')[0])
    if (!target) return ''
    if (IMAGE_EXT.test(target)) {
      const src = ctx.resolveImage(target)
      return src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(target)}">` : `<em>[image not imported: ${escapeHtml(target)}]</em>`
    }
    const hit = ctx.resolveLink(target)
    if (hit) {
      ctx.warn('embed-as-link', target)
      return wikilinkAnchor(hit.id, hit.title)
    }
    ctx.warn('unsupported-embed', target)
    return `<em>[not imported: ${escapeHtml(target)}]</em>`
  },
})

const highlightExtension: TokenizerAndRendererExtension = {
  name: 'highlight',
  level: 'inline',
  start: src => src.indexOf('=='),
  tokenizer(src) {
    const m = /^==(?!=)([^=\n]+?)==/.exec(src)
    if (m) return { type: 'highlight', raw: m[0], text: m[1], tokens: this.lexer.inlineTokens(m[1]) } as Tokens.Generic
  },
  renderer(token) {
    return `<mark>${this.parser.parseInline(token.tokens ?? [])}</mark>`
  },
}

export function createRenderer(ctx: RenderContext) {
  const marked = new Marked({ gfm: true, breaks: true })

  marked.use({
    extensions: [embedExtension(ctx), wikilinkExtension(ctx), highlightExtension],
    renderer: {
      // Raw HTML is shown as text, apart from a few formatting tags.
      html({ text }) {
        const tag = text.trim()
        return SAFE_INLINE_TAG.test(tag) ? tag : escapeHtml(text)
      },

      link({ href, title, tokens }) {
        const label = this.parser.parseInline(tokens)
        if (!isSafeHref(href)) {
          ctx.warn('unsafe-link', href.slice(0, 60))
          return label
        }
        // A relative link to another note (how Bear, Joplin and Notion write links) becomes a
        // wikilink, so it keeps working inside dotstell.
        if (!ANY_SCHEME.test(href) && !href.startsWith('#')) {
          let decoded = href
          try { decoded = decodeURIComponent(href) } catch { /* keep the raw text */ }
          const hit = ctx.resolveLink(decoded.replace(/\.md$/i, '').split('#')[0])
          if (hit) return wikilinkAnchor(hit.id, hit.title)
          ctx.warn('local-link', href.slice(0, 60))
          return label
        }
        return `<a href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ''}>${label}</a>`
      },

      image({ href, title, text }) {
        const src = /^https?:/i.test(href) || href.startsWith('data:') ? href : ctx.resolveImage(href)
        if (!src || !isSafeImageSrc(src)) {
          ctx.warn('image-skipped', href.slice(0, 60))
          return `<em>[image not imported: ${escapeHtml(text || href.slice(0, 60))}]</em>`
        }
        return `<img src="${escapeHtml(src)}" alt="${escapeHtml(text)}"${title ? ` title="${escapeHtml(title)}"` : ''}>`
      },

      // Task lists use the editor's own structure (see TaskItem), not <input> elements.
      checkbox: () => '',
      list(token) {
        const anyTask = !token.ordered && token.items.some(i => i.task)
        if (anyTask) for (const item of token.items) { item.task = true; item.checked = !!item.checked }
        const body = token.items.map(item => this.listitem(item)).join('')
        const tag = token.ordered ? 'ol' : 'ul'
        const start = token.ordered && token.start !== 1 ? ` start="${token.start}"` : ''
        return `<${tag}${anyTask ? ' data-type="taskList"' : ''}${start}>\n${body}</${tag}>\n`
      },
      listitem(item) {
        let body = this.parser.parse(item.tokens).trim()
        if (!item.task) return `<li>${body}</li>\n`
        if (!/^<(p|ul|ol|pre|blockquote|h[1-6])[\s>]/i.test(body)) body = `<p>${body}</p>`
        return `<li data-type="taskItem" data-checked="${item.checked ? 'true' : 'false'}"><label><input type="checkbox"${item.checked ? ' checked' : ''}><span></span></label><div>${body}</div></li>\n`
      },
    },
  })

  return marked
}

/**
 * Syntax that is specific to Obsidian and has no HTML equivalent, rewritten before parsing:
 * comments are dropped, callouts become quotes, and block ids are removed.
 */
export function preprocessObsidian(md: string): string {
  return md
    .replace(/%%[\s\S]*?%%/g, '')
    .replace(/^(\s*>+\s*)\[!([\w-]+)\][+-]?[ \t]*(.*)$/gm, (_m, prefix: string, type: string, title: string) =>
      `${prefix}**${title.trim() || type[0].toUpperCase() + type.slice(1)}**`)
    .replace(/[ \t]+\^[A-Za-z0-9-]+[ \t]*$/gm, '')
}

/** Inline `#tags`, ignoring code, URLs and headings. Must contain a letter, so `#123` is not a tag. */
export function extractInlineTags(md: string): string[] {
  const text = md
    .replace(/^(```|~~~)[\s\S]*?^\1[^\n]*$/gm, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/\bhttps?:\/\/\S+/g, ' ')
  const tags = new Set<string>()
  for (const m of text.matchAll(/(?:^|[\s(])#([\p{L}\p{N}_/-]*\p{L}[\p{L}\p{N}_/-]*)/gu)) tags.add(m[1])
  return [...tags]
}

export function renderMarkdown(md: string, ctx: RenderContext): string {
  return (createRenderer(ctx).parse(preprocessObsidian(md)) as string).trim()
}
