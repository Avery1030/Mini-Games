import { colLetter, SHEET_COLS, SHEET_ROWS, type SheetBody } from '../schema'

export type SheetEvalError = '#ERROR!' | '#CYCLE!' | '#DIV/0!'

const CELL_RE = /^([A-J])([1-9]|1\d|2[0-4])$/i

export function parseCellRef(ref: string): Nullable<{ col: number; row: number }> {
  const m = CELL_RE.exec(ref.trim())
  if (!m) return null
  const col = m[1].toUpperCase().charCodeAt(0) - 65
  const row = Number(m[2]) - 1
  if (col < 0 || col >= SHEET_COLS || row < 0 || row >= SHEET_ROWS) return null
  return { col, row }
}

function expandRange(a: string, b: string): Array<{ col: number; row: number }> {
  const start = parseCellRef(a)
  const end = parseCellRef(b)
  if (!start || !end) return []
  const c0 = Math.min(start.col, end.col)
  const c1 = Math.max(start.col, end.col)
  const r0 = Math.min(start.row, end.row)
  const r1 = Math.max(start.row, end.row)
  const out: Array<{ col: number; row: number }> = []
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) out.push({ col: c, row: r })
  }
  return out
}

function tokenize(src: string): string[] {
  const tokens: string[] = []
  const s = src.trim()
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (ch === ' ' || ch === '\t') {
      i += 1
      continue
    }
    if ('+-*/(),:'.includes(ch)) {
      tokens.push(ch)
      i += 1
      continue
    }
    if (/[0-9.]/.test(ch)) {
      let j = i + 1
      while (j < s.length && /[0-9.]/.test(s[j])) j += 1
      tokens.push(s.slice(i, j))
      i = j
      continue
    }
    if (/[A-Za-z]/.test(ch)) {
      let j = i + 1
      while (j < s.length && /[A-Za-z0-9]/.test(s[j])) j += 1
      tokens.push(s.slice(i, j).toUpperCase())
      i = j
      continue
    }
    throw new Error('bad')
  }
  return tokens
}

type EvalCtx = {
  getRaw: (col: number, row: number) => string
  cache: Map<string, number | SheetEvalError>
  stack: Set<string>
}

function asNumber(value: string): number {
  const n = Number(value.trim())
  return Number.isFinite(n) ? n : 0
}

function evalCell(col: number, row: number, ctx: EvalCtx): number | SheetEvalError {
  const key = `${colLetter(col)}${row + 1}`
  const hit = ctx.cache.get(key)
  if (hit !== undefined) return hit
  if (ctx.stack.has(key)) return '#CYCLE!'
  ctx.stack.add(key)
  const raw = ctx.getRaw(col, row).trim()
  let result: number | SheetEvalError
  if (!raw) result = 0
  else if (raw.startsWith('=')) result = evalFormula(raw.slice(1), ctx)
  else result = asNumber(raw)
  ctx.stack.delete(key)
  ctx.cache.set(key, result)
  return result
}

function evalFormula(src: string, ctx: EvalCtx): number | SheetEvalError {
  const tokens = tokenize(src)
  let i = 0
  const peek = () => tokens[i]
  const eat = (expect?: string) => {
    const t = tokens[i]
    if (expect && t !== expect) throw new Error('bad')
    i += 1
    return t
  }

  const parseFactor = (): number => {
    const t = peek()
    if (t === '-') {
      eat()
      return -parseFactor()
    }
    if (t === '(') {
      eat()
      const v = parseExpr()
      eat(')')
      return v
    }
    if (t === 'SUM') {
      eat()
      eat('(')
      const a = eat()
      eat(':')
      const b = eat()
      eat(')')
      if (!a || !b) throw new Error('bad')
      let sum = 0
      for (const cell of expandRange(a, b)) {
        const v = evalCell(cell.col, cell.row, ctx)
        if (typeof v !== 'number') throw new Error('bad')
        sum += v
      }
      return sum
    }
    if (t && CELL_RE.test(t)) {
      eat()
      const ref = parseCellRef(t)
      if (!ref) throw new Error('bad')
      const v = evalCell(ref.col, ref.row, ctx)
      if (typeof v !== 'number') throw new Error('bad')
      return v
    }
    if (t && /^[0-9.]+$/.test(t)) {
      eat()
      const n = Number(t)
      if (!Number.isFinite(n)) throw new Error('bad')
      return n
    }
    throw new Error('bad')
  }

  const parseTerm = (): number => {
    let v = parseFactor()
    while (peek() === '*' || peek() === '/') {
      const op = eat()
      const r = parseFactor()
      if (op === '/') {
        if (r === 0) throw new Error('div')
        v /= r
      } else v *= r
    }
    return v
  }

  const parseExpr = (): number => {
    let v = parseTerm()
    while (peek() === '+' || peek() === '-') {
      const op = eat()
      const r = parseTerm()
      v = op === '+' ? v + r : v - r
    }
    return v
  }

  try {
    const value = parseExpr()
    if (i !== tokens.length) return '#ERROR!'
    if (!Number.isFinite(value)) return '#ERROR!'
    return value
  } catch (err) {
    if (err instanceof Error && err.message === 'div') return '#DIV/0!'
    return '#ERROR!'
  }
}

function formatEval(value: number | SheetEvalError): string {
  if (typeof value !== 'number') return value
  if (Number.isInteger(value)) return String(value)
  return String(Math.round(value * 1e6) / 1e6)
}

export function displayCell(body: SheetBody, col: number, row: number): string {
  const raw = body.cells[`${colLetter(col)}${row + 1}`] ?? ''
  if (!raw.startsWith('=')) return raw
  const ctx: EvalCtx = {
    getRaw: (c, r) => body.cells[`${colLetter(c)}${r + 1}`] ?? '',
    cache: new Map(),
    stack: new Set(),
  }
  return formatEval(evalCell(col, row, ctx))
}

/** 一次扫完全表，改单元格后所有公式一起刷新 */
export function evaluateSheet(body: SheetBody): Record<string, string> {
  const ctx: EvalCtx = {
    getRaw: (c, r) => body.cells[`${colLetter(c)}${r + 1}`] ?? '',
    cache: new Map(),
    stack: new Set(),
  }
  const out: Record<string, string> = {}
  for (let r = 0; r < (body.rows || SHEET_ROWS); r++) {
    for (let c = 0; c < (body.cols || SHEET_COLS); c++) {
      const key = `${colLetter(c)}${r + 1}`
      const raw = body.cells[key] ?? ''
      out[key] = raw.startsWith('=') ? formatEval(evalCell(c, r, ctx)) : raw
    }
  }
  return out
}

export function selectionStats(
  evaluated: Record<string, string>,
  range: { c0: number; r0: number; c1: number; r1: number },
): { sum: number; avg: Nullable<number>; count: number } {
  let sum = 0
  let count = 0
  for (let r = range.r0; r <= range.r1; r++) {
    for (let c = range.c0; c <= range.c1; c++) {
      const shown = evaluated[`${colLetter(c)}${r + 1}`] ?? ''
      if (!shown || shown.startsWith('#')) continue
      const n = Number(shown)
      if (!Number.isFinite(n)) continue
      sum += n
      count += 1
    }
  }
  return { sum, count, avg: count > 0 ? sum / count : null }
}
