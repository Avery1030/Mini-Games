/** 《图片拼图》类型定义 */

export type PuzzleSize = 3 | 4 | 5

/** 空白格标记 */
export const BLANK = -1

/** 棋盘：二维数组，值为碎片编号（0..n²-2）或 BLANK */
export type PuzzleBoard = number[][]

export type PuzzlePos = {
  row: number
  col: number
}

export type PuzzleStatus = 'idle' | 'playing' | 'won'

export type PuzzleState = {
  size: PuzzleSize
  board: PuzzleBoard
  moves: number
  status: PuzzleStatus
  /** 首次有效移动的时间戳；未开始为 null */
  startedAt: Nullable<number>
  /** 通关耗时（秒）；未通关为 null */
  elapsedSec: Nullable<number>
}

export const PUZZLE_SIZES: readonly PuzzleSize[] = [3, 4, 5] as const
