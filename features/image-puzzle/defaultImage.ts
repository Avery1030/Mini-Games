/** 生成内置默认拼图素材（Canvas 绘制风景，不依赖外部资源） */

const W = 512
const H = 512

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/**
 * 同步绘制默认图并返回 data URL；在无 document 环境返回空串。
 */
export function createDefaultPuzzleImage(): string {
  if (typeof document === 'undefined') return ''

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // 天空
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.55)
  sky.addColorStop(0, '#5ba3d9')
  sky.addColorStop(1, '#c8e4f7')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)

  // 远山
  ctx.fillStyle = '#7a9e6a'
  ctx.beginPath()
  ctx.moveTo(0, H * 0.52)
  ctx.lineTo(W * 0.22, H * 0.38)
  ctx.lineTo(W * 0.45, H * 0.5)
  ctx.lineTo(W * 0.7, H * 0.34)
  ctx.lineTo(W, H * 0.48)
  ctx.lineTo(W, H)
  ctx.lineTo(0, H)
  ctx.closePath()
  ctx.fill()

  // 近坡
  ctx.fillStyle = '#5f8f4a'
  ctx.beginPath()
  ctx.moveTo(0, H * 0.62)
  ctx.quadraticCurveTo(W * 0.35, H * 0.52, W * 0.55, H * 0.6)
  ctx.quadraticCurveTo(W * 0.8, H * 0.7, W, H * 0.58)
  ctx.lineTo(W, H)
  ctx.lineTo(0, H)
  ctx.closePath()
  ctx.fill()

  // 太阳
  ctx.fillStyle = '#ffe566'
  ctx.beginPath()
  ctx.arc(W * 0.78, H * 0.18, 36, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#f0c040'
  ctx.lineWidth = 3
  ctx.stroke()

  // 白云
  const drawCloud = (cx: number, cy: number, s: number) => {
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.beginPath()
    ctx.arc(cx, cy, 18 * s, 0, Math.PI * 2)
    ctx.arc(cx + 22 * s, cy - 6 * s, 22 * s, 0, Math.PI * 2)
    ctx.arc(cx + 46 * s, cy, 16 * s, 0, Math.PI * 2)
    ctx.arc(cx + 22 * s, cy + 8 * s, 18 * s, 0, Math.PI * 2)
    ctx.fill()
  }
  drawCloud(W * 0.18, H * 0.2, 1.1)
  drawCloud(W * 0.48, H * 0.14, 0.85)

  // 小屋
  const hx = W * 0.28
  const hy = H * 0.58
  ctx.fillStyle = '#d4a574'
  ctx.fillRect(hx, hy, 70, 55)
  ctx.fillStyle = '#b5523a'
  ctx.beginPath()
  ctx.moveTo(hx - 8, hy)
  ctx.lineTo(hx + 35, hy - 32)
  ctx.lineTo(hx + 78, hy)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#6b3e2e'
  ctx.fillRect(hx + 28, hy + 22, 18, 33)
  ctx.fillStyle = '#87ceeb'
  ctx.fillRect(hx + 8, hy + 12, 16, 14)

  // 树木
  const tree = (tx: number, ty: number) => {
    ctx.fillStyle = '#6b4226'
    ctx.fillRect(tx - 4, ty, 8, 28)
    ctx.fillStyle = '#3d7a3a'
    ctx.beginPath()
    ctx.moveTo(tx, ty - 36)
    ctx.lineTo(tx + 22, ty)
    ctx.lineTo(tx - 22, ty)
    ctx.closePath()
    ctx.fill()
  }
  tree(W * 0.62, H * 0.68)
  tree(W * 0.72, H * 0.72)
  tree(W * 0.18, H * 0.74)

  // 装饰边框（便于辨认碎片）
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 8
  roundRect(ctx, 10, 10, W - 20, H - 20, 12)
  ctx.stroke()

  try {
    return canvas.toDataURL('image/png')
  } catch {
    return ''
  }
}
