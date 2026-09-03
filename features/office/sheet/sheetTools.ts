import { cellKey, type SheetBody } from '../schema'
import { isPlainNumber } from './formula'
import { fillHandle, setCellValue, sheetSize, type CellPos, type SheetRange } from './sheetOps'

export type SheetAggFn = 'SUM' | 'AVERAGE' | 'MAX' | 'MIN' | 'COUNT'

export function cloneSheet(sheet: SheetBody): SheetBody {
  return {
    ...sheet,
    cells: { ...sheet.cells },
    colWidths: sheet.colWidths?.slice(),
    rowHeights: sheet.rowHeights?.slice(),
    styles: sheet.styles ? { ...sheet.styles } : undefined,
  }
}

export function cellRaw(sheet: SheetBody, col: number, row: number): string {
  return sheet.cells[cellKey(col, row)] ?? ''
}

export function isCellEmpty(sheet: SheetBody, col: number, row: number): boolean {
  return !cellRaw(sheet, col, row).trim()
}

function rowHasValue(sheet: SheetBody, row: number, c0: number, c1: number): boolean {
  for (let c = c0; c <= c1; c++) if (!isCellEmpty(sheet, c, row)) return true
  return false
}

function colHasValue(sheet: SheetBody, col: number, r0: number, r1: number): boolean {
  for (let r = r0; r <= r1; r++) if (!isCellEmpty(sheet, col, r)) return true
  return false
}

function rangeRowEmpty(sheet: SheetBody, range: SheetRange, row: number): boolean {
  return !rowHasValue(sheet, row, range.c0, range.c1)
}

function rangeColEmpty(sheet: SheetBody, range: SheetRange, col: number): boolean {
  return !colHasValue(sheet, col, range.r0, range.r1)
}

/** 以当前格为种子，扩到周围连续有内容的矩形（类似 Excel 当前区域）。 */
export function currentRegion(sheet: SheetBody, pos: CellPos): SheetRange {
  const { cols, rows } = sheetSize(sheet)
  let c0 = pos.col
  let c1 = pos.col
  let r0 = pos.row
  let r1 = pos.row
  let changed = true
  while (changed) {
    changed = false
    if (r0 > 0 && rowHasValue(sheet, r0 - 1, c0, c1)) {
      r0 -= 1
      changed = true
    }
    if (r1 < rows - 1 && rowHasValue(sheet, r1 + 1, c0, c1)) {
      r1 += 1
      changed = true
    }
    if (c0 > 0 && colHasValue(sheet, c0 - 1, r0, r1)) {
      c0 -= 1
      changed = true
    }
    if (c1 < cols - 1 && colHasValue(sheet, c1 + 1, r0, r1)) {
      c1 += 1
      changed = true
    }
  }
  return { c0, r0, c1, r1 }
}

function compareValues(a: string, b: string): number {
  const na = isPlainNumber(a)
  const nb = isPlainNumber(b)
  if (na && nb) return Number(a) - Number(b)
  if (na && !nb) return -1
  if (!na && nb) return 1
  return a.trim().localeCompare(b.trim(), undefined, { numeric: true, sensitivity: 'base' })
}

/** 区域内整行一起排；空单元格始终沉底。 */
export function sortRange(sheet: SheetBody, range: SheetRange, byCol: number, dir: 'asc' | 'desc'): SheetBody {
  const { c0, c1, r0, r1 } = range
  const sortIndex = byCol - c0
  if (byCol < c0 || byCol > c1 || r1 <= r0) return sheet
  const list = Array.from({ length: r1 - r0 + 1 }, (_, i) => {
    const row = r0 + i
    const values = Array.from({ length: c1 - c0 + 1 }, (_, j) => cellRaw(sheet, c0 + j, row))
    const rowStyles = Array.from({ length: c1 - c0 + 1 }, (_, j) => sheet.styles?.[cellKey(c0 + j, row)])
    return { i, values, rowStyles }
  })
  const filled = list.filter((row) => row.values[sortIndex]?.trim())
  const empties = list.filter((row) => !row.values[sortIndex]?.trim())
  filled.sort((a, b) => {
    const cmp = compareValues(a.values[sortIndex] ?? '', b.values[sortIndex] ?? '')
    const ordered = dir === 'asc' ? cmp : -cmp
    return ordered !== 0 ? ordered : a.i - b.i
  })
  const cells = { ...sheet.cells }
  const styles = { ...(sheet.styles ?? {}) }
  ;[...filled, ...empties].forEach((row, offset) => {
    const dest = r0 + offset
    row.values.forEach((value, j) => {
      const key = cellKey(c0 + j, dest)
      if (value.trim()) cells[key] = value
      else delete cells[key]
    })
    row.rowStyles.forEach((style, j) => {
      const key = cellKey(c0 + j, dest)
      if (style) styles[key] = style
      else delete styles[key]
    })
  })
  return { ...sheet, cells, styles }
}

function matchesQuery(raw: string, shown: string, query: string): boolean {
  const q = query.toLowerCase()
  return raw.toLowerCase().includes(q) || shown.toLowerCase().includes(q)
}

/** 从 start 的下一格开始，按行列扫描并循环。 */
export function findNextCell(
  sheet: SheetBody,
  evaluated: Record<string, string>,
  start: CellPos,
  query: string,
): Nullable<CellPos> {
  const q = query.trim()
  if (!q) return null
  const { cols, rows } = sheetSize(sheet)
  const total = cols * rows
  if (total <= 0) return null
  const origin = start.row * cols + start.col
  for (let step = 1; step <= total; step++) {
    const index = (origin + step) % total
    const col = index % cols
    const row = Math.floor(index / cols)
    const raw = cellRaw(sheet, col, row)
    const shown = evaluated[cellKey(col, row)] ?? raw
    if (matchesQuery(raw, shown, q)) return { col, row }
  }
  return null
}

export function prevCell(pos: CellPos, cols: number, rows: number): CellPos {
  const total = cols * rows
  const index = (pos.row * cols + pos.col - 1 + total) % total
  return { col: index % cols, row: Math.floor(index / cols) }
}

export function replaceFirstRaw(raw: string, query: string, replacement: string): Nullable<string> {
  const q = query.trim()
  if (!q) return null
  const idx = raw.toLowerCase().indexOf(q.toLowerCase())
  if (idx < 0) return null
  return `${raw.slice(0, idx)}${replacement}${raw.slice(idx + q.length)}`
}

export function replaceInRanges(
  sheet: SheetBody,
  ranges: SheetRange[],
  query: string,
  replacement: string,
): { sheet: SheetBody; count: number } {
  const q = query.trim()
  if (!q) return { sheet, count: 0 }
  const cells = { ...sheet.cells }
  let count = 0
  const seen = new Set<string>()
  for (const range of ranges) {
    for (let r = range.r0; r <= range.r1; r++) {
      for (let c = range.c0; c <= range.c1; c++) {
        const key = cellKey(c, r)
        if (seen.has(key)) continue
        seen.add(key)
        const raw = cells[key] ?? ''
        if (!raw) continue
        const next = replaceFirstRaw(raw, q, replacement)
        if (next == null) continue
        const all = raw.replace(new RegExp(escapeRegExp(q), 'gi'), replacement)
        if (all.trim()) cells[key] = all
        else delete cells[key]
        count += occurrences(raw, q)
      }
    }
  }
  return { sheet: { ...sheet, cells }, count }
}

function occurrences(raw: string, query: string): number {
  const q = query.toLowerCase()
  const s = raw.toLowerCase()
  let n = 0
  let i = 0
  while (i <= s.length - q.length) {
    const hit = s.indexOf(q, i)
    if (hit < 0) break
    n += 1
    i = hit + Math.max(1, q.length)
  }
  return n
}

function escapeRegExp(src: string): string {
  return src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function formulaFor(fn: SheetAggFn, c0: number, r0: number, c1: number, r1: number): string {
  const a = cellKey(c0, r0)
  const b = cellKey(c1, r1)
  return a === b ? `=${fn}(${a})` : `=${fn}(${a}:${b})`
}

/** 在选区下方/右侧或当前空格写入汇总公式。 */
export function placeAggregate(
  sheet: SheetBody,
  range: SheetRange,
  fn: SheetAggFn,
): Nullable<{ sheet: SheetBody; pos: CellPos }> {
  const { cols, rows } = sheetSize(sheet)
  const writes: Array<{ col: number; row: number; formula: string }> = []
  const single = range.c0 === range.c1 && range.r0 === range.r1

  if (single) {
    const col = range.c0
    const row = range.r0
    let top = row
    while (top > 0 && !isCellEmpty(sheet, col, top - 1)) top -= 1
    if (top < row) {
      writes.push({ col, row, formula: formulaFor(fn, col, top, col, row - 1) })
    } else {
      let left = col
      while (left > 0 && !isCellEmpty(sheet, left - 1, row)) left -= 1
      if (left >= col) return null
      writes.push({ col, row, formula: formulaFor(fn, left, row, col - 1, row) })
    }
  } else if (range.r1 > range.r0 && rangeRowEmpty(sheet, range, range.r1)) {
    for (let c = range.c0; c <= range.c1; c++) {
      writes.push({ col: c, row: range.r1, formula: formulaFor(fn, c, range.r0, c, range.r1 - 1) })
    }
  } else if (range.c1 > range.c0 && rangeColEmpty(sheet, range, range.c1)) {
    for (let r = range.r0; r <= range.r1; r++) {
      writes.push({ col: range.c1, row: r, formula: formulaFor(fn, range.c0, r, range.c1 - 1, r) })
    }
  } else if (range.r1 + 1 < rows && rangeRowEmpty(sheet, { ...range, r0: range.r1 + 1, r1: range.r1 + 1 }, range.r1 + 1)) {
    for (let c = range.c0; c <= range.c1; c++) {
      writes.push({ col: c, row: range.r1 + 1, formula: formulaFor(fn, c, range.r0, c, range.r1) })
    }
  } else if (range.c1 + 1 < cols && rangeColEmpty(sheet, { ...range, c0: range.c1 + 1, c1: range.c1 + 1 }, range.c1 + 1)) {
    for (let r = range.r0; r <= range.r1; r++) {
      writes.push({ col: range.c1 + 1, row: r, formula: formulaFor(fn, range.c0, r, range.c1, r) })
    }
  } else {
    return null
  }

  let next = sheet
  for (const w of writes) next = setCellValue(next, w.col, w.row, w.formula)
  return { sheet: next, pos: { col: writes[0].col, row: writes[0].row } }
}

export function fillDown(sheet: SheetBody, range: SheetRange): Nullable<SheetBody> {
  if (range.r1 <= range.r0) return null
  return fillHandle(sheet, { c0: range.c0, r0: range.r0, c1: range.c1, r1: range.r0 }, range)
}

export function fillRight(sheet: SheetBody, range: SheetRange): Nullable<SheetBody> {
  if (range.c1 <= range.c0) return null
  return fillHandle(sheet, { c0: range.c0, r0: range.r0, c1: range.c0, r1: range.r1 }, range)
}
