// Turns untrusted HTML into safe HTML by REBUILDING it from an allow-list, instead of deleting
// known-bad things from it. A deny-list always misses something (" javascript:" with a leading
// space, "java&#9;script:", <svg>, <math>, <base>, <style>...), so here nothing survives unless it is
// listed: unknown elements are unwrapped, unknown attributes dropped, and every address is checked.

export type SanitizeProfile = 'markdown' | 'document'

const COMMON = new Set([
  'p', 'br', 'hr', 'div', 'span', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins', 'mark', 'sub', 'sup', 'small',
  'code', 'pre', 'kbd', 'samp', 'blockquote', 'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'input', 'label',
])
const DOCUMENT_ONLY = new Set(['img', 'figure', 'figcaption', 'colgroup', 'col'])

// Removed together with everything inside them.
const DROP = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'svg', 'math', 'template', 'noscript',
  'head', 'title', 'meta', 'link', 'base', 'textarea', 'select', 'option', 'audio', 'video', 'source', 'track', 'canvas', 'dialog',
])

const STYLE_PROPERTIES = new Set([
  'color', 'background-color', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-align', 'text-decoration', 'line-height',
])
const SAFE_STYLE_VALUE = /^[\w\s#%.,'"()/+-]{1,200}$/
const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|gif|webp|bmp|avif);base64,[a-z0-9+/=\s]+$/i
const MAX_DEPTH = 200

// Browsers ignore spaces, tabs, newlines and control characters inside a URL, so the check has to as well.
// eslint-disable-next-line no-control-regex
const strip = (value: string) => value.replace(/[\u0000- \u007f]/g, '')

/** The cleaned address, or null when it is not one we are willing to link to. */
function safeLink(value: string): string | null {
  const url = strip(value)
  if (!url) return null
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1].toLowerCase()
  if (!scheme) return url.startsWith('//') ? null : url // relative address or #anchor
  return scheme === 'http' || scheme === 'https' || scheme === 'mailto' || scheme === 'tel' ? url : null
}

function safeImage(value: string): string | null {
  const url = strip(value)
  if (/^https?:\/\//i.test(url)) return url
  return IMAGE_DATA_URL.test(url) ? url : null
}

function safeStyle(value: string): string | null {
  const kept: string[] = []
  for (const declaration of value.split(';').slice(0, 20)) {
    const colon = declaration.indexOf(':')
    if (colon === -1) continue
    const property = declaration.slice(0, colon).trim().toLowerCase()
    const v = declaration.slice(colon + 1).trim()
    if (STYLE_PROPERTIES.has(property) && SAFE_STYLE_VALUE.test(v) && !/url\(|expression|javascript|@import/i.test(v)) kept.push(`${property}: ${v}`)
  }
  return kept.length ? kept.join('; ') : null
}

function copyAttributes(from: Element, to: Element, tag: string, profile: SanitizeProfile) {
  for (const { name, value } of Array.from(from.attributes)) {
    const attr = name.toLowerCase()
    if (tag === 'a' && attr === 'href') {
      const href = safeLink(value)
      if (href) {
        to.setAttribute('href', href)
        if (/^https?:/i.test(href)) { to.setAttribute('target', '_blank'); to.setAttribute('rel', 'noopener noreferrer') }
      }
    } else if (tag === 'a' && attr === 'title') to.setAttribute('title', value.slice(0, 300))
    else if (tag === 'img' && attr === 'src' && profile === 'document') {
      const src = safeImage(value)
      if (src) to.setAttribute('src', src)
    } else if (tag === 'img' && (attr === 'alt' || attr === 'title')) to.setAttribute(attr, value.slice(0, 300))
    else if (tag === 'input') {
      if (attr === 'type' && value.toLowerCase() === 'checkbox') to.setAttribute('type', 'checkbox')
      else if (attr === 'checked') to.setAttribute('checked', '')
      to.setAttribute('disabled', '')
    } else if (tag === 'code' && attr === 'class' && /^language-[\w-]{1,30}$/.test(value)) to.setAttribute('class', value)
    else if (tag === 'ol' && attr === 'start' && /^\d{1,6}$/.test(value)) to.setAttribute('start', value)
    else if ((tag === 'td' || tag === 'th') && (attr === 'colspan' || attr === 'rowspan') && /^\d{1,3}$/.test(value)) to.setAttribute(attr, value)
    else if (attr === 'style' && profile === 'document') {
      const style = safeStyle(value)
      if (style) to.setAttribute('style', style)
    }
  }
}

function copyChildren(from: Node, into: Node, out: Document, profile: SanitizeProfile, depth: number) {
  for (const child of Array.from(from.childNodes)) {
    if (child.nodeType === 3) { // text
      into.appendChild(out.createTextNode(child.textContent ?? ''))
      continue
    }
    if (child.nodeType !== 1) continue // comments, processing instructions and the rest are dropped

    const el = child as Element
    const tag = el.tagName.toLowerCase()
    if (DROP.has(tag)) continue
    if (depth > MAX_DEPTH) { into.appendChild(out.createTextNode(el.textContent ?? '')); continue }

    if (COMMON.has(tag) || (profile === 'document' && DOCUMENT_ONLY.has(tag))) {
      if (tag === 'img' && profile === 'document' && !safeImage(el.getAttribute('src') ?? '')) continue
      const clean = out.createElement(tag)
      copyAttributes(el, clean, tag, profile)
      copyChildren(el, clean, out, profile, depth + 1)
      into.appendChild(clean)
    } else {
      // Unknown or unwanted element (button, font, section ...): keep its content, lose the element.
      copyChildren(el, into, out, profile, depth + 1)
    }
  }
}

export function sanitizeHtml(html: string, profile: SanitizeProfile = 'markdown'): string {
  const source = new DOMParser().parseFromString(html, 'text/html')
  const out = document.implementation.createHTMLDocument('')
  copyChildren(source.body, out.body, out, profile, 0)
  return out.body.innerHTML
}
