import { SHEET_COLS, SHEET_MAX_COLS, SHEET_MAX_ROWS, SHEET_ROWS, cellKey, type SheetBody } from '../schema'
import { isPlainNumber, parseCellRef } from './formula'

export type CellPos = { col: number; row: number }
export type SheetRange = { c0: number; r0: number; c1: number; r1: number }

export function clampIndex(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export const DEFAULT_COL_WIDTH = 72
export const DEFAULT_ROW_HEIGHT = 24
export const DEFAULT_ROW_HEAD_WIDTH = 32
export const DEFAULT_COL_HEAD_HEIGHT = 24
export const MIN_COL_WIDTH = 36
export const MAX_COL_WIDTH = 480
export const MIN_ROW_HEIGHT = 16
export const MAX_ROW_HEIGHT = 240
export const MIN_ROW_HEAD_WIDTH = 24
export const MAX_ROW_HEAD_WIDTH = 96
export const MIN_COL_HEAD_HEIGHT = 18
export const MAX_COL_HEAD_HEIGHT = 64

export function clampColWidth(n: number): number {
  return Math.round(clampIndex(n, MIN_COL_WIDTH, MAX_COL_WIDTH))
}

export function clampRowHeight(n: number): number {
  return Math.round(clampIndex(n, MIN_ROW_HEIGHT, MAX_ROW_HEIGHT))
}

export function clampRowHeadWidth(n: number): number {
  return Math.round(clampIndex(n, MIN_ROW_HEAD_WIDTH, MAX_ROW_HEAD_WIDTH))
}

export function clampColHeadHeight(n: number): number {
  return Math.round(clampIndex(n, MIN_COL_HEAD_HEIGHT, MAX_COL_HEAD_HEIGHT))
}

/** 全部仍是默认尺寸时，把剩余空间均分到各行/列，铺满可视区域。 */
export function fitSheetAxis(
  stored: number[] | undefined,
  count: number,
  fallback: number,
  available: number,
  clamp: (n: number) => number,
): number[] {
  const sizes = Array.from({ length: count }, (_, i) => clamp(stored?.[i] ?? fallback))
  if (available <= 0 || sizes.some((n) => n !== fallback)) return sizes
  const extra = available - fallback * count
  if (extra <= 0) return sizes
  const each = Math.floor(extra / count)
  let rem = extra - each * count
  return sizes.map((n) => {
    const add = each + (rem > 0 ? 1 : 0)
    if (rem > 0) rem -= 1
    return clamp(n + add)
  })
}

export function sheetSize(body: SheetBody): { cols: number; rows: number } {
  return {
    cols: body.cols || SHEET_COLS,
    rows: body.rows || SHEET_ROWS,
  }
}

function padSizes(list: number[] | undefined, length: number, fallback: number, clamp: (n: number) => number): number[] {
  return Array.from({ length }, (_, i) => clamp(list?.[i] ?? fallback))
}

export function normalizeSheet(body: SheetBody): SheetBody {
  const cols = clampIndex(body.cols || SHEET_COLS, 1, SHEET_MAX_COLS)
  const rows = clampIndex(body.rows || SHEET_ROWS, 1, SHEET_MAX_ROWS)
  return {
    cols,
    rows,
    cells: { ...body.cells },
    colWidths: padSizes(body.colWidths, cols, DEFAULT_COL_WIDTH, clampColWidth),
    rowHeights: padSizes(body.rowHeights, rows, DEFAULT_ROW_HEIGHT, clampRowHeight),
    rowHeadWidth: clampRowHeadWidth(body.rowHeadWidth ?? DEFAULT_ROW_HEAD_WIDTH),
    colHeadHeight: clampColHeadHeight(body.colHeadHeight ?? DEFAULT_COL_HEAD_HEIGHT),
  }
}

export function snapshotSheet(body: SheetBody): string {
  return JSON.stringify({
    cols: body.cols,
    rows: body.rows,
    cells: body.cells,
    colWidths: body.colWidths,
    rowHeights: body.rowHeights,
    rowHeadWidth: body.rowHeadWidth,
    colHeadHeight: body.colHeadHeight,
  })
}

export function clampPos(pos: CellPos, cols: number, rows: number): CellPos {
  return {
    col: clampIndex(pos.col, 0, Math.max(0, cols - 1)),
    row: clampIndex(pos.row, 0, Math.max(0, rows - 1)),
  }
}

export function normRange(a: CellPos, b: CellPos): SheetRange {
  return {
    c0: Math.min(a.col, b.col),
    r0: Math.min(a.row, b.row),
    c1: Math.max(a.col, b.col),
    r1: Math.max(a.row, b.row),
  }
}

export function inRange(range: SheetRange, col: number, row: number): boolean {
  return col >= range.c0 && col <= range.c1 && row >= range.r0 && row <= range.r1
}

export function cellInRanges(ranges: SheetRange[], col: number, row: number): boolean {
  return ranges.some((range) => inRange(range, col, row))
}

export function unionRange(a: SheetRange, b: SheetRange): SheetRange {
  return {
    c0: Math.min(a.c0, b.c0),
    r0: Math.min(a.r0, b.r0),
    c1: Math.max(a.c1, b.c1),
    r1: Math.max(a.r1, b.r1),
  }
}

export function boundsOf(ranges: SheetRange[]): SheetRange {
  return ranges.reduce((acc, range) => unionRange(acc, range))
}

export function colRange(col: number, rows: number): SheetRange {
  const c = clampIndex(col, 0, SHEET_MAX_COLS - 1)
  return { c0: c, r0: 0, c1: c, r1: Math.max(0, rows - 1) }
}

export function rowRange(row: number, cols: number): SheetRange {
  const r = clampIndex(row, 0, SHEET_MAX_ROWS - 1)
  return { c0: 0, r0: r, c1: Math.max(0, cols - 1), r1: r }
}

export function allRange(cols: number, rows: number): SheetRange {
  return { c0: 0, r0: 0, c1: Math.max(0, cols - 1), r1: Math.max(0, rows - 1) }
}

export function formatRangeLabel(range: SheetRange): string {
  const a = cellKey(range.c0, range.r0)
  if (range.c0 === range.c1 && range.r0 === range.r1) return a
  return `${a}:${cellKey(range.c1, range.r1)}`
}

export function formatRangesLabel(ranges: SheetRange[]): string {
  if (ranges.length === 1) return formatRangeLabel(ranges[0])
  return ranges.map(formatRangeLabel).join(',')
}

function formatNum(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 1e6) / 1e6)
}

const REF_RE = /([A-Z])(100|[1-9]\d?)/gi

export function shiftFormula(
  raw: string,
  dCol: number,
  dRow: number,
  cols = SHEET_MAX_COLS,
  rows = SHEET_MAX_ROWS,
): string {
  if (!raw.startsWith('=') || (dCol === 0 && dRow === 0)) return raw
  return raw.replace(REF_RE, (match) => {
    const ref = parseCellRef(match, SHEET_MAX_COLS, SHEET_MAX_ROWS)
    if (!ref) return match
    const col = ref.col + dCol
    const row = ref.row + dRow
    if (col < 0 || col >= cols || row < 0 || row >= rows) return match
    return cellKey(col, row)
  })
}

type AxisMap = (n: number) => Nullable<number>

export function remapFormula(raw: string, mapCol: AxisMap, mapRow: AxisMap): string {
  if (!raw.startsWith('=')) return raw
  return raw.replace(REF_RE, (match) => {
    const ref = parseCellRef(match, SHEET_MAX_COLS, SHEET_MAX_ROWS)
    if (!ref) return match
    const col = mapCol(ref.col)
    const row = mapRow(ref.row)
    if (col == null || row == null) return '#REF!'
    return cellKey(col, row)
  })
}

function remapCells(sheet: SheetBody, mapCol: AxisMap, mapRow: AxisMap): Record<string, string> {
  const cells: Record<string, string> = {}
  for (const [key, value] of Object.entries(sheet.cells)) {
    const pos = parseCellRef(key, SHEET_MAX_COLS, SHEET_MAX_ROWS)
    if (!pos) continue
    const col = mapCol(pos.col)
    const row = mapRow(pos.row)
    if (col == null || row == null) continue
    const next = remapFormula(value, mapCol, mapRow)
    if (next.trim()) cells[cellKey(col, row)] = next
  }
  return cells
}

export type SheetMutateResult = { ok: true; sheet: SheetBody } | { ok: false; reason: 'limit' | 'last' }

export function insertCol(sheet: SheetBody, at: number): SheetMutateResult {
  const { cols, rows } = sheetSize(sheet)
  if (cols >= SHEET_MAX_COLS) return { ok: false, reason: 'limit' }
  const index = clampIndex(at, 0, cols)
  const mapCol: AxisMap = (c) => (c >= index ? c + 1 : c)
  const mapRow: AxisMap = (r) => r
  const colWidths = padSizes(sheet.colWidths, cols, DEFAULT_COL_WIDTH, clampColWidth)
  colWidths.splice(index, 0, DEFAULT_COL_WIDTH)
  return {
    ok: true,
    sheet: { ...sheet, cols: cols + 1, rows, cells: remapCells(sheet, mapCol, mapRow), colWidths },
  }
}

export function deleteCol(sheet: SheetBody, index: number): SheetMutateResult {
  const { cols, rows } = sheetSize(sheet)
  if (cols <= 1) return { ok: false, reason: 'last' }
  const i = clampIndex(index, 0, cols - 1)
  const mapCol: AxisMap = (c) => (c === i ? null : c > i ? c - 1 : c)
  const mapRow: AxisMap = (r) => r
  const colWidths = padSizes(sheet.colWidths, cols, DEFAULT_COL_WIDTH, clampColWidth)
  colWidths.splice(i, 1)
  return {
    ok: true,
    sheet: { ...sheet, cols: cols - 1, rows, cells: remapCells(sheet, mapCol, mapRow), colWidths },
  }
}

export function insertRow(sheet: SheetBody, at: number): SheetMutateResult {
  const { cols, rows } = sheetSize(sheet)
  if (rows >= SHEET_MAX_ROWS) return { ok: false, reason: 'limit' }
  const index = clampIndex(at, 0, rows)
  const mapCol: AxisMap = (c) => c
  const mapRow: AxisMap = (r) => (r >= index ? r + 1 : r)
  const rowHeights = padSizes(sheet.rowHeights, rows, DEFAULT_ROW_HEIGHT, clampRowHeight)
  rowHeights.splice(index, 0, DEFAULT_ROW_HEIGHT)
  return {
    ok: true,
    sheet: { ...sheet, cols, rows: rows + 1, cells: remapCells(sheet, mapCol, mapRow), rowHeights },
  }
}

export function deleteRow(sheet: SheetBody, index: number): SheetMutateResult {
  const { cols, rows } = sheetSize(sheet)
  if (rows <= 1) return { ok: false, reason: 'last' }
  const i = clampIndex(index, 0, rows - 1)
  const mapCol: AxisMap = (c) => c
  const mapRow: AxisMap = (r) => (r === i ? null : r > i ? r - 1 : r)
  const rowHeights = padSizes(sheet.rowHeights, rows, DEFAULT_ROW_HEIGHT, clampRowHeight)
  rowHeights.splice(i, 1)
  return {
    ok: true,
    sheet: { ...sheet, cols, rows: rows - 1, cells: remapCells(sheet, mapCol, mapRow), rowHeights },
  }
}

function trend(values: number[]): Nullable<{ start: number; step: number }> {
  if (!values.length) return null
  if (values.length === 1) return { start: values[0], step: 1 }
  return { start: values[0], step: (values[values.length - 1] - values[0]) / (values.length - 1) }
}

function columnTrend(sheet: SheetBody, from: SheetRange, col: number): Nullable<{ start: number; step: number }> {
  const nums: number[] = []
  for (let r = from.r0; r <= from.r1; r++) {
    const raw = sheet.cells[cellKey(col, r)] ?? ''
    if (!isPlainNumber(raw)) return null
    nums.push(Number(raw.trim()))
  }
  return trend(nums)
}

function rowTrend(sheet: SheetBody, from: SheetRange, row: number): Nullable<{ start: number; step: number }> {
  const nums: number[] = []
  for (let c = from.c0; c <= from.c1; c++) {
    const raw = sheet.cells[cellKey(c, row)] ?? ''
    if (!isPlainNumber(raw)) return null
    nums.push(Number(raw.trim()))
  }
  return trend(nums)
}

/** 填充柄：文本复制；数字按拖拽方向递增；公式相对引用平移 */
export function fillHandle(sheet: SheetBody, from: SheetRange, to: SheetRange): SheetBody {
  const dest = unionRange(from, to)
  const srcW = from.c1 - from.c0 + 1
  const srcH = from.r1 - from.r0 + 1
  const extraDown = dest.r0 < from.r0 || dest.r1 > from.r1
  const extraRight = dest.c0 < from.c0 || dest.c1 > from.c1
  const cells = { ...sheet.cells }

  for (let r = dest.r0; r <= dest.r1; r++) {
    for (let c = dest.c0; c <= dest.c1; c++) {
      if (inRange(from, c, r)) continue
      const srcC = from.c0 + ((((c - from.c0) % srcW) + srcW) % srcW)
      const srcR = from.r0 + ((((r - from.r0) % srcH) + srcH) % srcH)
      const srcRaw = sheet.cells[cellKey(srcC, srcR)] ?? ''
      const destKey = cellKey(c, r)
      let next = srcRaw

      const colSeries = extraDown && c >= from.c0 && c <= from.c1 ? columnTrend(sheet, from, c) : null
      const rowSeries = extraRight && r >= from.r0 && r <= from.r1 ? rowTrend(sheet, from, r) : null

      if (colSeries && !(extraRight && extraDown && rowSeries)) {
        next = formatNum(colSeries.start + (r - from.r0) * colSeries.step)
      } else if (rowSeries && !(extraRight && extraDown && colSeries)) {
        next = formatNum(rowSeries.start + (c - from.c0) * rowSeries.step)
      } else if (srcRaw.startsWith('=')) {
        next = shiftFormula(srcRaw, c - srcC, r - srcR, sheetSize(sheet).cols, sheetSize(sheet).rows)
      } else if (isPlainNumber(srcRaw)) {
        next = formatNum(Number(srcRaw.trim()) + (c - srcC) + (r - srcR))
      }

      if (next.trim()) cells[destKey] = next
      else delete cells[destKey]
    }
  }
  return { ...sheet, cells }
}

export function clearCells(sheet: SheetBody, ranges: SheetRange[]): SheetBody {
  const cells = { ...sheet.cells }
  for (const range of ranges) {
    for (let r = range.r0; r <= range.r1; r++) {
      for (let c = range.c0; c <= range.c1; c++) {
        delete cells[cellKey(c, r)]
      }
    }
  }
  return { ...sheet, cells }
}

export function copyGrid(sheet: SheetBody, ranges: SheetRange[]): string[][] {
  const b = boundsOf(ranges)
  const grid: string[][] = []
  for (let r = b.r0; r <= b.r1; r++) {
    const row: string[] = []
    for (let c = b.c0; c <= b.c1; c++) {
      row.push(cellInRanges(ranges, c, r) ? (sheet.cells[cellKey(c, r)] ?? '') : '')
    }
    grid.push(row)
  }
  return grid
}

export function gridToTsv(grid: string[][]): string {
  return grid.map((row) => row.join('\t')).join('\n')
}

export function tsvToGrid(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  if (lines.length && lines[lines.length - 1] === '') lines.pop()
  if (!lines.length) return [['']]
  return lines.map((line) => line.split('\t'))
}

export function pasteGrid(sheet: SheetBody, origin: CellPos, grid: string[][]): SheetBody {
  const { cols, rows } = sheetSize(sheet)
  const cells = { ...sheet.cells }
  for (let r = 0; r < grid.length; r++) {
    const row = origin.row + r
    if (row < 0 || row >= rows) continue
    const line = grid[r] ?? []
    for (let c = 0; c < line.length; c++) {
      const col = origin.col + c
      if (col < 0 || col >= cols) continue
      const value = line[c] ?? ''
      const key = cellKey(col, row)
      if (value.trim()) cells[key] = value
      else delete cells[key]
    }
  }
  return { ...sheet, cells }
}

export function rangeEdge(range: SheetRange, col: number, row: number): {
  top: boolean
  right: boolean
  bottom: boolean
  left: boolean
} {
  return {
    top: row === range.r0,
    right: col === range.c1,
    bottom: row === range.r1,
    left: col === range.c0,
  }
}
