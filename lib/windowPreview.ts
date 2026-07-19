const PREVIEW_MAX_W = 220
const PREVIEW_MAX_H = 150

/** 按 data-window-id 查找窗口根节点 */
export function queryWindowEl(id: string): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector(`[data-window-id="${CSS.escape(id)}"]`)
}

/**
 * 将窗口 DOM 克隆并缩放挂到 host 内，用于任务栏悬停预览。
 * 会同步拷贝 canvas 像素（画板等）。返回清理函数。
 */
export function mountWindowPreviewClone(
  source: HTMLElement,
  host: HTMLElement,
  maxWidth = PREVIEW_MAX_W,
  maxHeight = PREVIEW_MAX_H,
): () => void {
  const w = source.offsetWidth || Math.round(source.getBoundingClientRect().width)
  const h = source.offsetHeight || Math.round(source.getBoundingClientRect().height)
  if (!w || !h) return () => {}

  const scale = Math.min(maxWidth / w, maxHeight / h, 1)
  const clone = source.cloneNode(true) as HTMLElement
  clone.removeAttribute('data-window-id')
  clone.className = clone.className.replace(/\bfixed\b/g, 'relative')
  clone.style.cssText = [
    'position:relative',
    'left:0',
    'top:0',
    'transform:none',
    'visibility:visible',
    'pointer-events:none',
    'z-index:auto',
    `width:${w}px`,
    `height:${h}px`,
    'margin:0',
    'will-change:auto',
  ].join(';')

  const srcCanvases = source.querySelectorAll('canvas')
  const dstCanvases = clone.querySelectorAll('canvas')
  srcCanvases.forEach((src, i) => {
    const dst = dstCanvases[i]
    if (!(dst instanceof HTMLCanvasElement) || !(src instanceof HTMLCanvasElement)) return
    dst.width = src.width
    dst.height = src.height
    const ctx = dst.getContext('2d')
    if (!ctx) return
    try {
      ctx.drawImage(src, 0, 0)
    } catch {
      /* tainted / empty canvas */
    }
  })

  host.replaceChildren()
  const scaler = document.createElement('div')
  scaler.style.width = `${Math.round(w * scale)}px`
  scaler.style.height = `${Math.round(h * scale)}px`
  scaler.style.overflow = 'hidden'
  scaler.style.position = 'relative'

  const inner = document.createElement('div')
  inner.style.transform = `scale(${scale})`
  inner.style.transformOrigin = 'top left'
  inner.style.width = `${w}px`
  inner.style.height = `${h}px`
  inner.appendChild(clone)
  scaler.appendChild(inner)
  host.appendChild(scaler)

  return () => {
    host.replaceChildren()
  }
}
