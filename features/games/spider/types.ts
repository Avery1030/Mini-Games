export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs'
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13
export type Difficulty = 1 | 2 | 3 | 4

export const DIFFICULTIES: readonly Difficulty[] = [1, 2, 3, 4]
export const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']

export type Card = {
  id: number
  suit: Suit
  rank: Rank
  faceUp: boolean
}

export type SpiderState = {
  tableau: Card[][]
  stock: Card[]
  completed: Suit[]
  moves: number
  score: number
  difficulty: Difficulty
  won: boolean
  lost: boolean
}

export type HintMove = {
  fromCol: number
  fromIndex: number
  toCol: number
}

export const COLS = 10
export const RUN_LEN = 13
/** 完整 A–K 组数（也是通关所需收牌次数） */
export const COMPLETE_RUNS = 12
export const TOTAL_CARDS = COMPLETE_RUNS * RUN_LEN
export const DEAL_SIZE = 10
export const START_SCORE = 500
export const COMPLETE_BONUS = 100
/** 各难度通关用时榜保留条数 */
export const TOP_RECORDS = 5

/** 单条通关成绩（按用时排名） */
export type SpiderTimeRecord = {
  elapsed: number
  moves: number
  score: number
  /** 入榜时间戳，用于去重与高亮本局 */
  at: number
}
