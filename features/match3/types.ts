export const TILE_KINDS = ['ruby', 'sapphire', 'emerald', 'topaz', 'amethyst', 'amber'] as const

export type TileKind = (typeof TILE_KINDS)[number]

export type SpecialKind = 'none' | 'lineH' | 'lineV' | 'blast' | 'color'

/** 普通砖 hp=1；加强砖 hp=2（受击一次裂纹） */
export type ObstacleKind = 'brick' | 'brickHard'

export type Obstacle = {
  id: string
  kind: ObstacleKind
  /** 剩余可承受的周围爆炸次数 */
  hp: number
}

export type Cell = {
  id: string
  kind: TileKind
  special: SpecialKind
}

export type Pos = { r: number; c: number }

export type MatchGroup = {
  cells: Pos[]
  kind: TileKind
  /** 生成特殊块时的落点 */
  spawnAt: Pos
  special: SpecialKind
}

export type GameLevel = {
  id: number
  rows: number
  cols: number
  targetScore: number
  maxMoves: number
  /** 使用前 kindCount 种方块 */
  kindCount: number
  /**
   * 障碍布局（可选）。每行一个字符串，长度 = cols，行数 = rows。
   * `.` 空位（生成宝石） / `#` 普通砖 / `H` 加强砖
   */
  layout?: string[]
}

export type GameStatus = 'playing' | 'won' | 'lost'

export type GameState = {
  levelId: number
  board: (Cell | null)[][]
  /** 与棋盘同尺寸；有障碍的格子 board 必为 null */
  obstacles: (Obstacle | null)[][]
  score: number
  movesLeft: number
  status: GameStatus
  selected: Pos | null
  cascade: number
}
