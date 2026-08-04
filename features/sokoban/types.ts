/** 《推箱子》类型 */

export type CellPos = {
  x: number
  y: number
}

/** 关卡条目；地图为行字符串数组（定义于 levels.ts） */
export type LevelJsonEntry = {
  id: number
  map: string[]
}

export type LevelData = {
  map: string[]
  width: number
  height: number
  playerStart: CellPos
  boxes: CellPos[]
  targets: CellPos[]
  walls: CellPos[]
  /** 地图外侧空地（不可走、不绘地板） */
  voids: CellPos[]
}

export type Direction = 'up' | 'down' | 'left' | 'right'

export type MoveSnapshot = {
  player: CellPos
  boxes: CellPos[]
}

export type SokobanState = {
  levelId: number
  level: LevelData
  player: CellPos
  boxes: CellPos[]
  moves: number
  undoStack: MoveSnapshot[]
  won: boolean
}

export const DIR_DELTA: Record<Direction, CellPos> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export function posKey(p: CellPos): string {
  return `${p.x},${p.y}`
}

export function samePos(a: CellPos, b: CellPos): boolean {
  return a.x === b.x && a.y === b.y
}
