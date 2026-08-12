/** 合成大西瓜：11 级水果定义（半径单位为容器坐标系像素） */

export const MAX_FRUIT_LEVEL = 10

export type FruitLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

export type FruitDef = {
  level: FruitLevel
  /** i18n key under suika.fruits.* */
  nameKey: string
  radius: number
  color: string
  /** 纯色圆上的 emoji / 文字 */
  glyph: string
  score: number
}

export const FRUITS: readonly FruitDef[] = [
  { level: 0, nameKey: 'cherry', radius: 14, color: '#e11d48', glyph: '🍒', score: 1 },
  { level: 1, nameKey: 'strawberry', radius: 18, color: '#f43f5e', glyph: '🍓', score: 2 },
  { level: 2, nameKey: 'grape', radius: 24, color: '#9333ea', glyph: '🍇', score: 4 },
  { level: 3, nameKey: 'orange', radius: 30, color: '#f97316', glyph: '🍊', score: 8 },
  { level: 4, nameKey: 'persimmon', radius: 36, color: '#ea580c', glyph: '柿', score: 16 },
  { level: 5, nameKey: 'apple', radius: 44, color: '#ef4444', glyph: '🍎', score: 32 },
  { level: 6, nameKey: 'pear', radius: 52, color: '#84cc16', glyph: '🍐', score: 64 },
  { level: 7, nameKey: 'peach', radius: 60, color: '#fb7185', glyph: '🍑', score: 128 },
  { level: 8, nameKey: 'pineapple', radius: 70, color: '#eab308', glyph: '🍍', score: 256 },
  { level: 9, nameKey: 'melon', radius: 82, color: '#4ade80', glyph: '🍈', score: 512 },
  { level: 10, nameKey: 'watermelon', radius: 96, color: '#16a34a', glyph: '🍉', score: 1024 },
] as const

export function getFruit(level: number): FruitDef {
  const clamped = Math.max(0, Math.min(MAX_FRUIT_LEVEL, Math.floor(level))) as FruitLevel
  return FRUITS[clamped]
}

/** 掉落候选：仅前 5 级随机，偏小水果 */
export function randomDropLevel(rng: () => number = Math.random): FruitLevel {
  const weights = [30, 25, 20, 15, 10]
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = rng() * total
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return i as FruitLevel
  }
  return 0
}
