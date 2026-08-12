import { BLANK, type PuzzleBoard, type PuzzlePos, type PuzzleSize, type PuzzleState } from './types'

/** 创建已归位棋盘（空白在右下） */
export function createSolvedBoard(size: PuzzleSize): PuzzleBoard {
  const board: PuzzleBoard = []
  let n = 0
  for (let r = 0; r < size; r++) {
    const row: number[] = []
    for (let c = 0; c < size; c++) {
      if (r === size - 1 && c === size - 1) row.push(BLANK)
      else {
        row.push(n)
        n += 1
      }
    }
    board.push(row)
  }
  return board
}

/** 查找空白格位置 */
export function findBlank(board: PuzzleBoard): PuzzlePos {
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[r].length; c++) {
      if (board[r][c] === BLANK) return { row: r, col: c }
    }
  }
  throw new Error('[image-puzzle] blank tile missing')
}

/** 是否与空白相邻（上下左右） */
export function canMoveTile(board: PuzzleBoard, row: number, col: number): boolean {
  if (row < 0 || col < 0 || row >= board.length || col >= board[0].length) return false
  if (board[row][col] === BLANK) return false
  const blank = findBlank(board)
  const dr = Math.abs(blank.row - row)
  const dc = Math.abs(blank.col - col)
  return dr + dc === 1
}

/** 交换碎片与空白；不可移动时返回原棋盘 */
export function swapWithBlank(board: PuzzleBoard, row: number, col: number): PuzzleBoard {
  if (!canMoveTile(board, row, col)) return board
  const blank = findBlank(board)
  const next = board.map((r) => r.slice())
  next[blank.row][blank.col] = next[row][col]
  next[row][col] = BLANK
  return next
}

/** 是否全部归位 */
export function isSolved(board: PuzzleBoard): boolean {
  const size = board.length
  let expect = 0
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (r === size - 1 && c === size - 1) {
        if (board[r][c] !== BLANK) return false
      } else if (board[r][c] !== expect) {
        return false
      } else {
        expect += 1
      }
    }
  }
  return true
}

/** 碎片编号对应的正确行列 */
export function tileHome(value: number, size: PuzzleSize): PuzzlePos {
  return { row: Math.floor(value / size), col: value % size }
}

/** 当前位置是否错位（空白不算错位） */
export function isMisplaced(board: PuzzleBoard, row: number, col: number): boolean {
  const v = board[row][col]
  if (v === BLANK) return false
  const home = tileHome(v, board.length as PuzzleSize)
  return home.row !== row || home.col !== col
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]

/**
 * 从已解盘面做合法随机滑动，保证可解。
 */
export function shuffleBoard(size: PuzzleSize, steps?: number): PuzzleBoard {
  const moves = steps ?? size * size * 24
  let board = createSolvedBoard(size)
  let last: PuzzlePos | null = null

  for (let i = 0; i < moves; i++) {
    const blank = findBlank(board)
    const candidates: PuzzlePos[] = []
    for (const [dr, dc] of DIRS) {
      const r = blank.row + dr
      const c = blank.col + dc
      if (r < 0 || c < 0 || r >= size || c >= size) continue
      // 避免立即撤回上一步，减少无效抖动
      if (last && last.row === r && last.col === c) continue
      candidates.push({ row: r, col: c })
    }
    if (candidates.length === 0) {
      last = null
      continue
    }
    const pick = candidates[Math.floor(Math.random() * candidates.length)]
    last = blank
    board = swapWithBlank(board, pick.row, pick.col)
  }

  // 极低概率仍停在已解：再滑一步
  if (isSolved(board)) {
    const blank = findBlank(board)
    for (const [dr, dc] of DIRS) {
      const r = blank.row + dr
      const c = blank.col + dc
      if (r >= 0 && c >= 0 && r < size && c < size) {
        board = swapWithBlank(board, r, c)
        break
      }
    }
  }

  return board
}

export function createInitialState(size: PuzzleSize = 3): PuzzleState {
  return {
    size,
    board: shuffleBoard(size),
    moves: 0,
    status: 'idle',
    startedAt: null,
    elapsedSec: null,
  }
}

/** 尝试移动；返回新状态（不可移动时原样） */
export function tryMove(state: PuzzleState, row: number, col: number, now = Date.now()): PuzzleState {
  if (state.status === 'won') return state
  if (!canMoveTile(state.board, row, col)) return state

  const board = swapWithBlank(state.board, row, col)
  const moves = state.moves + 1
  const startedAt = state.startedAt ?? now
  const won = isSolved(board)

  return {
    ...state,
    board,
    moves,
    startedAt,
    status: won ? 'won' : 'playing',
    elapsedSec: won ? Math.max(0, Math.floor((now - startedAt) / 1000)) : null,
  }
}

export function reshuffle(state: PuzzleState): PuzzleState {
  return {
    ...state,
    board: shuffleBoard(state.size),
    moves: 0,
    status: 'idle',
    startedAt: null,
    elapsedSec: null,
  }
}

export function changeSize(size: PuzzleSize): PuzzleState {
  return createInitialState(size)
}
