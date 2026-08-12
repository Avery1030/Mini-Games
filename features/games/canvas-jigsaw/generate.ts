import { boundsOf } from './geometry'
import type { Piece, Point } from './types'

function cellId(row: number, col: number): string {
  return `${row}-${col}`
}

/** +1 / -1：沿边 A→B 的左侧法向凸出或凹入 */
type TabSign = -1 | 1

function randTab(): TabSign {
  return Math.random() < 0.5 ? 1 : -1
}

/**
 * 标准拼图榫头曲线：沿 A→B，按左侧法向凸出(sign=+1)或凹入(sign=-1)。
 * 返回从 A 到 B 的完整点列（含两端），相邻碎片必须共用同一条点列（一方正序、一方逆序）。
 */
function buildTabEdge(ax: number, ay: number, bx: number, by: number, sign: TabSign, tabSize: number): Point[] {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const nx = -uy * sign
  const ny = ux * sign

  const at = (t: number, n: number): Point => ({
    x: ax + ux * len * t + nx * n,
    y: ay + uy * len * t + ny * n,
  })

  return [
    { x: ax, y: ay },
    at(0.28, 0),
    at(0.32, 0),
    at(0.35, tabSize * 0.12),
    at(0.38, tabSize * 0.55),
    at(0.42, tabSize * 0.88),
    at(0.46, tabSize * 0.98),
    at(0.5, tabSize),
    at(0.54, tabSize * 0.98),
    at(0.58, tabSize * 0.88),
    at(0.62, tabSize * 0.55),
    at(0.65, tabSize * 0.12),
    at(0.68, 0),
    at(0.72, 0),
    { x: bx, y: by },
  ]
}

function flatEdge(ax: number, ay: number, bx: number, by: number): Point[] {
  return [
    { x: ax, y: ay },
    { x: bx, y: by },
  ]
}

function appendEdge(path: Point[], edge: readonly Point[]): void {
  for (let i = 1; i < edge.length; i++) {
    path.push(edge[i])
  }
}

/**
 * 分割图片为互不重叠、榫卯完全互补的拼图片。
 */
export function generatePieces(
  boardW: number,
  boardH: number,
  cols: number,
  rows: number,
  originX: number,
  originY: number,
): Piece[] {
  const cellW = boardW / cols
  const cellH = boardH / rows
  const tabSize = Math.min(cellW, cellH) * 0.2

  const horizontal: Point[][][] = []
  for (let r = 0; r < rows - 1; r++) {
    const edges: Point[][] = []
    for (let c = 0; c < cols; c++) {
      const bulgeDown = randTab()
      const x0 = originX + c * cellW
      const x1 = x0 + cellW
      const y = originY + (r + 1) * cellH
      edges.push(buildTabEdge(x0, y, x1, y, (-bulgeDown) as TabSign, tabSize))
    }
    horizontal.push(edges)
  }

  const vertical: Point[][][] = []
  for (let r = 0; r < rows; r++) {
    const edges: Point[][] = []
    for (let c = 0; c < cols - 1; c++) {
      const bulgeRight = randTab()
      const x = originX + (c + 1) * cellW
      const y0 = originY + r * cellH
      const y1 = y0 + cellH
      edges.push(buildTabEdge(x, y0, x, y1, bulgeRight, tabSize))
    }
    vertical.push(edges)
  }

  const pieces: Piece[] = []

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = originX + c * cellW
      const y0 = originY + r * cellH
      const x1 = x0 + cellW
      const y1 = y0 + cellH

      const top = r === 0 ? flatEdge(x0, y0, x1, y0) : horizontal[r - 1][c]
      const right = c === cols - 1 ? flatEdge(x1, y0, x1, y1) : vertical[r][c]
      const bottom =
        r === rows - 1 ? flatEdge(x1, y1, x0, y1) : horizontal[r][c].slice().reverse()
      const left = c === 0 ? flatEdge(x0, y1, x0, y0) : vertical[r][c - 1].slice().reverse()

      const absPoints: Point[] = [{ x: x0, y: y0 }]
      appendEdge(absPoints, top)
      appendEdge(absPoints, right)
      appendEdge(absPoints, bottom)
      appendEdge(absPoints, left)

      if (absPoints.length > 1) {
        const last = absPoints[absPoints.length - 1]
        const first = absPoints[0]
        if (Math.abs(last.x - first.x) < 1e-6 && Math.abs(last.y - first.y) < 1e-6) {
          absPoints.pop()
        }
      }

      const box = boundsOf(absPoints)
      const targetX = box.minX
      const targetY = box.minY
      const width = box.maxX - box.minX
      const height = box.maxY - box.minY
      const points = absPoints.map((p) => ({ x: p.x - targetX, y: p.y - targetY }))
      const id = cellId(r, c)

      const neighborIds: string[] = []
      if (r > 0) neighborIds.push(cellId(r - 1, c))
      if (r < rows - 1) neighborIds.push(cellId(r + 1, c))
      if (c > 0) neighborIds.push(cellId(r, c - 1))
      if (c < cols - 1) neighborIds.push(cellId(r, c + 1))

      pieces.push({
        id,
        x: targetX,
        y: targetY,
        targetX,
        targetY,
        points,
        width,
        height,
        neighborIds,
        groupId: id,
      })
    }
  }

  return pieces
}

/** 将碎片随机散落在画布内 */
export function scatterPieces(pieces: Piece[], canvasW: number, canvasH: number, margin = 8): Piece[] {
  return pieces.map((p) => {
    const maxX = Math.max(margin, canvasW - p.width - margin)
    const maxY = Math.max(margin, canvasH - p.height - margin)
    const x = margin + Math.random() * Math.max(0, maxX - margin)
    const y = margin + Math.random() * Math.max(0, maxY - margin)
    return { ...p, x, y, groupId: p.id }
  })
}

function groupSize(pieces: readonly Piece[], groupId: string): number {
  let n = 0
  for (const p of pieces) if (p.groupId === groupId) n += 1
  return n
}

/**
 * 邻块相对磁吸：若移动组与邻组相对位姿接近正解，则对齐并合并为同一大块（仍可自由拖动）。
 * 可连锁合并多次。
 */
export function applyNeighborSnap(pieces: readonly Piece[], movedGroupId: string, threshold: number): Piece[] {
  let current = pieces.map((p) => ({ ...p }))
  let guard = 0

  while (guard++ < current.length) {
    const byId = new Map(current.map((p) => [p.id, p]))
    const moving = current.filter((p) => p.groupId === movedGroupId)
    if (moving.length === 0) break

    let best: { err: number; dx: number; dy: number; otherGroupId: string } | null = null

    for (const p of moving) {
      for (const nid of p.neighborIds) {
        const n = byId.get(nid)
        if (!n || n.groupId === movedGroupId) continue

        const expectedDx = p.targetX - n.targetX
        const expectedDy = p.targetY - n.targetY
        const err = Math.hypot(p.x - n.x - expectedDx, p.y - n.y - expectedDy)
        if (err > threshold) continue
        if (best && err >= best.err) continue

        best = {
          err,
          dx: n.x + expectedDx - p.x,
          dy: n.y + expectedDy - p.y,
          otherGroupId: n.groupId,
        }
      }
    }

    if (!best) break

    const mergeInto = best.otherGroupId
    const dx = best.dx
    const dy = best.dy
    // 保留较大组的 id，便于稳定
    const keepId =
      groupSize(current, mergeInto) >= groupSize(current, movedGroupId) ? mergeInto : movedGroupId

    current = current.map((p) => {
      if (p.groupId === movedGroupId) {
        return { ...p, x: p.x + dx, y: p.y + dy, groupId: keepId }
      }
      if (p.groupId === mergeInto) {
        return { ...p, groupId: keepId }
      }
      return p
    })
    movedGroupId = keepId
  }

  return current
}

/** 全部合成同一块（相对关系已由磁吸保证） */
export function isJigsawComplete(pieces: readonly Piece[]): boolean {
  if (pieces.length === 0) return false
  const gid = pieces[0].groupId
  return pieces.every((p) => p.groupId === gid)
}

/** 窗口缩放后：保留 group，并按新 target 差重建组内相对位置 */
export function remapPiecesAfterResize(
  oldPieces: readonly Piece[],
  fresh: readonly Piece[],
  scaleX: number,
  scaleY: number,
  canvasW: number,
  canvasH: number,
): Piece[] {
  const byId = new Map(fresh.map((p) => [p.id, p]))
  const scaled = oldPieces.map((old) => {
    const neu = byId.get(old.id)
    if (!neu) return old
    return {
      ...neu,
      x: old.x * scaleX,
      y: old.y * scaleY,
      groupId: old.groupId,
    }
  })

  // 以组内第一块为锚，按新 target 差值校正同组相对位置
  const groups = new Map<string, Piece[]>()
  for (const p of scaled) {
    const list = groups.get(p.groupId)
    if (list) list.push(p)
    else groups.set(p.groupId, [p])
  }

  const result: Piece[] = []
  for (const members of groups.values()) {
    const anchor = members[0]
    for (const m of members) {
      const x = anchor.x + (m.targetX - anchor.targetX)
      const y = anchor.y + (m.targetY - anchor.targetY)
      result.push({
        ...m,
        x: Math.min(Math.max(-m.width * 0.4, x), canvasW - m.width * 0.6),
        y: Math.min(Math.max(-m.height * 0.4, y), canvasH - m.height * 0.6),
      })
    }
  }
  return result
}
