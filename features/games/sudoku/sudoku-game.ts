/**
 * 数独游戏逻辑：从关卡加载题目，填数 / 备注 / 提示 / 撤回 / 暂停 / 破解（整盘答案或逐步填入）
 */

import type { Cell, CrackStep, GameStatus, LevelData, Position, SudokuState } from './types'
import { findHintStep } from './solver'

const SIZE = 9
const BOX = 3

/** 每关提示可用次数 */
export const MAX_HINTS = 3

type Snapshot = {
  board: Cell[][]
  selected: Nullable<Position>
  notesMode: boolean
  moves: number
  mistakes: number
  hintsUsed: number
  status: GameStatus
}

function emptyNotes(): number[] {
  return []
}

function createBoardFromLevel(level: LevelData): Cell[][] {
  const board: Cell[][] = []
  for (let r = 0; r < SIZE; r++) {
    const row: Cell[] = []
    for (let c = 0; c < SIZE; c++) {
      const v = level.puzzle[r]![c]!
      row.push({ row: r, col: c, value: v, given: v !== 0, notes: emptyNotes() })
    }
    board.push(row)
  }
  return board
}

function cloneBoard(board: Cell[][]): Cell[][] {
  return board.map((row) => row.map((cell) => ({ ...cell, notes: [...cell.notes] })))
}

function countEmpty(board: Cell[][]): number {
  return board.flat().filter((c) => c.value === 0).length
}

function isBoardSolved(board: Cell[][], solution: number[][]): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r]![c]!.value !== solution[r]![c]!) return false
    }
  }
  return true
}

function boardToGrid(board: Cell[][]): number[][] {
  return board.map((row) => row.map((c) => c.value))
}

export function hasConflict(board: Cell[][], row: number, col: number, value: number): boolean {
  if (value === 0) return false
  for (let i = 0; i < SIZE; i++) {
    if (i !== col && board[row]![i]!.value === value) return true
    if (i !== row && board[i]![col]!.value === value) return true
  }
  const br = Math.floor(row / BOX) * BOX
  const bc = Math.floor(col / BOX) * BOX
  for (let r = br; r < br + BOX; r++) {
    for (let c = bc; c < bc + BOX; c++) {
      if ((r !== row || c !== col) && board[r]![c]!.value === value) return true
    }
  }
  return false
}

export function isCellConflicted(board: Cell[][], row: number, col: number): boolean {
  const v = board[row]![col]!.value
  return v !== 0 && hasConflict(board, row, col, v)
}

function sameBox(a: Position, b: Position): boolean {
  return Math.floor(a.row / BOX) === Math.floor(b.row / BOX) && Math.floor(a.col / BOX) === Math.floor(b.col / BOX)
}

export function isPeer(selected: Nullable<Position>, row: number, col: number): boolean {
  if (!selected) return false
  if (selected.row === row && selected.col === col) return false
  return selected.row === row || selected.col === col || sameBox(selected, { row, col })
}

/** 该空格是否为所在行 / 列 / 宫的唯一空格 */
export function isUniqueEmptyInUnit(board: Cell[][], row: number, col: number): boolean {
  if (board[row]![col]!.value !== 0) return false

  let rowEmpty = 0
  let colEmpty = 0
  for (let i = 0; i < SIZE; i++) {
    if (board[row]![i]!.value === 0) rowEmpty++
    if (board[i]![col]!.value === 0) colEmpty++
  }
  if (rowEmpty === 1 || colEmpty === 1) return true

  const br = Math.floor(row / BOX) * BOX
  const bc = Math.floor(col / BOX) * BOX
  let boxEmpty = 0
  for (let r = br; r < br + BOX; r++) {
    for (let c = bc; c < bc + BOX; c++) {
      if (board[r]![c]!.value === 0) boxEmpty++
    }
  }
  return boxEmpty === 1
}

function clearPeerNotes(board: Cell[][], row: number, col: number, digit: number): void {
  for (let i = 0; i < SIZE; i++) {
    board[row]![i]!.notes = board[row]![i]!.notes.filter((n) => n !== digit)
    board[i]![col]!.notes = board[i]![col]!.notes.filter((n) => n !== digit)
  }
  const br = Math.floor(row / BOX) * BOX
  const bc = Math.floor(col / BOX) * BOX
  for (let r = br; r < br + BOX; r++) {
    for (let c = bc; c < bc + BOX; c++) {
      board[r]![c]!.notes = board[r]![c]!.notes.filter((n) => n !== digit)
    }
  }
}

function formatElapsed(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

export { formatElapsed }

export class SudokuGame {
  private level: LevelData
  private board: Cell[][]
  private solution: number[][]
  private status: GameStatus = 'playing'
  private selected: Nullable<Position> = null
  private notesMode = false
  private paused = false
  private startTime: Nullable<number> = null
  /** 当前计时段开始时已累计的秒数 */
  private elapsedBase = 0
  private moves = 0
  private mistakes = 0
  private hintsUsed = 0
  private timerId: number | undefined
  private undoStack: Snapshot[] = []
  private onStateChange: (state: SudokuState) => void

  constructor(level: LevelData, onStateChange: (state: SudokuState) => void) {
    this.level = level
    this.onStateChange = onStateChange
    this.board = createBoardFromLevel(level)
    this.solution = level.solution.map((r) => r.slice())
    this.startTime = Date.now()
    this.elapsedBase = 0
    this.startTimer()
    this.emit()
  }

  loadLevel(level: LevelData): void {
    this.clearTimer()
    this.level = level
    this.board = createBoardFromLevel(level)
    this.solution = level.solution.map((r) => r.slice())
    this.status = 'playing'
    this.selected = null
    this.notesMode = false
    this.paused = false
    this.elapsedBase = 0
    this.moves = 0
    this.mistakes = 0
    this.hintsUsed = 0
    this.undoStack = []
    this.startTime = Date.now()
    this.startTimer()
    this.emit()
  }

  reset(): void {
    this.loadLevel(this.level)
  }

  destroy(): void {
    this.clearTimer()
  }

  getBoardGrid(): number[][] {
    return boardToGrid(this.board)
  }

  getSolution(): number[][] {
    return this.solution.map((r) => r.slice())
  }

  selectCell(row: number, col: number): void {
    if (this.paused || this.status === 'won' || this.status === 'lost') return
    if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return
    this.selected = { row, col }
    this.emit()
  }

  toggleNotesMode(): void {
    if (this.paused || this.status !== 'playing') return
    this.notesMode = !this.notesMode
    this.emit()
  }

  pause(): void {
    if (this.status !== 'playing' || this.paused) return
    this.elapsedBase = this.currentElapsed()
    this.paused = true
    this.clearTimer()
    this.emit()
  }

  resume(): void {
    if (this.status !== 'playing' || !this.paused) return
    this.paused = false
    this.startTime = Date.now()
    this.startTimer()
    this.emit()
  }

  togglePause(): void {
    if (this.paused) this.resume()
    else this.pause()
  }

  private pushUndo(): void {
    this.undoStack.push({
      board: cloneBoard(this.board),
      selected: this.selected ? { ...this.selected } : null,
      notesMode: this.notesMode,
      moves: this.moves,
      mistakes: this.mistakes,
      hintsUsed: this.hintsUsed,
      status: this.status,
    })
    if (this.undoStack.length > 80) this.undoStack.shift()
  }

  undo(): void {
    if (this.paused || this.status === 'won') return
    this.restoreUndoSnapshot()
  }

  /** 破解回退：允许在已通关时撤回上一步填入 */
  undoCrackStep(): boolean {
    if (this.paused) return false
    return this.restoreUndoSnapshot()
  }

  private restoreUndoSnapshot(): boolean {
    const snap = this.undoStack.pop()
    if (!snap) return false
    this.board = cloneBoard(snap.board)
    this.selected = snap.selected ? { ...snap.selected } : null
    this.notesMode = snap.notesMode
    this.moves = snap.moves
    this.mistakes = snap.mistakes
    this.hintsUsed = snap.hintsUsed
    this.status = snap.status === 'lost' ? 'playing' : snap.status
    if (this.status === 'playing' && !this.paused && this.timerId == null) {
      this.startTime = Date.now()
      this.startTimer()
    }
    this.emit()
    return true
  }

  /** 填入数字；digit 0 表示清除 */
  setValue(digit: number, opts?: { autoClearNotes?: boolean; autoUndoWrong?: boolean }): void {
    if (this.paused || this.status !== 'playing') return
    if (!this.selected) return
    const { row, col } = this.selected
    const cell = this.board[row]![col]!
    if (cell.given) return
    if (digit < 0 || digit > 9) return

    if (this.notesMode && digit !== 0) {
      this.pushUndo()
      const set = new Set(cell.notes)
      if (set.has(digit)) set.delete(digit)
      else set.add(digit)
      cell.notes = [...set].sort((a, b) => a - b)
      cell.value = 0
      this.emit()
      return
    }

    if (digit === 0) {
      if (cell.value === 0 && cell.notes.length === 0) return
      this.pushUndo()
      cell.value = 0
      cell.notes = emptyNotes()
      this.emit()
      return
    }

    this.pushUndo()
    this.moves++
    cell.notes = emptyNotes()
    cell.value = digit

    if (digit !== this.solution[row]![col]!) {
      this.mistakes++
      if (opts?.autoUndoWrong) {
        cell.value = 0
      }
      this.emit()
      return
    }

    if (opts?.autoClearNotes !== false) {
      clearPeerNotes(this.board, row, col, digit)
    }

    if (isBoardSolved(this.board, this.solution)) {
      this.status = 'won'
      this.clearTimer()
    }
    this.emit()
  }

  applyHint(opts?: { smart?: boolean; autoClearNotes?: boolean }): Nullable<CrackStep> {
    if (this.paused || this.status !== 'playing') return null
    if (this.hintsUsed >= MAX_HINTS) return null

    let step: Nullable<CrackStep> = null
    if (opts?.smart) {
      step = findHintStep(boardToGrid(this.board), this.solution)
    }

    let target = step ? { row: step.row, col: step.col } : this.selected
    if (!target || this.board[target.row]![target.col]!.given || this.board[target.row]![target.col]!.value !== 0) {
      const empties = this.board.flat().filter((c) => !c.given && c.value === 0)
      if (empties.length === 0) return null
      const pick = empties[Math.floor(Math.random() * empties.length)]!
      target = { row: pick.row, col: pick.col }
      step = null
    }

    this.pushUndo()
    this.selected = target
    this.notesMode = false
    const answer = this.solution[target.row]![target.col]!
    const cell = this.board[target.row]![target.col]!
    cell.value = answer
    cell.notes = emptyNotes()
    this.hintsUsed++
    this.moves++
    if (opts?.autoClearNotes !== false) {
      clearPeerNotes(this.board, target.row, target.col, answer)
    }
    if (isBoardSolved(this.board, this.solution)) {
      this.status = 'won'
      this.clearTimer()
    }
    this.emit()
    return step ?? { row: target.row, col: target.col, value: answer, reason: 'uniqueSolution' }
  }

  /** 破解演示：强制填入一步正确解 */
  applyCrackStep(step: CrackStep): void {
    if (this.status === 'won' || this.status === 'lost') return
    if (this.paused) this.resume()
    const cell = this.board[step.row]![step.col]!
    if (cell.given) return
    this.pushUndo()
    this.selected = { row: step.row, col: step.col }
    this.notesMode = false
    cell.value = step.value
    cell.notes = emptyNotes()
    this.moves++
    clearPeerNotes(this.board, step.row, step.col, step.value)
    if (isBoardSolved(this.board, this.solution)) {
      this.status = 'won'
      this.clearTimer()
    }
    this.emit()
  }

  /** 破解：直接填入完整答案 */
  applyCrackSolution(): void {
    if (this.status === 'won' || this.status === 'lost') return
    if (this.paused) this.resume()
    this.pushUndo()
    this.notesMode = false
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = this.board[r]![c]!
        if (cell.given) continue
        const answer = this.solution[r]![c]!
        if (cell.value === answer) continue
        cell.value = answer
        cell.notes = emptyNotes()
        this.moves++
      }
    }
    this.status = 'won'
    this.clearTimer()
    this.emit()
  }

  private currentElapsed(): number {
    if (this.paused || this.startTime == null) return this.elapsedBase
    return this.elapsedBase + Math.floor((Date.now() - this.startTime) / 1000)
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

  getState(): SudokuState {
    const elapsed = this.currentElapsed()
    const selectedCell = this.selected ? this.board[this.selected.row]![this.selected.col]! : null
    return {
      levelId: this.level.id,
      difficulty: this.level.difficulty,
      board: cloneBoard(this.board),
      solution: this.solution.map((r) => r.slice()),
      status: this.status,
      selected: this.selected,
      highlightDigit: selectedCell?.value ?? 0,
      notesMode: this.notesMode,
      paused: this.paused,
      startTime: this.startTime,
      elapsed,
      moves: this.moves,
      mistakes: this.mistakes,
      hintsUsed: this.hintsUsed,
      remainingEmpty: countEmpty(this.board),
      minMoves: this.level.minMoves,
      canUndo: this.undoStack.length > 0,
    }
  }

  private emit(): void {
    this.onStateChange(this.getState())
  }
}
