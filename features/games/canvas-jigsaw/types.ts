/** 《不规则拼图》类型 */

export type Point = {
  x: number
  y: number
}

export interface Piece {
  id: string
  /** 画布当前坐标（本地原点） */
  x: number
  y: number
  /** 正确相对布局参考坐标（用于邻块磁吸差值，非固定落点） */
  targetX: number
  targetY: number
  /** 多边形顶点（相对本地原点） */
  points: Point[]
  width: number
  height: number
  /** 相邻碎片 ID，仅和这些碎片检测磁吸 */
  neighborIds: string[]
  /**
   * 组合 ID：相同 groupId 的碎片视为已合成的大块，一起拖动。
   * 初始为自身 id；邻块磁吸成功后合并。
   */
  groupId: string
}

export type JigsawDifficulty = 'easy' | 'medium' | 'hard'

export type JigsawGrid = {
  cols: number
  rows: number
}

export const JIGSAW_DIFFICULTY: Record<JigsawDifficulty, JigsawGrid> = {
  easy: { cols: 3, rows: 3 },
  medium: { cols: 4, rows: 4 },
  hard: { cols: 5, rows: 5 },
}

export type ImageLoadStatus = 'loading' | 'ready' | 'error'
