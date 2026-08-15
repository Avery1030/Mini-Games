import type { IdeLanguage } from './languages'

const INDENT = '    '

export type FormatResult = { ok: true; text: string } | { ok: false; text: string; error: string }

type ScanMode = 'code' | 'sq' | 'dq' | 'bt' | 'line' | 'block'

type BraceKind = 'js' | 'css'

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

function finish(text: string): string {
  const trimmed = text.replace(/[ \t]+$/gm, '').replace(/\n+$/g, '')
  return trimmed.length === 0 ? '' : `${trimmed}\n`
}

function formatJson(text: string): FormatResult {
  try {
    const parsed: unknown = JSON.parse(text)
    return { ok: true, text: finish(JSON.stringify(parsed, null, 4)) }
  } catch (err) {
    return { ok: false, text, error: err instanceof Error ? err.message : 'JSON' }
  }
}

function formatPlain(text: string): FormatResult {
  return { ok: true, text: finish(normalizeNewlines(text)) }
}

function isOpen(ch: string): boolean {
  return ch === '{' || ch === '[' || ch === '('
}

function isClose(ch: string): boolean {
  return ch === '}' || ch === ']' || ch === ')'
}

function scanBraceLine(
  line: string,
  mode: ScanMode,
  kind: BraceKind,
): { prefixCloses: number; opens: number; mode: ScanMode } {
  let prefixCloses = 0
  let opens = 0
  let i = 0

  const acceptOpen = (ch: string) => (kind === 'css' ? ch === '{' : isOpen(ch))
  const acceptClose = (ch: string) => (kind === 'css' ? ch === '}' : isClose(ch))

  while (i < line.length) {
    const ch = line[i]!
    const next = line[i + 1]

    if (mode === 'line') break
    if (mode === 'block') {
      if (ch === '*' && next === '/') {
        mode = 'code'
        i += 2
        continue
      }
      i += 1
      continue
    }
    if (mode === 'sq' || mode === 'dq' || mode === 'bt') {
      if (ch === '\\') {
        i += 2
        continue
      }
      if (mode === 'sq' && ch === "'") mode = 'code'
      else if (mode === 'dq' && ch === '"') mode = 'code'
      else if (mode === 'bt' && ch === '`') mode = 'code'
      i += 1
      continue
    }

    if (ch === '/' && next === '/') {
      mode = 'line'
      break
    }
    if (ch === '/' && next === '*') {
      mode = 'block'
      i += 2
      continue
    }
    if (ch === "'") {
      mode = 'sq'
      i += 1
      continue
    }
    if (ch === '"') {
      mode = 'dq'
      i += 1
      continue
    }
    if (kind === 'js' && ch === '`') {
      mode = 'bt'
      i += 1
      continue
    }

    if (acceptClose(ch)) {
      if (opens > 0) opens -= 1
      else prefixCloses += 1
      i += 1
      continue
    }
    if (acceptOpen(ch)) {
      opens += 1
      i += 1
      continue
    }
    i += 1
  }

  if (mode === 'line') mode = 'code'
  return { prefixCloses, opens, mode }
}

function formatBraces(text: string, kind: BraceKind): FormatResult {
  const lines = normalizeNewlines(text).split('\n')
  const out: string[] = []
  let indent = 0
  let mode: ScanMode = 'code'

  for (const raw of lines) {
    const trimmed = raw.trim()
    if (trimmed.length === 0) {
      out.push('')
      continue
    }
    const scanned = scanBraceLine(trimmed, mode, kind)
    mode = scanned.mode
    indent = Math.max(0, indent - scanned.prefixCloses)
    out.push(`${INDENT.repeat(indent)}${trimmed}`)
    indent = Math.max(0, indent + scanned.opens)
  }

  return { ok: true, text: finish(out.join('\n')) }
}

/** `div:hover {` 不加空格；`color:red` / `margin:0` 加空格 */
function shouldSpaceAfterColon(src: string, colonIndex: number): boolean {
  if (src[colonIndex + 1] === ':') return false
  let j = colonIndex + 1
  while (j < src.length && (src[j] === ' ' || src[j] === '\t' || src[j] === '\n' || src[j] === '\r')) j += 1
  const ch = src[j]
  if (!ch || ch === '{') return false
  if (/[\d#"']/.test(ch)) return true
  while (j < src.length && /[a-zA-Z0-9_-]/.test(src[j]!)) j += 1
  while (j < src.length && (src[j] === ' ' || src[j] === '\t' || src[j] === '\n' || src[j] === '\r')) j += 1
  const after = src[j]
  if (after === '{' || after === ',') return false
  return true
}

function formatCss(text: string): FormatResult {
  const src = normalizeNewlines(text)
  const out: string[] = []
  let line = ''
  let indent = 0
  let paren = 0
  let mode: ScanMode = 'code'
  let i = 0

  const pushLine = () => {
    out.push(line.replace(/[ \t]+$/g, ''))
    line = ''
  }

  const atLineStart = () => line.trim().length === 0

  const ensureIndent = () => {
    if (atLineStart()) line = INDENT.repeat(indent)
  }

  const spaceBefore = () => {
    if (atLineStart()) return
    if (!line.endsWith(' ') && !line.endsWith('(')) line += ' '
  }

  while (i < src.length) {
    const ch = src[i]!
    const next = src[i + 1]

    if (mode === 'block') {
      ensureIndent()
      line += ch
      if (ch === '*' && next === '/') {
        line += '/'
        i += 2
        mode = 'code'
        continue
      }
      i += 1
      continue
    }

    if (mode === 'sq' || mode === 'dq') {
      line += ch
      if (ch === '\\' && next) {
        line += next
        i += 2
        continue
      }
      if ((mode === 'sq' && ch === "'") || (mode === 'dq' && ch === '"')) mode = 'code'
      i += 1
      continue
    }

    if (ch === '/' && next === '*') {
      ensureIndent()
      spaceBefore()
      mode = 'block'
      line += '/*'
      i += 2
      continue
    }

    if (ch === "'" || ch === '"') {
      ensureIndent()
      mode = ch === "'" ? 'sq' : 'dq'
      line += ch
      i += 1
      continue
    }

    if (ch === '\n') {
      if (line.trim().length > 0) pushLine()
      i += 1
      continue
    }

    if (ch === ' ' || ch === '\t') {
      if (!atLineStart()) spaceBefore()
      i += 1
      continue
    }

    if (ch === '{') {
      ensureIndent()
      spaceBefore()
      line += '{'
      pushLine()
      indent += 1
      i += 1
      continue
    }

    if (ch === '}') {
      if (line.trim().length > 0) pushLine()
      indent = Math.max(0, indent - 1)
      ensureIndent()
      line += '}'
      pushLine()
      let j = i + 1
      while (j < src.length && (src[j] === ' ' || src[j] === '\t' || src[j] === '\n' || src[j] === '\r')) j += 1
      if (j < src.length && src[j] !== '}') out.push('')
      i += 1
      continue
    }

    if (ch === ';') {
      ensureIndent()
      line += ';'
      if (paren === 0) pushLine()
      i += 1
      continue
    }

    if (ch === '(') {
      ensureIndent()
      line += '('
      paren += 1
      i += 1
      continue
    }

    if (ch === ')') {
      line += ')'
      paren = Math.max(0, paren - 1)
      i += 1
      continue
    }

    if (ch === ':') {
      ensureIndent()
      line += ':'
      if (shouldSpaceAfterColon(src, i)) {
        if (next !== ' ' && next !== '\n' && next !== '\t') line += ' '
      }
      i += 1
      continue
    }

    if (ch === ',') {
      ensureIndent()
      line += ','
      if (next !== ' ' && next !== '\n') line += ' '
      i += 1
      continue
    }

    ensureIndent()
    line += ch
    i += 1
  }

  if (line.trim().length > 0) pushLine()
  return { ok: true, text: finish(out.join('\n')) }
}

function prefixBlock(text: string, base: number): string[] {
  const pad = INDENT.repeat(base)
  const body = text.replace(/\n+$/g, '')
  if (body.length === 0) return []
  return body.split('\n').map((line) => (line.trim().length === 0 ? '' : `${pad}${line}`))
}

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

type EmbedKind = 'css' | 'js'

function matchOpenEmbed(line: string): { kind: EmbedKind; open: string; rest: string } | null {
  const m = line.match(/^<(style|script)\b([^>]*)>(.*)$/i)
  if (!m) return null
  const kind: EmbedKind = m[1]!.toLowerCase() === 'style' ? 'css' : 'js'
  return { kind, open: `<${m[1]}${m[2]}>`, rest: m[3] ?? '' }
}

function matchCloseEmbed(line: string, kind: EmbedKind): { before: string; close: string } | null {
  const name = kind === 'css' ? 'style' : 'script'
  const m = line.match(new RegExp(`^(.*?)(</${name}\\s*>)$`, 'i'))
  if (!m) return null
  return { before: m[1] ?? '', close: m[2]! }
}

function formatEmbedBody(kind: EmbedKind, body: string): string {
  if (body.trim().length === 0) return ''
  const result = kind === 'css' ? formatCss(body) : formatBraces(body, 'js')
  return result.ok ? result.text : body
}

function formatMarkup(text: string): FormatResult {
  const lines = normalizeNewlines(text).split('\n')
  const out: string[] = []
  let indent = 0
  let embed: { kind: EmbedKind; base: number; buf: string[] } | null = null

  const flushEmbed = () => {
    if (!embed) return
    out.push(...prefixBlock(formatEmbedBody(embed.kind, embed.buf.join('\n')), embed.base))
    embed = null
  }

  const applyHtmlLine = (trimmed: string) => {
    const tokens = [...trimmed.matchAll(/<\/?([a-zA-Z][\w:-]*)[^>]*>/g)]
    let prefixCloses = 0
    let opens = 0

    for (const token of tokens) {
      const full = token[0]
      const name = token[1]!.toLowerCase()
      if (full.startsWith('<!--') || name === '!doctype' || name.startsWith('!')) continue
      const closing = full.startsWith('</')
      const selfClose = /\/\s*>$/.test(full) || VOID_TAGS.has(name)
      if (closing) {
        if (opens > 0) opens -= 1
        else prefixCloses += 1
      } else if (!selfClose) {
        opens += 1
      }
    }

    indent = Math.max(0, indent - prefixCloses)
    out.push(`${INDENT.repeat(indent)}${trimmed}`)
    indent = Math.max(0, indent + opens)
  }

  for (const raw of lines) {
    const trimmed = raw.trim()

    if (embed) {
      const close = matchCloseEmbed(trimmed, embed.kind)
      if (close) {
        if (close.before.trim()) embed.buf.push(close.before.trim())
        flushEmbed()
        applyHtmlLine(close.close)
        continue
      }
      embed.buf.push(trimmed)
      continue
    }

    if (trimmed.length === 0) {
      out.push('')
      continue
    }

    const open = matchOpenEmbed(trimmed)
    if (open) {
      const sameLineClose = matchCloseEmbed(open.rest, open.kind)
      applyHtmlLine(open.open.trim())
      if (sameLineClose) {
        const inner = sameLineClose.before.trim()
        if (inner) {
          out.push(...prefixBlock(formatEmbedBody(open.kind, inner), indent))
        }
        applyHtmlLine(sameLineClose.close)
      } else {
        embed = { kind: open.kind, base: indent, buf: [] }
        if (open.rest.trim()) embed.buf.push(open.rest.trim())
      }
      continue
    }

    applyHtmlLine(trimmed)
  }

  flushEmbed()
  return { ok: true, text: finish(out.join('\n')) }
}

/** 按语言做缩进整理；JSON 用原生 pretty-print。失败时返回原文。 */
export function formatIdeText(text: string, language: IdeLanguage): FormatResult {
  switch (language) {
    case 'json':
      return formatJson(text)
    case 'javascript':
    case 'typescript':
      return formatBraces(text, 'js')
    case 'css':
      return formatCss(text)
    case 'markup':
      return formatMarkup(text)
    default:
      return formatPlain(text)
  }
}
