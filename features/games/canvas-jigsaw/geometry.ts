import type { Point } from './types'

/** 两点距离 */
export function dist(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

/** 射线法：点是否在多边形内（含边界） */
export function pointInPolygon(px: number, py: number, polygon: readonly Point[]): boolean {
  if (polygon.length < 3) return false

  // 先做包围盒快筛
  let minX = polygon[0].x
  let maxX = polygon[0].x
  let minY = polygon[0].y
  let maxY = polygon[0].y
  for (let i = 1; i < polygon.length; i++) {
    const p = polygon[i]
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  if (px < minX || px > maxX || py < minY || py > maxY) return false

  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y

    const denom = yj - yi || 1e-12
    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / denom + xi
    if (intersect) inside = !inside
  }
  return inside
}

/** 将本地多边形平移到画布绝对坐标 */
export function toAbsolutePoints(originX: number, originY: number, local: readonly Point[]): Point[] {
  return local.map((p) => ({ x: p.x + originX, y: p.y + originY }))
}

/** 多边形包围盒 */
export function boundsOf(points: readonly Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = points[0].x
  let maxX = points[0].x
  let minY = points[0].y
  let maxY = points[0].y
  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return { minX, minY, maxX, maxY }
}
