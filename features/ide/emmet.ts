import type { IdeLanguage } from './languages'

const INDENT = '    '

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
])

const HTML_TAGS = new Set([
  'a',
  'abbr',
  'address',
  'article',
  'aside',
  'audio',
  'b',
  'blockquote',
  'body',
  'br',
  'button',
  'canvas',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'datalist',
  'dd',
  'details',
  'dfn',
  'dialog',
  'div',
  'dl',
  'dt',
  'em',
  'embed',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hr',
  'html',
  'i',
  'iframe',
  'img',
  'input',
  'ins',
  'kbd',
  'label',
  'legend',
  'li',
  'link',
  'main',
  'map',
  'mark',
  'meta',
  'meter',
  'nav',
  'noscript',
  'object',
  'ol',
  'optgroup',
  'option',
  'output',
  'p',
  'picture',
  'pre',
  'progress',
  'q',
  's',
  'samp',
  'script',
  'section',
  'select',
  'small',
  'source',
  'span',
  'strong',
  'style',
  'sub',
  'summary',
  'sup',
  'svg',
  'table',
  'tbody',
  'td',
  'template',
  'textarea',
  'tfoot',
  'th',
  'thead',
  'time',
  'title',
  'tr',
  'track',
  'u',
  'ul',
  'var',
  'video',
  'wbr',
])

const CSS_SNIPPETS: Record<string, string> = {
  db: 'display: block;',
  dib: 'display: inline-block;',
  di: 'display: inline;',
  df: 'display: flex;',
  dif: 'display: inline-flex;',
  dg: 'display: grid;',
  dn: 'display: none;',
  m0a: 'margin: 0 auto;',
  tac: 'text-align: center;',
  tar: 'text-align: right;',
  tal: 'text-align: left;',
  taj: 'text-align: justify;',
  fwb: 'font-weight: bold;',
  fwn: 'font-weight: normal;',
  tdu: 'text-decoration: underline;',
  tdn: 'text-decoration: none;',
  tdl: 'text-decoration: line-through;',
  posa: 'position: absolute;',
  posr: 'position: relative;',
  posf: 'position: fixed;',
  poss: 'position: sticky;',
  posst: 'position: static;',
  ovh: 'overflow: hidden;',
  ova: 'overflow: auto;',
  ovs: 'overflow: scroll;',
  ovv: 'overflow: visible;',
  bxz: 'box-sizing: border-box;',
  bxsc: 'box-sizing: content-box;',
  fx: 'display: flex;',
  fxd: 'flex-direction: column;',
  fxdr: 'flex-direction: row;',
  jc: 'justify-content: center;',
  jcsb: 'justify-content: space-between;',
  aic: 'align-items: center;',
  aifs: 'align-items: flex-start;',
  aife: 'align-items: flex-end;',
  cup: 'cursor: pointer;',
  usn: 'user-select: none;',
  wsn: 'white-space: nowrap;',
  to: 'text-overflow: ellipsis;\noverflow: hidden;\nwhite-space: nowrap;',
}

const CSS_PROP: Record<string, string> = {
  m: 'margin',
  mt: 'margin-top',
  mr: 'margin-right',
  mb: 'margin-bottom',
  ml: 'margin-left',
  p: 'padding',
  pt: 'padding-top',
  pr: 'padding-right',
  pb: 'padding-bottom',
  pl: 'padding-left',
  w: 'width',
  h: 'height',
  t: 'top',
  r: 'right',
  b: 'bottom',
  l: 'left',
  fz: 'font-size',
  lh: 'line-height',
  mw: 'min-width',
  mh: 'min-height',
  maw: 'max-width',
  mah: 'max-height',
  bg: 'background',
  c: 'color',
  bd: 'border',
  bdrs: 'border-radius',
  op: 'opacity',
  z: 'z-index',
  fl: 'float',
  fs: 'font-size',
  fw: 'font-weight',
  ta: 'text-align',
}

const UNITLESS = new Set(['z-index', 'opacity', 'flex', 'font-weight', 'line-height', 'order'])

export type EmmetSyntax = 'markup' | 'stylesheet'

export type EmmetSuggestion = {
  abbreviation: string
  preview: string
  expanded: string
  start: number
  end: number
  caret: number
  syntax: EmmetSyntax
}

type EmmetNode = {
  tag: string
  id: string
  classes: string[]
  attrs: [string, string][]
  text: string
  repeat: number
  children: EmmetNode[]
}

const ABBR_CHAR = /[A-Za-z0-9_.:#!@#$%*\-+>[\](){}^$=]/

function isIdentStart(ch: string): boolean {
  return /[A-Za-z_]/.test(ch)
}

function isIdent(ch: string): boolean {
  return /[A-Za-z0-9_:$%-]/.test(ch)
}

class Parser {
  readonly s: string
  i = 0

  constructor(s: string) {
    this.s = s
  }

  peek(): string {
    return this.s[this.i] ?? ''
  }

  eat(ch: string): boolean {
    if (this.peek() === ch) {
      this.i += 1
      return true
    }
    return false
  }

  ident(): string {
    const start = this.i
    if (!isIdentStart(this.peek()) && this.peek() !== '-') return ''
    this.i += 1
    while (isIdent(this.peek())) this.i += 1
    return this.s.slice(start, this.i)
  }

  number(): number {
    const start = this.i
    while (/\d/.test(this.peek())) this.i += 1
    return Number(this.s.slice(start, this.i) || '1')
  }

  balanced(open: string, close: string): string {
    if (!this.eat(open)) return ''
    let depth = 1
    const start = this.i
    while (this.i < this.s.length && depth > 0) {
      const ch = this.s[this.i]!
      if (ch === open) depth += 1
      else if (ch === close) depth -= 1
      this.i += 1
    }
    return this.s.slice(start, this.i - (depth === 0 ? 1 : 0))
  }

  parseElement(): EmmetNode {
    const tag = this.ident()
    const node: EmmetNode = {
      tag: tag || 'div',
      id: '',
      classes: [],
      attrs: [],
      text: '',
      repeat: 1,
      children: [],
    }
    for (;;) {
      if (this.eat('#')) {
        node.id = this.ident()
        continue
      }
      if (this.eat('.')) {
        const cls = this.ident()
        if (cls) node.classes.push(cls)
        continue
      }
      if (this.peek() === '[') {
        this.parseAttrs(node)
        continue
      }
      if (this.peek() === '{') {
        node.text = this.balanced('{', '}')
        continue
      }
      if (this.eat('*')) {
        node.repeat = this.number()
        continue
      }
      break
    }
    if (!tag && !node.id && node.classes.length === 0 && !node.text && node.attrs.length === 0) {
      throw new Error('empty')
    }
    return node
  }

  parseAttrs(node: EmmetNode) {
    const raw = this.balanced('[', ']')
    const re = /([^\s=\]]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+)))?/g
    let m: RegExpExecArray | null
    while ((m = re.exec(raw))) {
      node.attrs.push([m[1]!, m[2] ?? m[3] ?? m[4] ?? ''])
    }
  }

  parseList(stop: string): EmmetNode[] {
    const roots: EmmetNode[] = []
    type Ctx = { siblings: EmmetNode[]; parent: EmmetNode | null }
    const stack: Ctx[] = []
    let ctx: Ctx = { siblings: roots, parent: null }
    let current: EmmetNode | null = null

    const add = (node: EmmetNode) => {
      ctx.siblings.push(node)
      current = node
    }

    while (this.i < this.s.length) {
      const ch = this.peek()
      if (ch === stop || ch === '') break
      if (ch === ')') break
      if (ch === '>') {
        if (!current) throw new Error('>')
        stack.push(ctx)
        ctx = { siblings: current.children, parent: current }
        this.i += 1
        continue
      }
      if (ch === '+') {
        this.i += 1
        continue
      }
      if (ch === '^') {
        this.i += 1
        if (stack.length > 0) {
          ctx = stack.pop()!
          current = ctx.parent
        }
        continue
      }
      if (ch === '(') {
        this.i += 1
        const inner = this.parseList(')')
        if (this.peek() === ')') this.i += 1
        let repeat = 1
        if (this.eat('*')) repeat = this.number()
        for (let n = 0; n < repeat; n++) {
          for (const child of inner) add(cloneNode(child))
        }
        continue
      }
      add(this.parseElement())
    }
    return roots
  }
}

function cloneNode(node: EmmetNode): EmmetNode {
  return {
    ...node,
    classes: [...node.classes],
    attrs: node.attrs.map(([k, v]) => [k, v]),
    children: node.children.map(cloneNode),
  }
}

function applyNum(s: string, n: number): string {
  return s.replace(/(\$+)/g, (m) => String(n).padStart(m.length, '0'))
}

function numbered(node: EmmetNode, n: number): EmmetNode {
  return {
    tag: applyNum(node.tag, n),
    id: applyNum(node.id, n),
    classes: node.classes.map((c) => applyNum(c, n)),
    attrs: node.attrs.map(([k, v]) => [applyNum(k, n), applyNum(v, n)]),
    text: applyNum(node.text, n),
    repeat: 1,
    children: node.children.map((c) => numbered(c, n)),
  }
}

const DEFAULT_ATTRS: Record<string, [string, string][]> = {
  a: [['href', '']],
  img: [['src', ''], ['alt', '']],
  link: [['rel', 'stylesheet'], ['href', '']],
  iframe: [['src', '']],
  input: [['type', 'text']],
}

function attrString(node: EmmetNode): string {
  const parts: string[] = []
  if (node.id) parts.push(`id="${node.id}"`)
  if (node.classes.length > 0) parts.push(`class="${node.classes.join(' ')}"`)
  const seen = new Set(node.attrs.map(([k]) => k.toLowerCase()))
  if (node.id) seen.add('id')
  if (node.classes.length > 0) seen.add('class')
  for (const [k, v] of DEFAULT_ATTRS[node.tag] ?? []) {
    if (!seen.has(k)) parts.push(`${k}="${v}"`)
  }
  for (const [k, v] of node.attrs) {
    parts.push(v === '' ? k : `${k}="${v}"`)
  }
  return parts.length ? ` ${parts.join(' ')}` : ''
}

function renderNodes(nodes: EmmetNode[]): { expanded: string; caret: number } {
  const out: string[] = []
  let caret = -1
  let offset = 0

  const write = (chunk: string, markCaret = false) => {
    if (markCaret && caret < 0) caret = offset
    out.push(chunk)
    offset += chunk.length
  }

  const render = (node: EmmetNode, depth: number) => {
    const pad = INDENT.repeat(depth)
    const copies = Math.max(1, node.repeat)
    for (let n = 1; n <= copies; n++) {
      const cur = copies > 1 ? numbered(node, n) : node
      const tag = cur.tag || 'div'
      const voidTag = VOID_TAGS.has(tag.toLowerCase())
      const attrs = attrString(cur)
      if (out.length > 0) write('\n')
      if (voidTag) {
        write(`${pad}<${tag}${attrs}>`)
        continue
      }
      if (cur.children.length === 0 && !cur.text) {
        write(`${pad}<${tag}${attrs}>`)
        write('', true)
        write(`</${tag}>`)
        continue
      }
      if (cur.children.length === 0) {
        write(`${pad}<${tag}${attrs}>${cur.text}</${tag}>`)
        continue
      }
      write(`${pad}<${tag}${attrs}>`)
      for (const child of cur.children) render(child, depth + 1)
      write(`\n${pad}</${tag}>`)
    }
  }

  for (const node of nodes) render(node, 0)
  const expanded = out.join('')
  return { expanded, caret: caret < 0 ? expanded.length : caret }
}

const HTML5 = `<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document</title>
    </head>
    <body>
        |
    </body>
</html>`

function expandMarkup(abbr: string): { expanded: string; caret: number } | null {
  const trimmed = abbr.trim()
  if (trimmed === '!' || trimmed === '!!!') {
    const caret = HTML5.indexOf('|')
    return { expanded: HTML5.replace('|', ''), caret }
  }
  try {
    const nodes = new Parser(trimmed).parseList('')
    if (nodes.length === 0) return null
    return renderNodes(nodes)
  } catch {
    return null
  }
}

function cssValue(raw: string, prop: string): string {
  if (!raw) return '0'
  if (raw.endsWith('p') && /^-?\d/.test(raw)) return `${raw.slice(0, -1)}%`
  if (/^-?\d+\.?\d*(px|em|rem|vh|vw|vmin|vmax|ch|%|s|ms|deg)$/.test(raw)) return raw
  if (/^-?\d+\.?\d*$/.test(raw)) {
    if (UNITLESS.has(prop) || raw === '0') return raw
    return `${raw}px`
  }
  if (raw.startsWith('#')) return raw
  return raw
}

function expandCss(abbr: string): string | null {
  const key = abbr.trim()
  if (CSS_SNIPPETS[key]) return CSS_SNIPPETS[key]
  const m = key.match(/^([a-z]+)(.*)$/i)
  if (!m) return null
  const prop = CSS_PROP[m[1]!.toLowerCase()]
  if (!prop) return null
  const rest = m[2] ?? ''
  if (!rest) return `${prop}: ;`
  const values = splitCssValues(rest).map((v) => cssValue(v, prop))
  return `${prop}: ${values.join(' ')};`
}

function splitCssValues(rest: string): string[] {
  if (rest.startsWith('#')) return [rest]
  if (rest.startsWith('-')) {
    const parts = rest.slice(1).split('-')
    parts[0] = `-${parts[0]}`
    return parts
  }
  return rest.split('-')
}

function likelyMarkup(abbr: string): boolean {
  if (abbr === '!' || abbr === '!!!') return true
  if (/[.#>+*^\[\]{@$!]/.test(abbr)) return true
  const name = abbr.split(/[.#*[{\]]/)[0]?.toLowerCase() ?? ''
  if (HTML_TAGS.has(name)) return true
  return name.includes('-') && /^[a-z][\w:-]*$/i.test(name)
}

function isHtmlTagClose(text: string, gtIndex: number, lineStart: number): boolean {
  for (let j = gtIndex - 1; j >= lineStart; j--) {
    const ch = text[j]!
    if (ch === '<') return true
    if (ch === '>') return false
  }
  return false
}

function applyIndentToExpanded(expanded: string, caretIn: number, indent: string): { expanded: string; caretIn: number } {
  if (!indent || !expanded.includes('\n')) return { expanded, caretIn }
  const lines = expanded.split('\n')
  let oldPos = 0
  let newPos = 0
  let newCaret = caretIn
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const prefix = i === 0 ? '' : indent
    if (caretIn >= oldPos && caretIn <= oldPos + line.length) {
      newCaret = newPos + prefix.length + (caretIn - oldPos)
    }
    out.push(prefix + line)
    oldPos += line.length + 1
    newPos += prefix.length + line.length + 1
  }
  return { expanded: out.join('\n'), caretIn: newCaret }
}

export function emmetSyntaxAt(text: string, caret: number, language: IdeLanguage): EmmetSyntax | null {
  if (language === 'css') return 'stylesheet'
  if (language !== 'markup' && language !== 'plain') return null
  const before = text.slice(0, caret).toLowerCase()
  const scriptOpen = before.lastIndexOf('<script')
  const scriptClose = before.lastIndexOf('</script')
  if (scriptOpen > scriptClose) return null
  const styleOpen = before.lastIndexOf('<style')
  const styleClose = before.lastIndexOf('</style')
  if (styleOpen > styleClose) return 'stylesheet'
  return 'markup'
}

export function extractEmmetAbbr(
  text: string,
  caret: number,
  syntax: EmmetSyntax,
): { abbreviation: string; start: number; end: number } | null {
  const lineStart = text.lastIndexOf('\n', caret - 1) + 1
  let i = caret - 1
  while (i >= lineStart) {
    const ch = text[i]!
    if (ch === '<' || /\s/.test(ch)) break
    if (ch === '>' && isHtmlTagClose(text, i, lineStart)) break
    if (!ABBR_CHAR.test(ch)) break
    i -= 1
  }
  const start = i + 1
  if (start >= caret) return null
  const abbreviation = text.slice(start, caret)
  if (/^[>+^]/.test(abbreviation) || /[>+^]$/.test(abbreviation)) return null
  if (syntax === 'markup' && !likelyMarkup(abbreviation)) return null
  if (syntax === 'stylesheet' && !/^[a-z][a-z0-9-:%#.]*$/i.test(abbreviation)) return null
  return { abbreviation, start, end: caret }
}

export function suggestEmmet(text: string, caret: number, language: IdeLanguage): EmmetSuggestion | null {
  const syntax = emmetSyntaxAt(text, caret, language)
  if (!syntax) return null
  const extracted = extractEmmetAbbr(text, caret, syntax)
  if (!extracted) return null
  let expanded = ''
  let caretIn = extracted.abbreviation.length
  if (syntax === 'markup') {
    const result = expandMarkup(extracted.abbreviation)
    if (!result) return null
    expanded = result.expanded
    caretIn = result.caret
  } else {
    const css = expandCss(extracted.abbreviation)
    if (!css) return null
    expanded = css
    const empty = /: ;$/.test(css)
    caretIn = empty ? css.length - 1 : css.length
  }
  if (!expanded || expanded === extracted.abbreviation) return null
  const lineStart = text.lastIndexOf('\n', extracted.start - 1) + 1
  const indent = text.slice(lineStart).match(/^[ \t]*/)?.[0] ?? ''
  const indented = applyIndentToExpanded(expanded, caretIn, indent)
  return {
    abbreviation: extracted.abbreviation,
    preview: indented.expanded,
    expanded: indented.expanded,
    start: extracted.start,
    end: extracted.end,
    caret: extracted.start + indented.caretIn,
    syntax,
  }
}
