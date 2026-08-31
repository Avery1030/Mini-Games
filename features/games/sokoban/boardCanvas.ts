import { boxOnTarget } from './game'
import { posKey, type CellPos, type Direction, type LevelData } from './types'

/** 棋盘配色 */
export const BOARD = {
  void: '#3b9be8',
  floorA: '#c8c8c8',
  floorB: '#9a9a9a',
  wall: '#3a2414',
  wallHi: '#4e3420',
  wallLo: '#1e120a',
  box: '#c4782a',
  boxHi: '#e09848',
  boxLo: '#8a4e14',
  boxX: '#5c3010',
  boxOnGoal: '#9fd96a',
  boxOnGoalHi: '#c5ef9a',
  boxOnGoalLo: '#6aad38',
  boxOnGoalX: '#3d6e1c',
  target: '#ffffff',
} as const

/** 移动过渡时长（ms），与操作冷却对齐 */
export const MOVE_ANIM_MS = 200

type VisualBox = {
  x: number
  y: number
  onGoal: boolean
}

export type BoardVisual = {
  player: CellPos
  boxes: VisualBox[]
  /** 人物朝向（与上一步移动方向一致） */
  facing: Direction
}

function bevelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  face: string,
  hi: string,
  lo: string,
  bevel: number,
) {
  ctx.fillStyle = face
  ctx.fillRect(x, y, w, h)

  const b = Math.max(1, bevel)
  ctx.fillStyle = hi
  ctx.fillRect(x, y, w, b)
  ctx.fillRect(x, y, b, h)
  ctx.fillStyle = lo
  ctx.fillRect(x, y + h - b, w, b)
  ctx.fillRect(x + w - b, y, b, h)
}

function drawX(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  lineWidth: number,
  inset = 0,
) {
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x + inset, y + inset)
  ctx.lineTo(x + w - inset, y + h - inset)
  ctx.moveTo(x + w - inset, y + inset)
  ctx.lineTo(x + inset, y + h - inset)
  ctx.stroke()
}

function drawVoidPattern(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = BOARD.void
  ctx.fillRect(0, 0, w, h)

  const step = 28
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 1.5
  for (let y = 0; y < h + step; y += step) {
    for (let x = 0; x < w + step; x += step) {
      const px = x + 4
      const py = y + 4
      const s = 20
      ctx.strokeRect(px, py, s, s)
      ctx.beginPath()
      ctx.moveTo(px + 2, py + 2)
      ctx.lineTo(px + s - 2, py + s - 2)
      ctx.moveTo(px + s - 2, py + 2)
      ctx.lineTo(px + 2, py + s - 2)
      ctx.stroke()
    }
  }
}

function drawWall(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number) {
  const bevel = Math.max(2, Math.round(cell * 0.08))
  bevelRect(ctx, x, y, cell, cell, BOARD.wall, BOARD.wallHi, BOARD.wallLo, bevel)
}

function drawFloor(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, checker: boolean) {
  ctx.fillStyle = checker ? BOARD.floorA : BOARD.floorB
  ctx.fillRect(x, y, cell, cell)
  // 细网格，增强层次
  ctx.strokeStyle = 'rgba(0,0,0,0.06)'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1)
}

function drawTarget(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number) {
  const inset = cell * 0.18
  // 轻微描边，目标更清晰
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = Math.max(1, cell * 0.04)
  drawX(ctx, x, y, cell, cell, BOARD.target, Math.max(2.5, cell * 0.11), inset)
  ctx.restore()
}

function drawBox(ctx: CanvasRenderingContext2D, x: number, y: number, cell: number, onGoal: boolean) {
  const gap = Math.max(1, Math.round(cell * 0.04))
  const bx = x + gap
  const by = y + gap
  const bw = cell - gap * 2
  const bh = cell - gap * 2
  const face = onGoal ? BOARD.boxOnGoal : BOARD.box
  const hi = onGoal ? BOARD.boxOnGoalHi : BOARD.boxHi
  const lo = onGoal ? BOARD.boxOnGoalLo : BOARD.boxLo
  const xStroke = onGoal ? BOARD.boxOnGoalX : BOARD.boxX
  const bevel = Math.max(2, Math.round(cell * 0.08))

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.28)'
  ctx.shadowBlur = Math.max(1, cell * 0.06)
  ctx.shadowOffsetY = Math.max(1, cell * 0.04)
  bevelRect(ctx, bx, by, bw, bh, face, hi, lo, bevel)
  ctx.restore()

  ctx.strokeStyle = lo
  ctx.lineWidth = 1
  ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1)
  const inset = Math.max(2, bw * 0.18)
  drawX(ctx, bx, by, bw, bh, xStroke, Math.max(2, cell * 0.07), inset)
}

/** 纯俯视工人（参照图：黄帽居中偏上 + 蓝背带裤 + 红袖 + 白手套） */
function drawPlayer(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  facing: Direction,
) {
  const pad = Math.max(1, cell * 0.02)
  const s = cell - pad * 2
  const ox = x + pad
  const oy = y + pad
  const u = s / 64
  // 本地：+Y 前方（蓝背带扣朝向），默认朝下
  const angle =
    facing === 'down' ? 0 : facing === 'left' ? Math.PI / 2 : facing === 'up' ? Math.PI : -Math.PI / 2

  const outline = '#5c3a1e'

  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = Math.max(1, cell * 0.05)
  ctx.shadowOffsetY = Math.max(1, cell * 0.03)
  ctx.translate(ox + s / 2, oy + s / 2)
  ctx.rotate(angle)
  ctx.scale(u, u)
  ctx.translate(-32, -32)
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // 红袖（左右）
  ctx.fillStyle = '#e23b3b'
  ctx.strokeStyle = outline
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.ellipse(12, 36, 9, 13, -0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(52, 36, 9, 13, 0.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // 白手套
  ctx.fillStyle = '#f7f7f7'
  ctx.beginPath()
  ctx.ellipse(10, 47, 6, 5, -0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(54, 47, 6, 5, 0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // 蓝背带裤（下部胸前）
  const blueGrad = ctx.createRadialGradient(32, 42, 2, 32, 44, 16)
  blueGrad.addColorStop(0, '#6aabe8')
  blueGrad.addColorStop(1, '#2f6fc0')
  ctx.fillStyle = blueGrad
  ctx.beginPath()
  ctx.ellipse(32, 44, 16, 14, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // 背带
  ctx.fillStyle = '#3d82d0'
  ctx.lineWidth = 2
  roundRectStroked(ctx, 21, 30, 7, 16, 2, outline)
  roundRectStroked(ctx, 36, 30, 7, 16, 2, outline)

  // 黄扣
  ctx.fillStyle = '#f5d040'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.arc(24.5, 46, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(39.5, 46, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // 黄安全帽（主体，居中偏上的大圆）
  const hatGrad = ctx.createRadialGradient(27, 24, 2, 32, 28, 18)
  hatGrad.addColorStop(0, '#fff6b0')
  hatGrad.addColorStop(0.4, '#ffd84a')
  hatGrad.addColorStop(1, '#d4a000')
  ctx.fillStyle = hatGrad
  ctx.lineWidth = 2.8
  ctx.beginPath()
  ctx.arc(32, 26, 17, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  // 帽顶中线（浅色）
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'
  ctx.lineWidth = 3.5
  ctx.beginPath()
  ctx.moveTo(32, 12)
  ctx.lineTo(32, 38)
  ctx.stroke()

  // 高光
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.beginPath()
  ctx.ellipse(25, 18, 5.5, 3.2, -0.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(38, 16, 3.5, 2.2, 0.35, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function roundRectStroked(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  strokeColor: string,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = strokeColor
  ctx.stroke()
}

export function facingFromDelta(from: CellPos, to: CellPos, fallback: Direction = 'down'): Direction {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (dx === 0 && dy === 0) return fallback
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'down' : 'up'
}

export function visualFromState(
  player: CellPos,
  boxes: readonly CellPos[],
  targets: readonly CellPos[],
  facing: Direction = 'down',
): BoardVisual {
  return {
    player: { x: player.x, y: player.y },
    boxes: boxes.map((b) => ({
      x: b.x,
      y: b.y,
      onGoal: boxOnTarget(b, targets),
    })),
    facing,
  }
}

function easeOutCubic(t: number): number {
  const u = 1 - t
  return 1 - u * u * u
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function interpolateVisual(from: BoardVisual, to: BoardVisual, t: number): BoardVisual {
  const e = easeOutCubic(Math.min(1, Math.max(0, t)))
  const n = Math.min(from.boxes.length, to.boxes.length)
  const boxes: VisualBox[] = []
  for (let i = 0; i < n; i++) {
    const a = from.boxes[i]
    const b = to.boxes[i]
    boxes.push({
      x: lerp(a.x, b.x, e),
      y: lerp(a.y, b.y, e),
      onGoal: e >= 0.5 ? b.onGoal : a.onGoal,
    })
  }
  for (let i = n; i < to.boxes.length; i++) boxes.push({ ...to.boxes[i] })

  return {
    player: {
      x: lerp(from.player.x, to.player.x, e),
      y: lerp(from.player.y, to.player.y, e),
    },
    boxes,
    facing: to.facing,
  }
}

/** 绘制静态层（void / 墙 / 地板 / 目标），可缓存到离屏 canvas */
function drawStaticLayer(ctx: CanvasRenderingContext2D, level: LevelData, cellPx: number): void {
  const { width, height } = level
  const w = width * cellPx
  const h = height * cellPx
  const voids = new Set(level.voids.map(posKey))
  const walls = new Set(level.walls.map(posKey))
  const targets = new Set(level.targets.map(posKey))

  ctx.clearRect(0, 0, w, h)
  drawVoidPattern(ctx, w, h)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`
      if (voids.has(key)) continue
      const px = x * cellPx
      const py = y * cellPx
      if (walls.has(key)) {
        drawWall(ctx, px, py, cellPx)
      } else {
        drawFloor(ctx, px, py, cellPx, (x + y) % 2 === 0)
        if (targets.has(key)) drawTarget(ctx, px, py, cellPx)
      }
    }
  }
}

/**
 * 将当前关卡绘制到 canvas（逻辑像素尺寸 = width*cell × height*cell）。
 */
export function drawSokobanBoard(
  ctx: CanvasRenderingContext2D,
  input: {
    level: LevelData
    visual: BoardVisual
    cellPx: number
    staticLayer?: Nullable<HTMLCanvasElement | OffscreenCanvas>
  },
): void {
  const { level, visual, cellPx, staticLayer } = input
  const w = level.width * cellPx
  const h = level.height * cellPx

  ctx.clearRect(0, 0, w, h)

  if (staticLayer) {
    ctx.drawImage(staticLayer, 0, 0, w, h)
  } else {
    drawStaticLayer(ctx, level, cellPx)
  }

  for (const b of visual.boxes) {
    drawBox(ctx, b.x * cellPx, b.y * cellPx, cellPx, b.onGoal)
  }

  drawPlayer(ctx, visual.player.x * cellPx, visual.player.y * cellPx, cellPx, visual.facing)
}

/** 配置 canvas 物理像素并返回 2d 上下文（已按 dpr scale）。尺寸未变时跳过重置。 */
export function setupBoardCanvas(
  canvas: HTMLCanvasElement,
  level: LevelData,
  cellPx: number,
): Nullable<CanvasRenderingContext2D> {
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1
  const cssW = level.width * cellPx
  const cssH = level.height * cellPx
  const needW = Math.max(1, Math.round(cssW * dpr))
  const needH = Math.max(1, Math.round(cssH * dpr))

  const sizeChanged = canvas.width !== needW || canvas.height !== needH
  if (sizeChanged) {
    canvas.style.width = `${cssW}px`
    canvas.style.height = `${cssH}px`
    canvas.width = needW
    canvas.height = needH
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  if (sizeChanged) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

export function createStaticLayer(level: LevelData, cellPx: number): Nullable<HTMLCanvasElement> {
  if (typeof document === 'undefined') return null
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1
  const cssW = level.width * cellPx
  const cssH = level.height * cellPx
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(cssW * dpr))
  c.height = Math.max(1, Math.round(cssH * dpr))
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawStaticLayer(ctx, level, cellPx)
  return c
}
