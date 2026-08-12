import { getFruit } from './fruits'
import type { SuikaEngine } from './game'
import { DANGER_LINE_Y, DROP_Y, WORLD_HEIGHT, WORLD_WIDTH } from './physics'

export type CanvasLabels = {
  danger: string
  hint: string
}

function drawVLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y0: number,
  y1: number,
  dash: number[],
  color: string,
  lineWidth = 1.5,
): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.setLineDash(dash)
  ctx.beginPath()
  ctx.moveTo(x + 0.5, y0)
  ctx.lineTo(x + 0.5, y1)
  ctx.stroke()
  ctx.restore()
}

function drawHLine(
  ctx: CanvasRenderingContext2D,
  y: number,
  x0: number,
  x1: number,
  dash: number[],
  color: string,
  lineWidth = 1.25,
): void {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.setLineDash(dash)
  ctx.beginPath()
  ctx.moveTo(x0, y + 0.5)
  ctx.lineTo(x1, y + 0.5)
  ctx.stroke()
  ctx.restore()
}

function shadeColor(hex: string, amount: number): string {
  const n = hex.replace('#', '')
  const full =
    n.length === 3
      ? n
          .split('')
          .map((c) => c + c)
          .join('')
      : n
  const num = Number.parseInt(full, 16)
  if (!Number.isFinite(num)) return hex
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount))
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount))
  return `rgb(${r},${g},${b})`
}

function drawFruitCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  level: number,
  alpha = 1,
): void {
  const def = getFruit(level)
  ctx.save()
  ctx.globalAlpha = alpha

  // 地面投影
  ctx.beginPath()
  ctx.ellipse(x + r * 0.08, y + r * 0.78, r * 0.72, r * 0.22, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.fill()

  // 球体底色（暗边 → 亮心）
  const bodyGrad = ctx.createRadialGradient(x - r * 0.32, y - r * 0.38, r * 0.08, x + r * 0.1, y + r * 0.15, r * 1.05)
  bodyGrad.addColorStop(0, shadeColor(def.color, 55))
  bodyGrad.addColorStop(0.45, def.color)
  bodyGrad.addColorStop(0.82, shadeColor(def.color, -35))
  bodyGrad.addColorStop(1, shadeColor(def.color, -70))

  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = bodyGrad
  ctx.fill()

  // 左上高光斑
  ctx.beginPath()
  ctx.ellipse(x - r * 0.28, y - r * 0.32, r * 0.38, r * 0.28, -0.5, 0, Math.PI * 2)
  const hl = ctx.createRadialGradient(x - r * 0.28, y - r * 0.32, 0, x - r * 0.28, y - r * 0.32, r * 0.4)
  hl.addColorStop(0, 'rgba(255,255,255,0.55)')
  hl.addColorStop(0.55, 'rgba(255,255,255,0.12)')
  hl.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = hl
  ctx.fill()

  // 右下环境光暗边
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  const rim = ctx.createRadialGradient(x - r * 0.15, y - r * 0.2, r * 0.55, x, y, r)
  rim.addColorStop(0, 'rgba(0,0,0,0)')
  rim.addColorStop(0.7, 'rgba(0,0,0,0)')
  rim.addColorStop(1, 'rgba(0,0,0,0.28)')
  ctx.fillStyle = rim
  ctx.fill()

  // 边缘描边
  // ctx.beginPath()
  // ctx.arc(x, y, r - 0.5, 0, Math.PI * 2)
  // ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  // ctx.lineWidth = Math.max(1, r * 0.05)
  // ctx.stroke()
  // ctx.beginPath()
  // ctx.arc(x, y, Math.max(1, r - 1.5), 0, Math.PI * 2)
  // ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  // ctx.lineWidth = Math.max(0.8, r * 0.035)
  // ctx.stroke()

  drawCenteredGlyph(ctx, def.glyph, x, y, r)

  ctx.restore()
}

/** glyph@fontSize → 视觉中心相对 textAlign=center/middle 绘制点的校正量 */
const glyphOffsetCache = new Map<string, { ox: number; oy: number }>()

/**
 * 离屏绘制后扫描非透明像素，得到把视觉中心对齐到绘制点所需的偏移。
 * 彩色 emoji 的 measureText 包围盒不可靠，像素扫描更准。
 */
function getGlyphVisualOffset(glyph: string, fontSize: number): { ox: number; oy: number } {
  const key = `${glyph}@${fontSize}`
  const cached = glyphOffsetCache.get(key)
  if (cached) return cached

  const fallback = { ox: 0, oy: fontSize * 0.06 }
  if (typeof document === 'undefined') {
    glyphOffsetCache.set(key, fallback)
    return fallback
  }

  const pad = Math.ceil(fontSize * 0.6)
  const size = Math.ceil(fontSize + pad * 2)
  const off = document.createElement('canvas')
  off.width = size
  off.height = size
  const octx = off.getContext('2d', { willReadFrequently: true })
  if (!octx) {
    glyphOffsetCache.set(key, fallback)
    return fallback
  }

  octx.clearRect(0, 0, size, size)
  octx.font = `${fontSize}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  octx.textAlign = 'center'
  octx.textBaseline = 'middle'
  octx.fillText(glyph, size / 2, size / 2)

  let minX = size
  let minY = size
  let maxX = -1
  let maxY = -1
  const { data } = octx.getImageData(0, 0, size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[(y * size + x) * 4 + 3] > 16) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < 0) {
    glyphOffsetCache.set(key, fallback)
    return fallback
  }

  const visualCx = (minX + maxX) / 2
  const visualCy = (minY + maxY) / 2
  const result = { ox: size / 2 - visualCx, oy: size / 2 - visualCy }
  glyphOffsetCache.set(key, result)
  return result
}

/** 将 emoji / 文字的视觉中心对齐到圆心 */
function drawCenteredGlyph(ctx: CanvasRenderingContext2D, glyph: string, cx: number, cy: number, r: number): void {
  const fontSize = Math.max(10, Math.floor(r * 1.05))
  const { ox, oy } = getGlyphVisualOffset(glyph, fontSize)

  ctx.font = `${fontSize}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  ctx.shadowColor = 'rgba(0,0,0,0.28)'
  ctx.shadowBlur = Math.max(1, r * 0.05)
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0
  ctx.fillText(glyph, cx + ox, cy + oy)
  ctx.shadowBlur = 0
}

/**
 * 将当前引擎状态绘制到 canvas（逻辑坐标系 WORLD_WIDTH × WORLD_HEIGHT）。
 */
export function drawSuikaFrame(ctx: CanvasRenderingContext2D, engine: SuikaEngine, labels: CanvasLabels): void {
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

  ctx.fillStyle = '#0f1f0f'
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)

  // 警戒线（水平虚线）
  drawHLine(ctx, DANGER_LINE_Y, 0, WORLD_WIDTH, [6, 5], 'rgba(248,113,113,0.75)')
  ctx.fillStyle = 'rgba(252,165,165,0.9)'
  ctx.font = '10px ui-sans-serif, system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillText(labels.danger, WORLD_WIDTH - 6, DANGER_LINE_Y - 3)

  // 场上水果（按下→上绘制，投影更自然）
  const sorted = engine.bodies
    .filter((b) => !b.removed)
    .slice()
    .sort((a, b) => a.y - b.y)
  for (const b of sorted) drawFruitCircle(ctx, b.x, b.y, b.r, b.level)

  // 待投放 + 落点竖直虚线
  const pending = engine.pendingLevel
  if (pending != null && !engine.isEnded) {
    const r = getFruit(pending).radius
    const x = engine.aimX
    const y = DROP_Y
    const alpha = engine.dropLocked ? 0.45 : 1

    drawVLine(ctx, x, y + r + 2, WORLD_HEIGHT - 2, [4, 6], 'rgba(163,230,53,0.55)', 1.5)
    drawFruitCircle(ctx, x, y, r, pending, alpha)
  }

  const flash = engine.mergeFlash
  if (flash) {
    ctx.fillStyle = '#a3e635'
    ctx.font = 'bold 14px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillText(`+${flash.score}`, flash.x, flash.y - 18)
  }

  if (engine.status === 'ready' && engine.bodies.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = '12px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    wrapFillText(ctx, labels.hint, WORLD_WIDTH / 2, WORLD_HEIGHT - 48, WORLD_WIDTH - 32, 16)
  }
}

function wrapFillText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  const chars = Array.from(text)
  let line = ''
  let yy = y
  for (const ch of chars) {
    const test = line + ch
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy)
      line = ch
      yy += lineHeight
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, x, yy)
}

/** HUD / 图例小圆 */
export function drawFruitIcon(
  ctx: CanvasRenderingContext2D,
  level: number,
  cx: number,
  cy: number,
  size: number,
): void {
  drawFruitCircle(ctx, cx, cy, size / 2, level)
}
