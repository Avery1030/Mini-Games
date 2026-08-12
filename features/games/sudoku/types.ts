/** 《数独》类型 */

export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert'

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard', 'expert'] as const

/**
 * 关卡条目（写在 levels.ts，按难度分表）。
 * 仅含题目；答案由求解器在加载时计算，不在配置里预设。
 */
export type LevelJsonEntry = {
  /** 难度内从 1 起的关卡号 */
  id: number
  /** 9 行字符串：'.' 空格，'1'-'9' 线索 */
  puzzle: string[]
}

export type LevelData = {
  id: number
  difficulty: Difficulty
  puzzle: number[][]
  /** 加载时求解得到的唯一解 */
  solution: number[][]
  clues: number
  /** 最少填数步数 = 开局空格数（完美通关步数） */
  minMoves: number
}

export type Cell = {
  row: number
  col: number
  value: number
  given: boolean
  notes: number[]
}

export type Position = { row: number; col: number }

/** 破解逐步推导的依据类型 */
export type CrackReasonKind =
  | 'nakedSingle'
  | 'hiddenSingleRow'
  | 'hiddenSingleCol'
  | 'hiddenSingleBox'
  | 'uniqueSolution'

/** 破解演示的一步：向某格填入正确数字，并附带依据 */
export type CrackStep = {
  row: number
  col: number
  value: number
  reason: CrackReasonKind
}

export type CrackMode = 'instant' | 'manual'

export type GameStatus = 'playing' | 'won' | 'lost'

export type SudokuState = {
  levelId: number
  difficulty: Difficulty
  board: Cell[][]
  solution: number[][]
  status: GameStatus
  selected: Position | null
  highlightDigit: number
  notesMode: boolean
  paused: boolean
  startTime: number | null
  elapsed: number
  /** 填数次数（含填错） */
  moves: number
  mistakes: number
  hintsUsed: number
  remainingEmpty: number
  /** 开局空格数（参考最少填数） */
  minMoves: number
  canUndo: boolean
}

export function progressKey(difficulty: Difficulty, levelId: number): string {
  return `${difficulty}:${levelId}`
}
