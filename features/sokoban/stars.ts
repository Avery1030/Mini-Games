/** 通关星级：相对最短步数 */

export type StarCount = 1 | 2 | 3

/**
 * - 3★：步数 ≤ 最短
 * - 2★：步数 ≤ max(最短+5, ceil(最短×1.5))
 * - 1★：通关即可
 * 最短未知时统一 1★。
 */
export function calcStars(moves: number, minMoves: number | null): StarCount {
  if (moves < 0) return 1
  if (minMoves == null || minMoves <= 0) return 1
  if (moves <= minMoves) return 3
  const twoStarCap = Math.max(minMoves + 5, Math.ceil(minMoves * 1.5))
  if (moves <= twoStarCap) return 2
  return 1
}

export function formatStars(stars: number): string {
  const n = Math.max(0, Math.min(3, Math.floor(stars)))
  return `${'★'.repeat(n)}${'☆'.repeat(3 - n)}`
}
