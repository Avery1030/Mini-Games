const ALLOWED = new Set(['P', 'H1', 'H2', 'H3', 'DIV', 'BR', 'B', 'I', 'U', 'STRONG', 'EM', 'UL', 'OL', 'LI', 'FONT', 'SPAN'])

function isSafeColor(value: string): boolean {
  return /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|[a-zA-Z]+)$/.test(value.trim())
}

function sanitizeElement(node: Node, out: Document): Nullable<Node> {
  if (node.nodeType === Node.TEXT_NODE) {
    return out.createTextNode(node.textContent ?? '')
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null
  const el = node as HTMLElement
  const tag = el.tagName.toUpperCase()
  if (!ALLOWED.has(tag)) {
    const frag = out.createDocumentFragment()
    for (const child of Array.from(el.childNodes)) {
      const next = sanitizeElement(child, out)
      if (next) frag.appendChild(next)
    }
    return frag
  }
  const copy = out.createElement(tag.toLowerCase())
  if (tag === 'FONT') {
    const color = el.getAttribute('color')
    if (color && isSafeColor(color)) copy.setAttribute('color', color)
  }
  if (tag === 'SPAN') {
    const color = el.style.color
    if (color && isSafeColor(color)) copy.style.color = color
  }
  for (const child of Array.from(el.childNodes)) {
    const next = sanitizeElement(child, out)
    if (next) copy.appendChild(next)
  }
  return copy
}

/** 只保留 Writer 用得到的标签，去掉脚本与多余属性 */
export function sanitizeWriterHtml(html: string): string {
  if (typeof DOMParser === 'undefined') return '<p></p>'
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild
  if (!root) return '<p></p>'
  const out = document.implementation.createHTMLDocument('')
  const wrap = out.createElement('div')
  for (const child of Array.from(root.childNodes)) {
    const next = sanitizeElement(child, out)
    if (next) wrap.appendChild(next)
  }
  const result = wrap.innerHTML.trim()
  return result || '<p></p>'
}

export function htmlToPlainText(html: string): string {
  if (typeof DOMParser === 'undefined') return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\u00a0/g, ' ').trim()
}
