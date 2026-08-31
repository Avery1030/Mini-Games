/**
 * 数独求解：唯一解校验、完整解、破解路径（优先裸单 / 隐单，附带推导依据）
 */

import type { CrackReasonKind, CrackStep } from './types'

// 开启破解演示时，请将此项设置为 true，否则默认关闭
export const ENABLE_CRACK_DEMO = false

const SIZE = 9
const BOX = 3

function isValidPlacement(grid: number[][], row: number, col: number, num: number): boolean {
  for (let i = 0; i < SIZE; i++) {
    if (grid[row]![i] === num || grid[i]![col] === num) return false
  }
  const br = Math.floor(row / BOX) * BOX
  const bc = Math.floor(col / BOX) * BOX
  for (let r = br; r < br + BOX; r++) {
    for (let c = bc; c < bc + BOX; c++) {
      if (grid[r]![c] === num) return false
    }
  }
  return true
}

function cloneGrid(grid: number[][]): number[][] {
  return grid.map((row) => row.slice())
}

/** 候选数个数（MRV） */
function candidateCount(grid: number[][], row: number, col: number): number {
  let n = 0
  for (let num = 1; num <= SIZE; num++) {
    if (isValidPlacement(grid, row, col, num)) n++
  }
  return n
}

function findBestEmpty(grid: number[][]): Nullable<{ row: number; col: number }> {
  let best: Nullable<{ row: number; col: number; count: number }> = null
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r]![c] !== 0) continue
      const count = candidateCount(grid, r, c)
      if (count === 0) return { row: r, col: c }
      if (!best || count < best.count) best = { row: r, col: c, count }
    }
  }
  return best ? { row: best.row, col: best.col } : null
}

/**
 * 统计解的数量，最多数到 `limit`。
 * 返回值 ≥ limit 时表示至少有这么多解。
 */
export function countSolutions(grid: number[][], limit = 2): number {
  const g = cloneGrid(grid)
  let count = 0

  const dfs = (): boolean => {
    const pos = findBestEmpty(g)
    if (!pos) {
      count++
      return count >= limit
    }
    const { row, col } = pos
    for (let num = 1; num <= SIZE; num++) {
      if (!isValidPlacement(g, row, col, num)) continue
      g[row]![col] = num
      if (dfs()) {
        g[row]![col] = 0
        return true
      }
      g[row]![col] = 0
    }
    return false
  }

  dfs()
  return count
}

/** 求一个解；无解返回 null */
export function solveOne(grid: number[][]): Nullable<number[][]> {
  const g = cloneGrid(grid)
  const dfs = (): boolean => {
    const pos = findBestEmpty(g)
    if (!pos) return true
    const { row, col } = pos
    for (let num = 1; num <= SIZE; num++) {
      if (!isValidPlacement(g, row, col, num)) continue
      g[row]![col] = num
      if (dfs()) return true
      g[row]![col] = 0
    }
    return false
  }
  return dfs() ? g : null
}

/** 要求恰好唯一解；否则返回 null */
export function solveUnique(grid: number[][]): Nullable<number[][]> {
  if (countSolutions(grid, 2) !== 1) return null
  return solveOne(grid)
}

function findNakedSingle(grid: number[][]): Nullable<CrackStep> {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r]![c] !== 0) continue
      let only = 0
      for (let num = 1; num <= SIZE; num++) {
        if (!isValidPlacement(grid, r, c, num)) continue
        if (only !== 0) {
          only = -1
          break
        }
        only = num
      }
      if (only > 0) {
        return { row: r, col: c, value: only, reason: 'nakedSingle' }
      }
    }
  }
  return null
}

function findHiddenSingle(
  grid: number[][],
  kind: Extract<CrackReasonKind, 'hiddenSingleRow' | 'hiddenSingleCol' | 'hiddenSingleBox'>,
): Nullable<CrackStep> {
  for (let num = 1; num <= SIZE; num++) {
    for (let unit = 0; unit < SIZE; unit++) {
      let onlyRow = -1
      let onlyCol = -1
      let count = 0

      for (let i = 0; i < SIZE; i++) {
        let r: number
        let c: number
        if (kind === 'hiddenSingleRow') {
          r = unit
          c = i
        } else if (kind === 'hiddenSingleCol') {
          r = i
          c = unit
        } else {
          const br = Math.floor(unit / BOX) * BOX
          const bc = (unit % BOX) * BOX
          r = br + Math.floor(i / BOX)
          c = bc + (i % BOX)
        }
        if (grid[r]![c] !== 0) continue
        if (!isValidPlacement(grid, r, c, num)) continue
        count++
        onlyRow = r
        onlyCol = c
        if (count > 1) break
      }

      if (count === 1) {
        return { row: onlyRow, col: onlyCol, value: num, reason: kind }
      }
    }
  }
  return null
}

function findLogicalStep(grid: number[][]): Nullable<CrackStep> {
  return (
    findNakedSingle(grid) ??
    findHiddenSingle(grid, 'hiddenSingleRow') ??
    findHiddenSingle(grid, 'hiddenSingleCol') ??
    findHiddenSingle(grid, 'hiddenSingleBox')
  )
}

/** 当前盘面下一步基础技法提示；没有则返回 null */
export function findHintStep(board: number[][], solution: number[][]): Nullable<CrackStep> {
  const step = findLogicalStep(board)
  if (!step) return null
  const answer = solution[step.row]![step.col]!
  if (step.value !== answer) {
    return { row: step.row, col: step.col, value: answer, reason: 'uniqueSolution' }
  }
  return step
}

/**
 * 从当前盘面出发生成填数路径（用于逐步破解）。
 * 优先裸单 / 隐单并标注依据；无法用基础技法推进时，按唯一解填入兜底。
 */
export function buildCrackPath(board: number[][], solution: number[][]): Nullable<CrackStep[]> {
  if (countSolutions(board, 2) !== 1) return null

  const g = cloneGrid(board)
  const path: CrackStep[] = []

  while (true) {
    const empty = findBestEmpty(g)
    if (!empty) break

    let step = findLogicalStep(g)
    if (!step) {
      const answer = solution[empty.row]![empty.col]!
      if (answer < 1 || answer > 9 || !isValidPlacement(g, empty.row, empty.col, answer)) {
        return null
      }
      step = { row: empty.row, col: empty.col, value: answer, reason: 'uniqueSolution' }
    } else {
      const answer = solution[step.row]![step.col]!
      if (step.value !== answer) {
        step = { row: step.row, col: step.col, value: answer, reason: 'uniqueSolution' }
      }
    }

    g[step.row]![step.col] = step.value
    path.push(step)
  }

  return path
}
