import { colLetter, SHEET_COLS, SHEET_MAX_COLS, SHEET_MAX_ROWS, SHEET_ROWS, type SheetBody } from '../schema'

export type SheetEvalError = '#ERROR!'

/** A–Z 列，行 1–100 */
export const CELL_RE = /^([A-Z])(100|[1-9]\d?)$/i
const FUNCS = new Set(['SUM', 'AVERAGE', 'MAX', 'MIN'])

export function isPlainNumber(value: string): boolean {
  const t = value.trim()
  if (!t) return false
  return /^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(t)
}

export function parseCellRef(
  ref: string,
  cols = SHEET_MAX_COLS,
  rows = SHEET_MAX_ROWS,
): Nullable<{ col: number; row: number }> {
  const m = CELL_RE.exec(ref.trim())
  if (!m) return null
  const col = m[1].toUpperCase().charCodeAt(0) - 65
  const row = Number(m[2]) - 1
  if (col < 0 || col >= cols || row < 0 || row >= rows) return null
  return { col, row }
}

function expandRange(
  a: string,
  b: string,
  cols: number,
  rows: number,
): Array<{ col: number; row: number }> {
  const start = parseCellRef(a, cols, rows)
  const end = parseCellRef(b, cols, rows)
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
  cols: number
  rows: number
}

function evalCell(col: number, row: number, ctx: EvalCtx): number | SheetEvalError {
  const key = `${colLetter(col)}${row + 1}`
  const hit = ctx.cache.get(key)
  if (hit !== undefined) return hit
  if (ctx.stack.has(key)) return '#ERROR!'
  ctx.stack.add(key)
  const raw = ctx.getRaw(col, row).trim()
  let result: number | SheetEvalError
  if (!raw) result = 0
  else if (raw.startsWith('=')) result = evalFormula(raw.slice(1), ctx)
  else if (isPlainNumber(raw)) result = Number(raw)
  else result = '#ERROR!'
  ctx.stack.delete(key)
  ctx.cache.set(key, result)
  return result
}

function collectAgg(col: number, row: number, ctx: EvalCtx): number | 'skip' {
  const raw = ctx.getRaw(col, row).trim()
  if (!raw) return 'skip'
  if (!raw.startsWith('=') && !isPlainNumber(raw)) return 'skip'
  const v = evalCell(col, row, ctx)
  if (typeof v !== 'number') throw new Error('bad')
  return v
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

  const applyFn = (name: string, nums: number[]): number => {
    if (name === 'SUM') return nums.reduce((a, b) => a + b, 0)
    if (nums.length === 0) throw new Error('bad')
    if (name === 'AVERAGE') return nums.reduce((a, b) => a + b, 0) / nums.length
    if (name === 'MAX') return Math.max(...nums)
    if (name === 'MIN') return Math.min(...nums)
    throw new Error('bad')
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

  const parseTerm = (): number => {
    let v = parseFactor()
    while (peek() === '*' || peek() === '/') {
      const op = eat()
      const r = parseFactor()
      if (op === '/') {
        if (r === 0) throw new Error('bad')
        v /= r
      } else v *= r
    }
    return v
  }

  const parseCallArgs = (): number[] => {
    eat('(')
    const nums: number[] = []
    if (peek() === ')') {
      eat(')')
      return nums
    }
    for (;;) {
      const start = peek()
      if (!start) throw new Error('bad')
      if (CELL_RE.test(start) && tokens[i + 1] === ':') {
        eat()
        eat(':')
        const end = eat()
        if (!end) throw new Error('bad')
        const cells = expandRange(start, end, ctx.cols, ctx.rows)
        if (!cells.length) throw new Error('bad')
        for (const cell of cells) {
          const n = collectAgg(cell.col, cell.row, ctx)
          if (n !== 'skip') nums.push(n)
        }
      } else if (CELL_RE.test(start) && tokens[i + 1] !== '(') {
        eat()
        const ref = parseCellRef(start, ctx.cols, ctx.rows)
        if (!ref) throw new Error('bad')
        const n = collectAgg(ref.col, ref.row, ctx)
        if (n !== 'skip') nums.push(n)
      } else {
        nums.push(parseExpr())
      }
      if (peek() === ',') {
        eat(',')
        continue
      }
      eat(')')
      break
    }
    return nums
  }

  const parseFactor = (): number => {
    const t = peek()
    if (t === '-') {
      eat()
      return -parseFactor()
    }
    if (t === '+') {
      eat()
      return parseFactor()
    }
    if (t === '(') {
      eat()
      const v = parseExpr()
      eat(')')
      return v
    }
    if (t && FUNCS.has(t)) {
      eat()
      return applyFn(t, parseCallArgs())
    }
    if (t && CELL_RE.test(t)) {
      eat()
      const ref = parseCellRef(t, ctx.cols, ctx.rows)
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

  try {
    const value = parseExpr()
    if (i !== tokens.length) return '#ERROR!'
    if (!Number.isFinite(value)) return '#ERROR!'
    return value
  } catch {
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
  const cols = body.cols || SHEET_COLS
  const rows = body.rows || SHEET_ROWS
  const ctx: EvalCtx = {
    getRaw: (c, r) => body.cells[`${colLetter(c)}${r + 1}`] ?? '',
    cache: new Map(),
    stack: new Set(),
    cols,
    rows,
  }
  return formatEval(evalCell(col, row, ctx))
}

/** 一次扫完全表，改单元格后所有公式一起刷新 */
export function evaluateSheet(body: SheetBody): Record<string, string> {
  const cols = body.cols || SHEET_COLS
  const rows = body.rows || SHEET_ROWS
  const ctx: EvalCtx = {
    getRaw: (c, r) => body.cells[`${colLetter(c)}${r + 1}`] ?? '',
    cache: new Map(),
    stack: new Set(),
    cols,
    rows,
  }
  const out: Record<string, string> = {}
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${colLetter(c)}${r + 1}`
      const raw = body.cells[key] ?? ''
      out[key] = raw.startsWith('=') ? formatEval(evalCell(c, r, ctx)) : raw
    }
  }
  return out
}

export function selectionStats(
  evaluated: Record<string, string>,
  ranges: Array<{ c0: number; r0: number; c1: number; r1: number }>,
): { sum: number; avg: Nullable<number>; count: number } {
  let sum = 0
  let count = 0
  const seen = new Set<string>()
  for (const range of ranges) {
    for (let r = range.r0; r <= range.r1; r++) {
      for (let c = range.c0; c <= range.c1; c++) {
        const key = `${colLetter(c)}${r + 1}`
        if (seen.has(key)) continue
        seen.add(key)
        const shown = evaluated[key] ?? ''
        if (!shown || shown.startsWith('#')) continue
        const n = Number(shown)
        if (!Number.isFinite(n)) continue
        sum += n
        count += 1
      }
    }
  }
  return { sum, count, avg: count > 0 ? sum / count : null }
}
