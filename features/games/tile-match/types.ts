/** 《格子消消》类型定义 */

export const SLOT_CAPACITY = 7
export const MATCH_COUNT = 3
/** 适配窄屏：偏小卡面，棋盘可整屏放下 */
export const CARD_WIDTH = 30
export const CARD_HEIGHT = 34

/** 卡牌图案：浅底色 + emoji，避免高饱和满铺刺眼 */
export const PATTERNS = [
  { id: 'apple', emoji: '🍎', color: '#fecaca' },
  { id: 'orange', emoji: '🍊', color: '#fed7aa' },
  { id: 'lemon', emoji: '🍋', color: '#fef08a' },
  { id: 'grape', emoji: '🍇', color: '#e9d5ff' },
  { id: 'berry', emoji: '🍓', color: '#fecdd3' },
  { id: 'peach', emoji: '🍑', color: '#ffe4e6' },
  { id: 'cherry', emoji: '🍒', color: '#fda4af' },
  { id: 'kiwi', emoji: '🥝', color: '#d9f99d' },
  { id: 'banana', emoji: '🍌', color: '#fef9c3' },
  { id: 'melon', emoji: '🍉', color: '#bbf7d0' },
  { id: 'blue', emoji: '🫐', color: '#bfdbfe' },
  { id: 'star', emoji: '⭐', color: '#fde68a' },
] as const

export type PatternId = (typeof PATTERNS)[number]['id']

export type CardStatus = 'board' | 'slot' | 'clearing' | 'removed'

export type GameStatus = 'playing' | 'won' | 'lost'

export type BoardCard = {
  id: string
  pattern: PatternId
  /** 棋盘坐标系像素 */
  x: number
  y: number
  layer: number
  width: number
  height: number
  status: CardStatus
}

export type UndoEntry = {
  cardId: string
  /** 放入槽位前该卡在棋盘上的几何（撤销时还原） */
  boardSnapshot: Pick<BoardCard, 'x' | 'y' | 'layer'>
  /** 放入前的槽位 id 序列 */
  slotBefore: string[]
}

export type TileMatchState = {
  cards: BoardCard[]
  /** 槽位中的卡牌 id（从左到右） */
  slot: string[]
  status: GameStatus
  undoStack: UndoEntry[]
  shuffleLeft: number
  undoLeft: number
  /** 已消除组数 */
  clearedGroups: number
  /** 棋盘剩余卡牌数（board 状态） */
  remaining: number
}

export type Rect = {
  x: number
  y: number
  width: number
  height: number
}

export function getPattern(id: PatternId): (typeof PATTERNS)[number] {
  const found = PATTERNS.find((p) => p.id === id)
  if (!found) return PATTERNS[0]
  return found
}
