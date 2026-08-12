import type { FallMotion } from './game'
import type { Cell, Obstacle, Pos, SpecialKind, TileKind } from './types'
import { TILE_VISUAL } from './TileGlyph'

export const GAP = 3
export const SWAP_MS = 220
export const CLEAR_MS = 340
export const FALL_MS = 300

export function easeOutCubic(t: number): number {
  const u = 1 - Math.min(1, Math.max(0, t))
  return 1 - u * u * u
}

export function easeOutQuad(t: number): number {
  const u = Math.min(1, Math.max(0, t))
  return 1 - (1 - u) * (1 - u)
}

export function setupMatch3Canvas(
  canvas: HTMLCanvasElement,
  cssW: number,
  cssH: number,
): CanvasRenderingContext2D | null {
  const dpr = typeof window !== 'undefined' ? Math.min(2, window.devicePixelRatio || 1) : 1
  const needW = Math.max(1, Math.round(cssW * dpr))
  const needH = Math.max(1, Math.round(cssH * dpr))
  const sizeChanged = canvas.width !== needW || canvas.height !== needH

  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`
  if (sizeChanged) {
    canvas.width = needW
    canvas.height = needH
  }

  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  // 每次都重设变换，避免 React/属性改动后丢失 dpr 缩放
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

export function drawTileFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  cell: Cell,
  selected: boolean,
  opacity = 1,
  scale = 1,
) {
  ctx.save()
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity))
  const cx = x + size / 2
  const cy = y + size / 2
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.translate(-cx, -cy)

  // chrome face
  ctx.fillStyle = '#c0c0c0'
  roundRect(ctx, x, y, size, size, 2)
  ctx.fill()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(x + 1, y + size - 1)
  ctx.lineTo(x + 1, y + 1)
  ctx.lineTo(x + size - 1, y + 1)
  ctx.stroke()
  ctx.strokeStyle = '#808080'
  ctx.beginPath()
  ctx.moveTo(x + size - 1, y + 1)
  ctx.lineTo(x + size - 1, y + size - 1)
  ctx.lineTo(x + 1, y + size - 1)
  ctx.stroke()

  if (selected) {
    ctx.strokeStyle = '#000080'
    ctx.lineWidth = 2.5
    roundRect(ctx, x + 1.5, y + 1.5, size - 3, size - 3, 2)
    ctx.stroke()
  }

  drawGlyph(ctx, cell.kind, cell.special, cx, cy, Math.max(14, size - 10))
  ctx.restore()
}

export function drawObstacleFace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  obstacle: Obstacle,
  opacity = 1,
  scale = 1,
) {
  ctx.save()
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity))
  const cx = x + size / 2
  const cy = y + size / 2
  ctx.translate(cx, cy)
  ctx.scale(scale, scale)
  ctx.translate(-cx, -cy)

  const hard = obstacle.kind === 'brickHard'
  const cracked = hard && obstacle.hp <= 1

  // 砖面：加强砖更深（相对普通砖约再浅 30% 后的深褐）
  const base = hard ? '#8d7d6f' : '#a89070'
  const dark = hard ? '#5c4e40' : '#6e5a42'
  const light = hard ? '#a89884' : '#d4c0a0'
  ctx.fillStyle = base
  roundRect(ctx, x + 1, y + 1, size - 2, size - 2, 2)
  ctx.fill()

  // 砖缝
  ctx.strokeStyle = dark
  ctx.lineWidth = 1
  const midY = y + size / 2
  ctx.beginPath()
  ctx.moveTo(x + 2, midY)
  ctx.lineTo(x + size - 2, midY)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + size / 2, y + 2)
  ctx.lineTo(x + size / 2, midY)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + size * 0.28, midY)
  ctx.lineTo(x + size * 0.28, y + size - 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + size * 0.72, midY)
  ctx.lineTo(x + size * 0.72, y + size - 2)
  ctx.stroke()

  // 高光边
  ctx.strokeStyle = light
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(x + 2, y + size - 2)
  ctx.lineTo(x + 2, y + 2)
  ctx.lineTo(x + size - 2, y + 2)
  ctx.stroke()
  ctx.strokeStyle = dark
  ctx.beginPath()
  ctx.moveTo(x + size - 2, y + 2)
  ctx.lineTo(x + size - 2, y + size - 2)
  ctx.lineTo(x + 2, y + size - 2)
  ctx.stroke()

  if (hard) {
    // 内框 + 略沉的表面，强化「硬砖」质感
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    roundRect(ctx, x + 3, y + 3, size - 6, size - 6, 1)
    ctx.fill()
    ctx.strokeStyle = '#1a120c'
    ctx.lineWidth = 1.5
    roundRect(ctx, x + 3, y + 3, size - 6, size - 6, 1)
    ctx.stroke()
  }

  if (cracked) drawBrickCracks(ctx, x, y, size)

  ctx.restore()
}

/** 加强砖裂纹：主缝 + 分叉 + 明暗描边，模拟碎裂深度 */
function drawBrickCracks(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const px = (u: number) => x + size * u
  const py = (v: number) => y + size * v

  // 轻微压暗，像裂开后积灰
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  roundRect(ctx, x + 2, y + 2, size - 4, size - 4, 1)
  ctx.fill()

  type Seg = { x0: number; y0: number; x1: number; y1: number; w: number }
  const segs: Seg[] = [
    // 主斜缝（左上 → 右下）
    { x0: 0.18, y0: 0.2, x1: 0.42, y1: 0.4, w: 1.8 },
    { x0: 0.42, y0: 0.4, x1: 0.55, y1: 0.58, w: 2.1 },
    { x0: 0.55, y0: 0.58, x1: 0.72, y1: 0.82, w: 1.7 },
    // 上部分叉
    { x0: 0.42, y0: 0.4, x1: 0.62, y1: 0.28, w: 1.2 },
    { x0: 0.62, y0: 0.28, x1: 0.78, y1: 0.22, w: 0.9 },
    { x0: 0.62, y0: 0.28, x1: 0.7, y1: 0.42, w: 0.85 },
    // 中部分叉
    { x0: 0.55, y0: 0.58, x1: 0.38, y1: 0.68, w: 1.15 },
    { x0: 0.38, y0: 0.68, x1: 0.28, y1: 0.8, w: 0.9 },
    { x0: 0.55, y0: 0.58, x1: 0.78, y1: 0.62, w: 1.0 },
    // 细小发丝裂纹
    { x0: 0.22, y0: 0.48, x1: 0.34, y1: 0.52, w: 0.7 },
    { x0: 0.68, y0: 0.48, x1: 0.82, y1: 0.55, w: 0.65 },
    { x0: 0.48, y0: 0.18, x1: 0.52, y1: 0.32, w: 0.7 },
  ]

  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  for (const s of segs) {
    const x0 = px(s.x0)
    const y0 = py(s.y0)
    const x1 = px(s.x1)
    const y1 = py(s.y1)
    // 亮边（缝隙一侧微高光）
    ctx.strokeStyle = 'rgba(180,150,110,0.28)'
    ctx.lineWidth = Math.max(0.6, s.w * 0.55)
    ctx.beginPath()
    ctx.moveTo(x0 + 0.6, y0 - 0.5)
    ctx.lineTo(x1 + 0.6, y1 - 0.5)
    ctx.stroke()
    // 深缝本体
    ctx.strokeStyle = 'rgba(8,4,2,0.92)'
    ctx.lineWidth = s.w
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
    // 内芯更黑一点
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'
    ctx.lineWidth = Math.max(0.4, s.w * 0.35)
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.stroke()
  }

  // 主缝交汇处小缺口
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.beginPath()
  ctx.arc(px(0.42), py(0.4), size * 0.035, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(px(0.55), py(0.58), size * 0.028, 0, Math.PI * 2)
  ctx.fill()
}

export function drawGlyph(
  ctx: CanvasRenderingContext2D,
  kind: TileKind,
  special: SpecialKind,
  cx: number,
  cy: number,
  size: number,
) {
  const v = TILE_VISUAL[kind]
  const s = size / 32
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(s, s)
  ctx.translate(-16, -16)
  ctx.fillStyle = v.fill
  ctx.strokeStyle = v.stroke
  ctx.lineWidth = 1.5
  ctx.lineJoin = 'round'

  ctx.beginPath()
  if (kind === 'ruby') {
    ctx.moveTo(16, 3)
    ctx.lineTo(28, 12)
    ctx.lineTo(22, 28)
    ctx.lineTo(10, 28)
    ctx.lineTo(4, 12)
    ctx.closePath()
  } else if (kind === 'sapphire') {
    ctx.arc(16, 16, 11, 0, Math.PI * 2)
  } else if (kind === 'emerald') {
    roundRect(ctx, 6, 6, 20, 20, 3)
  } else if (kind === 'topaz') {
    ctx.moveTo(16, 4)
    ctx.lineTo(28, 16)
    ctx.lineTo(16, 28)
    ctx.lineTo(4, 16)
    ctx.closePath()
  } else if (kind === 'amethyst') {
    ctx.moveTo(16, 3)
    ctx.lineTo(19.5, 11.5)
    ctx.lineTo(28, 12.5)
    ctx.lineTo(21.5, 18.5)
    ctx.lineTo(23.5, 27)
    ctx.lineTo(16, 22.5)
    ctx.lineTo(8.5, 27)
    ctx.lineTo(10.5, 18.5)
    ctx.lineTo(4, 12.5)
    ctx.lineTo(12.5, 11.5)
    ctx.closePath()
  } else {
    ctx.moveTo(16, 5)
    ctx.lineTo(26, 10)
    ctx.lineTo(26, 22)
    ctx.lineTo(16, 27)
    ctx.lineTo(6, 22)
    ctx.lineTo(6, 10)
    ctx.closePath()
  }
  ctx.fill()
  ctx.stroke()

  if (special === 'lineH') {
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(5, 16)
    ctx.lineTo(27, 16)
    ctx.stroke()
  } else if (special === 'lineV') {
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(16, 5)
    ctx.lineTo(16, 27)
    ctx.stroke()
  } else if (special === 'blast') {
    ctx.fillStyle = '#fff'
    ctx.strokeStyle = v.stroke
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(16, 6)
    ctx.lineTo(18, 14)
    ctx.lineTo(26, 16)
    ctx.lineTo(18, 18)
    ctx.lineTo(16, 26)
    ctx.lineTo(14, 18)
    ctx.lineTo(6, 16)
    ctx.lineTo(14, 14)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  } else if (special === 'color') {
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2.2
    ctx.beginPath()
    ctx.arc(16, 16, 5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(16, 16, 2.2, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
  }
  ctx.restore()
}

export function drawSlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  ctx.fillStyle = 'rgba(0,0,0,0.12)'
  roundRect(ctx, x, y, size, size, 2)
  ctx.fill()
}

export function drawBurst(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  kind: TileKind,
  t: number,
) {
  const color = TILE_VISUAL[kind].fill
  const p = Math.min(1, Math.max(0, t))
  const cx = x + size / 2
  const cy = y + size / 2

  ctx.save()
  // glow
  const glowA = p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6
  const glowScale = 0.35 + p * 1.2
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.55 * glowScale)
  grd.addColorStop(0, `${color}ee`)
  grd.addColorStop(0.55, `${color}66`)
  grd.addColorStop(1, `${color}00`)
  ctx.globalAlpha = Math.max(0, glowA)
  ctx.fillStyle = grd
  ctx.beginPath()
  ctx.arc(cx, cy, size * 0.55 * glowScale, 0, Math.PI * 2)
  ctx.fill()

  // ring
  ctx.globalAlpha = Math.max(0, 0.9 * (1 - p))
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(cx, cy, size * (0.2 + p * 0.45), 0, Math.PI * 2)
  ctx.stroke()

  // sparks
  const dirs = [
    [-0.45, -0.4],
    [0.42, -0.38],
    [-0.5, 0.35],
    [0.48, 0.4],
    [0, -0.55],
    [0, 0.52],
    [-0.55, 0],
    [0.55, 0],
  ]
  for (let i = 0; i < dirs.length; i++) {
    const delay = i * 0.04
    const local = Math.min(1, Math.max(0, (p - delay) / (1 - delay)))
    if (local <= 0) continue
    const [dx, dy] = dirs[i]!
    const sx = cx + dx * size * local
    const sy = cy + dy * size * local
    const r = Math.max(2, size * 0.08 * (1 - local * 0.7))
    ctx.globalAlpha = 1 - local
    ctx.fillStyle = i % 2 === 0 ? color : '#fff'
    ctx.beginPath()
    ctx.arc(sx, sy, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export type SceneTile = {
  id: string
  cell: Cell | null
  obstacle: Obstacle | null
  x: number
  y: number
  opacity: number
  scale: number
  selected: boolean
}

export type SceneBurst = {
  x: number
  y: number
  kind: TileKind | 'brick'
  start: number
  dur: number
}

export function boardToScene(
  board: (Cell | null)[][],
  obstacles: (Obstacle | null)[][],
  selected: Pos | null,
  cellPx: number,
  stride: number,
): SceneTile[] {
  const out: SceneTile[] = []
  const rows = board.length
  const cols = board[0]?.length ?? 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const obs = obstacles[r]?.[c] ?? null
      const cell = board[r]![c]
      if (!obs && !cell) continue
      out.push({
        id: obs?.id ?? cell!.id,
        cell: obs ? null : cell,
        obstacle: obs,
        x: c * stride,
        y: r * stride,
        opacity: 1,
        scale: 1,
        selected: !obs && !!selected && selected.r === r && selected.c === c,
      })
    }
  }
  return out
}

export function paintBoard(
  ctx: CanvasRenderingContext2D,
  opts: {
    rows: number
    cols: number
    cellPx: number
    stride: number
    cssW: number
    cssH: number
    tiles: SceneTile[]
    bursts: SceneBurst[]
    now: number
  },
) {
  const { rows, cols, cellPx, stride, cssW, cssH, tiles, bursts, now } = opts
  ctx.clearRect(0, 0, cssW, cssH)
  ctx.fillStyle = '#6b6b6b'
  ctx.fillRect(0, 0, cssW, cssH)

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      drawSlot(ctx, c * stride, r * stride, cellPx)
    }
  }

  const sorted = [...tiles].sort((a, b) => Number(a.selected) - Number(b.selected))
  for (const t of sorted) {
    if (t.obstacle) {
      drawObstacleFace(ctx, t.x, t.y, cellPx, t.obstacle, t.opacity, t.scale)
    } else if (t.cell) {
      drawTileFace(ctx, t.x, t.y, cellPx, t.cell, t.selected, t.opacity, t.scale)
    }
  }

  for (const b of bursts) {
    const t = (now - b.start) / b.dur
    if (t < 0 || t > 1) continue
    if (b.kind === 'brick') drawBrickBurst(ctx, b.x, b.y, cellPx, t)
    else drawBurst(ctx, b.x, b.y, cellPx, b.kind, t)
  }
}

function drawBrickBurst(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  t: number,
) {
  ctx.save()
  const cx = x + size / 2
  const cy = y + size / 2
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * Math.PI * 2 + t
    const dist = size * (0.15 + t * 0.55)
    const sx = cx + Math.cos(ang) * dist
    const sy = cy + Math.sin(ang) * dist
    const r = Math.max(1.5, size * 0.07 * (1 - t * 0.6))
    ctx.globalAlpha = 1 - t
    ctx.fillStyle = i % 2 === 0 ? '#8a7355' : '#d4c0a0'
    ctx.fillRect(sx - r, sy - r, r * 2, r * 1.2)
  }
  ctx.restore()
}

export function hitTest(
  px: number,
  py: number,
  rows: number,
  cols: number,
  cellPx: number,
  stride: number,
): Pos | null {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * stride
      const y = r * stride
      if (px >= x && px < x + cellPx && py >= y && py < y + cellPx) {
        return { r, c }
      }
    }
  }
  return null
}

function sleep(ms: number) {
  return new Promise<void>((r) => {
    window.setTimeout(r, ms)
  })
}

function runTween(
  duration: number,
  ease: (t: number) => number,
  onUpdate: (eased: number, raw: number) => void,
): Promise<void> {
  return new Promise((resolve) => {
    const t0 = performance.now()
    const step = (now: number) => {
      const raw = Math.min(1, (now - t0) / duration)
      onUpdate(ease(raw), raw)
      if (raw < 1) requestAnimationFrame(step)
      else resolve()
    }
    requestAnimationFrame(step)
  })
}

/** 交换动画：双方块对滑 */
export async function animateSwap(
  tiles: SceneTile[],
  a: Pos,
  b: Pos,
  stride: number,
  onFrame: () => void,
): Promise<void> {
  const tileA = tiles.find((t) => Math.round(t.x / stride) === a.c && Math.round(t.y / stride) === a.r)
  const tileB = tiles.find((t) => Math.round(t.x / stride) === b.c && Math.round(t.y / stride) === b.r)
  // 更稳：按目标格坐标找（交换前位置）
  const byPos = (r: number, c: number) =>
    tiles.find((t) => Math.abs(t.x - c * stride) < 0.5 && Math.abs(t.y - r * stride) < 0.5)

  const sa = byPos(a.r, a.c) ?? tileA
  const sb = byPos(b.r, b.c) ?? tileB
  if (!sa || !sb) return

  const ax0 = sa.x
  const ay0 = sa.y
  const bx0 = sb.x
  const by0 = sb.y
  const ax1 = b.c * stride
  const ay1 = b.r * stride
  const bx1 = a.c * stride
  const by1 = a.r * stride

  await runTween(SWAP_MS, easeOutCubic, (e) => {
    sa.x = ax0 + (ax1 - ax0) * e
    sa.y = ay0 + (ay1 - ay0) * e
    sb.x = bx0 + (bx1 - bx0) * e
    sb.y = by0 + (by1 - by0) * e
    onFrame()
  })
}

/** 消除动画 + 粒子 */
export async function animateClear(
  tiles: SceneTile[],
  bursts: SceneBurst[],
  clearMap: Map<string, { r: number; c: number; kind: TileKind | 'brick' }>,
  cellPx: number,
  stride: number,
  onFrame: () => void,
): Promise<void> {
  const clearing = tiles.filter((t) => {
    const r = Math.round(t.y / stride)
    const c = Math.round(t.x / stride)
    return clearMap.has(`${r},${c}`)
  })

  const now = performance.now()
  for (const [key, info] of clearMap) {
    void key
    bursts.push({
      x: info.c * stride,
      y: info.r * stride,
      kind: info.kind,
      start: now,
      dur: CLEAR_MS,
    })
  }

  await runTween(CLEAR_MS, easeOutQuad, (e) => {
    for (const t of clearing) {
      t.scale = 1 + e * 0.2
      t.opacity = 1 - e
    }
    onFrame()
  })

  // 清掉已消方块
  for (let i = tiles.length - 1; i >= 0; i--) {
    const t = tiles[i]!
    const r = Math.round(t.y / stride)
    const c = Math.round(t.x / stride)
    if (clearMap.has(`${r},${c}`)) tiles.splice(i, 1)
  }
  // 过期 burst 稍后由 paint 自然忽略；这里裁剪
  const end = performance.now()
  for (let i = bursts.length - 1; i >= 0; i--) {
    if (end - bursts[i]!.start >= bursts[i]!.dur) bursts.splice(i, 1)
  }
  onFrame()
  await sleep(16)
}

/** 开局全盘从上方掉入（障碍原地出现，不参与下落） */
export function buildIntroFalls(
  board: (Cell | null)[][],
  obstacles: (Obstacle | null)[][],
): FallMotion[] {
  const falls: FallMotion[] = []
  const rows = board.length
  const cols = board[0]?.length ?? 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (obstacles[r]?.[c]) continue
      const cell = board[r]![c]
      if (!cell) continue
      falls.push({
        id: cell.id,
        fromR: r - rows - 1,
        toR: r,
        c,
        spawn: true,
      })
    }
  }
  return falls
}

/** 下落 / 新生动画 */
export async function animateFall(
  tiles: SceneTile[],
  nextBoard: (Cell | null)[][],
  nextObstacles: (Obstacle | null)[][],
  falls: FallMotion[],
  selected: Pos | null,
  cellPx: number,
  stride: number,
  onFrame: () => void,
): Promise<void> {
  const fallById = new Map(falls.map((f) => [f.id, f]))
  const nextScene = boardToScene(nextBoard, nextObstacles, selected, cellPx, stride)

  // 用下一局面重建，但把起点设为 from
  tiles.length = 0
  for (const t of nextScene) {
    const f = fallById.get(t.id)
    if (f) {
      tiles.push({
        ...t,
        x: f.c * stride,
        y: f.fromR * stride,
        opacity: f.spawn ? 0.9 : 1,
      })
    } else {
      tiles.push({ ...t })
    }
  }

  const from = tiles.map((t) => ({ id: t.id, x: t.x, y: t.y, opacity: t.opacity }))
  const to = new Map(nextScene.map((t) => [t.id, t]))

  onFrame()
  await runTween(FALL_MS, easeOutCubic, (e) => {
    for (let i = 0; i < tiles.length; i++) {
      const t = tiles[i]!
      const a = from[i]!
      const b = to.get(t.id)
      if (!b) continue
      t.x = a.x + (b.x - a.x) * e
      t.y = a.y + (b.y - a.y) * e
      t.opacity = a.opacity + (1 - a.opacity) * e
      t.cell = b.cell
      t.obstacle = b.obstacle
      t.selected = b.selected
    }
    onFrame()
  })

  // 对齐终态
  tiles.length = 0
  tiles.push(...boardToScene(nextBoard, nextObstacles, selected, cellPx, stride))
  onFrame()
}
