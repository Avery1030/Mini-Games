/**
 * 扫雷游戏逻辑层：类型、常量、纯函数、MinesweeperGame 类
 * UI 层通过 onStateChange 订阅状态，调用 handleCellClick / handleRightClick 等驱动游戏
 */

export type GameStatus = 'idle' | 'playing' | 'won' | 'lost'

export type Cell = {
  row: number
  col: number
  isMine: boolean
  isRevealed: boolean
  isFlagged: boolean
  adjacentMines: number
}

export type Position = { row: number; col: number }

export type GameState = {
  board: Cell[][]
  status: GameStatus
  message: string
  startTime: number | null
  elapsed: number
  remainingMines: number
  rows: number
  cols: number
  mines: number
  totalSafe: number
  highlightCells: Position[]
  explodedCell: Position | null
}

type DeterministicMoves = { safe: Position[]; mines: Position[] }

const MAX_GENERATION_ATTEMPTS = 25
const MAX_SEARCH_NODES = 80_000
const FIRST_CLICK_MAX_MS = 400
const CHECK_DEADLINE_EVERY_NODES = 5000

export type Difficulty = 'basic' | 'intermediate' | 'expert' | 'fullscreen' | 'custom'

export const PRESETS: Record<Exclude<Difficulty, 'custom'>, { rows: number; cols: number; mines: number }> = {
  basic: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
  fullscreen: { rows: 32, cols: 32, mines: 250 },
}

function createEmptyBoard(rows: number, cols: number): Cell[][] {
  const board: Cell[][] = []
  for (let r = 0; r < rows; r++) {
    const row: Cell[] = []
    for (let c = 0; c < cols; c++) {
      row.push({
        row: r,
        col: c,
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        adjacentMines: 0,
      })
    }
    board.push(row)
  }
  return board
}

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => row.map((cell) => ({ ...cell })))
}

function inBounds(rows: number, cols: number, row: number, col: number) {
  return row >= 0 && row < rows && col >= 0 && col < cols
}

function getNeighbors(board: Cell[][], row: number, col: number): Cell[] {
  const rows = board.length
  const cols = board[0]?.length ?? 0
  const result: Cell[] = []
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = row + dr
      const nc = col + dc
      if (inBounds(rows, cols, nr, nc)) result.push(board[nr][nc])
    }
  }
  return result
}

function placeMines(board: Cell[][], mineCount: number, forbidden: Set<string>) {
  const rows = board.length
  const cols = board[0]?.length ?? 0
  const allPositions: Position[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!forbidden.has(`${r},${c}`)) allPositions.push({ row: r, col: c })
    }
  }
  for (let i = allPositions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]]
  }
  allPositions.slice(0, mineCount).forEach(({ row, col }) => {
    board[row][col].isMine = true
  })
}

function calculateNumbers(board: Cell[][]) {
  const rows = board.length
  const cols = board[0]?.length ?? 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[r][c]
      if (cell.isMine) continue
      cell.adjacentMines = getNeighbors(board, r, c).filter((n) => n.isMine).length
    }
  }
}

function revealFlood(board: Cell[][], startRow: number, startCol: number): number {
  const rows = board.length
  const cols = board[0]?.length ?? 0
  const queue: Position[] = []
  let revealedCount = 0
  const start = board[startRow][startCol]
  if (start.isRevealed || start.isMine) return 0
  queue.push({ row: startRow, col: startCol })
  while (queue.length > 0) {
    const { row, col } = queue.shift()!
    const cell = board[row][col]
    if (cell.isRevealed || cell.isMine) continue
    cell.isRevealed = true
    revealedCount++
    if (cell.adjacentMines === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = row + dr
          const nc = col + dc
          if (!inBounds(rows, cols, nr, nc)) continue
          const neighbor = board[nr][nc]
          if (!neighbor.isRevealed && !neighbor.isMine) queue.push({ row: nr, col: nc })
        }
      }
    }
  }
  return revealedCount
}

type Constraint = { indices: number[]; mines: number }

function getDeterministicMoves(board: Cell[][], deadline?: number): DeterministicMoves {
  const rows = board.length
  const cols = board[0]?.length ?? 0
  const frontier: Position[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[r][c]
      if (!cell.isRevealed || cell.adjacentMines === 0) continue
      const neighbors = getNeighbors(board, r, c)
      if (neighbors.some((n) => !n.isRevealed && !n.isFlagged)) frontier.push({ row: r, col: c })
    }
  }
  if (frontier.length === 0) return { safe: [], mines: [] }

  const vars: Position[] = []
  const varIndexMap = new Map<string, number>()
  const ensureVar = (row: number, col: number) => {
    const key = `${row},${col}`
    if (varIndexMap.has(key)) return varIndexMap.get(key)!
    const index = vars.length
    vars.push({ row, col })
    varIndexMap.set(key, index)
    return index
  }

  const constraints: Constraint[] = []
  for (const { row, col } of frontier) {
    const cell = board[row][col]
    const neighbors = getNeighbors(board, row, col)
    const hiddenNeighbors = neighbors.filter((n) => !n.isRevealed && !n.isFlagged)
    const minesNeeded = cell.adjacentMines - neighbors.filter((n) => n.isFlagged).length
    if (hiddenNeighbors.length === 0 || minesNeeded < 0 || minesNeeded > hiddenNeighbors.length) continue
    const indices = hiddenNeighbors.map((n) => ensureVar(n.row, n.col))
    constraints.push({ indices, mines: minesNeeded })
  }

  if (constraints.length === 0 || vars.length === 0) return { safe: [], mines: [] }

  const varToConstraints: number[][] = Array.from({ length: vars.length }, () => [])
  constraints.forEach((c, ci) => c.indices.forEach((vi) => varToConstraints[vi].push(ci)))

  const assignments: boolean[][] = []
  const current: boolean[] = Array(vars.length).fill(false)
  const assignedMinesPerConstraint = new Array(constraints.length).fill(0)
  const unassignedPerConstraint = constraints.map((c) => c.indices.length)
  let explored = 0
  let aborted = false

  const dfs = (varIdx: number) => {
    if (aborted) return
    if (
      explored > MAX_SEARCH_NODES ||
      (deadline != null && explored > 0 && explored % CHECK_DEADLINE_EVERY_NODES === 0 && Date.now() > deadline)
    ) {
      aborted = true
      return
    }
    if (varIdx === vars.length) {
      if (constraints.every((c, ci) => assignedMinesPerConstraint[ci] === c.mines)) assignments.push(current.slice())
      return
    }
    const affected = varToConstraints[varIdx]
    for (const val of [false, true]) {
      current[varIdx] = val
      const prevA = assignedMinesPerConstraint.slice()
      const prevU = unassignedPerConstraint.slice()
      let ok = true
      for (const ci of affected) {
        unassignedPerConstraint[ci]--
        if (val) assignedMinesPerConstraint[ci]++
        const need = constraints[ci].mines
        const a = assignedMinesPerConstraint[ci]
        const u = unassignedPerConstraint[ci]
        if (a > need || a + u < need) {
          ok = false
          break
        }
      }
      if (ok) {
        explored++
        dfs(varIdx + 1)
      }
      affected.forEach((ci) => {
        assignedMinesPerConstraint[ci] = prevA[ci]
        unassignedPerConstraint[ci] = prevU[ci]
      })
      if (aborted) return
    }
  }
  dfs(0)

  if (aborted || assignments.length === 0) return { safe: [], mines: [] }
  const safe: Position[] = []
  const mines: Position[] = []
  for (let i = 0; i < vars.length; i++) {
    const alwaysSafe = assignments.every((a) => !a[i])
    const alwaysMine = assignments.every((a) => a[i])
    if (alwaysSafe) safe.push(vars[i])
    else if (alwaysMine) mines.push(vars[i])
  }
  return { safe, mines }
}

function canSolveWithoutGuess(board: Cell[][], firstClick: Position, totalMines: number, deadline?: number): boolean {
  const working = cloneBoard(board)
  const rows = working.length
  const cols = working[0]?.length ?? 0
  const totalSafe = rows * cols - totalMines
  if (working[firstClick.row][firstClick.col].isMine) return false
  let revealedSafe = revealFlood(working, firstClick.row, firstClick.col)
  const maxSteps = Math.min(rows * cols * 2, 300)
  for (let step = 0; step < maxSteps; step++) {
    if (deadline != null && Date.now() > deadline) return false
    const { safe, mines } = getDeterministicMoves(working, deadline)
    if (safe.length === 0 && mines.length === 0) break
    for (const { row, col } of safe) {
      const cell = working[row][col]
      if (!cell.isRevealed && !cell.isMine) revealedSafe += revealFlood(working, row, col)
    }
    for (const { row, col } of mines) {
      const cell = working[row][col]
      if (!cell.isFlagged) cell.isFlagged = true
    }
  }
  return revealedSafe === totalSafe
}

function generateNoGuessBoard(
  rows: number,
  cols: number,
  mines: number,
  firstClick: Position,
  deadlineMs = FIRST_CLICK_MAX_MS,
): Cell[][] {
  const forbidden = new Set<string>()
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = firstClick.row + dr
      const c = firstClick.col + dc
      if (inBounds(rows, cols, r, c)) forbidden.add(`${r},${c}`)
    }
  }
  let lastBoard: Cell[][] | null = null
  const deadline = Date.now() + deadlineMs
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    if (Date.now() > deadline) break
    const board = createEmptyBoard(rows, cols)
    placeMines(board, mines, forbidden)
    calculateNumbers(board)
    lastBoard = board
    if (canSolveWithoutGuess(board, firstClick, mines, deadline)) return board
  }
  return lastBoard ?? createEmptyBoard(rows, cols)
}

function countFlags(board: Cell[][]): number {
  return board.flat().filter((c) => c.isFlagged).length
}

function countRevealedSafe(board: Cell[][]): number {
  return board.flat().filter((c) => c.isRevealed && !c.isMine).length
}

function applyAutoFlagMines(board: Cell[][]): void {
  const rows = board.length
  const cols = board[0]?.length ?? 0
  let changed = true
  while (changed) {
    changed = false
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = board[r][c]
        if (!cell.isRevealed || cell.adjacentMines === 0) continue
        const neighbors = getNeighbors(board, r, c)
        const unrevealed = neighbors.filter((n) => !n.isRevealed && !n.isFlagged)
        const flaggedCount = neighbors.filter((n) => n.isFlagged).length
        if (unrevealed.length > 0 && unrevealed.length === cell.adjacentMines - flaggedCount) {
          unrevealed.forEach((n) => {
            n.isFlagged = true
            changed = true
          })
        }
      }
    }
  }
}

export class MinesweeperGame {
  private board: Cell[][] = []
  private status: GameStatus = 'idle'
  private message = '点击任意格子开始，一局保证可用逻辑解完。'
  private startTime: number | null = null
  private highlightCells: Position[] = []
  private explodedCell: Position | null = null
  private rows: number
  private cols: number
  private mines: number
  private timerId: number | undefined
  private onStateChange: (state: GameState) => void

  constructor(config: { rows: number; cols: number; mines: number }, onStateChange: (state: GameState) => void) {
    this.rows = config.rows
    this.cols = config.cols
    this.mines = config.mines
    this.onStateChange = onStateChange
    this.board = createEmptyBoard(config.rows, config.cols)
    this.timerId = undefined
    this.emit()
  }

  setDimensions(rows: number, cols: number, mines: number): void {
    this.rows = rows
    this.cols = cols
    this.mines = mines
    this.board = createEmptyBoard(rows, cols)
    this.status = 'idle'
    this.message = '点击任意格子开始，一局保证可用逻辑解完。'
    this.startTime = null
    this.highlightCells = []
    this.explodedCell = null
    this.clearTimer()
    this.emit()
  }

  clearHighlight(): void {
    this.highlightCells = []
    this.emit()
  }

  reset(): void {
    this.setDimensions(this.rows, this.cols, this.mines)
  }

  destroy(): void {
    this.clearTimer()
  }

  applyLogicStep(): void {
    if (this.status !== 'playing') return
    const working = cloneBoard(this.board)
    const { safe, mines: minePositions } = getDeterministicMoves(working)
    if (safe.length === 0 && minePositions.length === 0) {
      this.message = '当前局面已用尽所有确定性推理，理论上这里可能需要猜测。'
      this.emit()
      return
    }
    let changed = false
    for (const { row, col } of safe) {
      const cell = working[row][col]
      if (!cell.isRevealed && !cell.isMine) {
        revealFlood(working, row, col)
        changed = true
      }
    }
    for (const { row, col } of minePositions) {
      const cell = working[row][col]
      if (!cell.isFlagged) {
        cell.isFlagged = true
        changed = true
      }
    }
    if (!changed) {
      this.message = '逻辑助手尝试了一步，但局面未发生变化。'
      this.emit()
      return
    }
    this.board = working
    const totalSafe = this.rows * this.cols - this.mines
    if (countRevealedSafe(working) === totalSafe) {
      this.status = 'won'
      this.message = '恭喜，无猜通关！'
      this.clearTimer()
    } else {
      this.message = '已自动应用一轮确定性逻辑。'
    }
    this.emit()
  }

  handleRightClick(row: number, col: number): void {
    if (this.status !== 'playing' && this.status !== 'idle') return
    if (this.status === 'idle') return
    const cell = this.board[row][col]
    if (cell.isRevealed) return
    const wasFlagged = cell.isFlagged
    cell.isFlagged = !cell.isFlagged
    // 只有用户插旗时才跑自动标雷，取消标雷时不再自动标回去
    if (!wasFlagged) applyAutoFlagMines(this.board)
    this.emit()
  }

  handleCellClick(row: number, col: number): void {
    if (this.status === 'lost' || this.status === 'won') return

    const cell = this.board[row][col]

    if (cell.isRevealed && cell.adjacentMines > 0) {
      const neighbors = getNeighbors(this.board, row, col)
      const flaggedCount = neighbors.filter((n) => n.isFlagged).length
      if (flaggedCount !== cell.adjacentMines) {
        this.highlightCells = neighbors
          .filter((n) => !n.isRevealed && !n.isFlagged)
          .map((n) => ({ row: n.row, col: n.col }))
        this.emit()
        return
      }
      for (const n of neighbors) {
        if (n.isRevealed || n.isFlagged) continue
        if (n.isMine) {
          n.isRevealed = true
          this.status = 'lost'
          this.message = '很遗憾，这局还是踩雷了（不过理论上是可以无猜通关的）'
          this.explodedCell = { row: n.row, col: n.col }
          this.board.flat().forEach((c) => {
            if (c.isMine) c.isRevealed = true
          })
          this.clearTimer()
          this.emit()
          return
        }
        revealFlood(this.board, n.row, n.col)
      }
      const totalSafe = this.rows * this.cols - this.mines
      if (countRevealedSafe(this.board) === totalSafe) {
        this.status = 'won'
        this.message = '恭喜，无猜通关！'
        this.clearTimer()
      } else {
        this.message = '逻辑可解局面已生成，祝你好运！'
      }
      applyAutoFlagMines(this.board)
      this.emit()
      return
    }

    if (cell.isRevealed || cell.isFlagged) return

    if (this.status === 'idle') {
      this.board = generateNoGuessBoard(this.rows, this.cols, this.mines, { row, col })
      this.status = 'playing'
      this.message = '逻辑可解局面已生成，祝你好运！'
      this.startTime = Date.now()
      this.startTimer()
    }

    const clicked = this.board[row][col]
    if (clicked.isMine) {
      clicked.isRevealed = true
      this.status = 'lost'
      this.message = '很遗憾，这局还是踩雷了（不过理论上是可以无猜通关的）'
      this.explodedCell = { row, col }
      this.board.flat().forEach((c) => {
        if (c.isMine) c.isRevealed = true
      })
      this.clearTimer()
      this.emit()
      return
    }

    revealFlood(this.board, row, col)
    applyAutoFlagMines(this.board)
    const totalSafe = this.rows * this.cols - this.mines
    if (countRevealedSafe(this.board) === totalSafe) {
      this.status = 'won'
      this.message = '恭喜，无猜通关！'
      this.clearTimer()
    }
    this.emit()
  }

  private startTimer(): void {
    this.clearTimer()
    this.timerId = window.setInterval(() => this.emit(), 1000) as unknown as number
  }

  clearTimer(): void {
    if (this.timerId != null) {
      window.clearInterval(this.timerId)
      this.timerId = undefined
    }
  }

  getState(): GameState {
    const elapsed = this.startTime != null ? Math.floor((Date.now() - this.startTime) / 1000) : 0
    const remainingMines = this.mines - countFlags(this.board)
    const totalSafe = this.rows * this.cols - this.mines
    return {
      board: this.board,
      status: this.status,
      message: this.message,
      startTime: this.startTime,
      elapsed,
      remainingMines,
      rows: this.rows,
      cols: this.cols,
      mines: this.mines,
      totalSafe,
      highlightCells: this.highlightCells,
      explodedCell: this.explodedCell,
    }
  }

  private emit(): void {
    this.onStateChange(this.getState())
  }
}

/** 用于 UI 的初始状态，不创建游戏实例 */
export function getInitialGameState(config: { rows: number; cols: number; mines: number }): GameState {
  const board = createEmptyBoard(config.rows, config.cols)
  return {
    board,
    status: 'idle',
    message: '点击任意格子开始，一局保证可用逻辑解完。',
    startTime: null,
    elapsed: 0,
    remainingMines: config.mines,
    rows: config.rows,
    cols: config.cols,
    mines: config.mines,
    totalSafe: config.rows * config.cols - config.mines,
    highlightCells: [],
    explodedCell: null,
  }
}
