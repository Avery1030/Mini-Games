'use client'

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  forwardRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { cn } from '@/lib/cn'
import { CANVAS_HEIGHT, CANVAS_WIDTH, type PaintTool } from './types'

const MAX_HISTORY = 30
const ASPECT = CANVAS_WIDTH / CANVAS_HEIGHT
/** 限制过大位图，避免撤回栈与保存体积爆炸 */
const MAX_CSS_W = 1600
const MAX_CSS_H = 1000

export type DrawingCanvasHandle = {
  clear: () => void
  undo: () => boolean
  canUndo: () => boolean
  exportPngBase64: () => string
  loadFromUrl: (url: Nullable<string>) => Promise<void>
  isBlank: () => boolean
}

type Point = { x: number; y: number }
type Size = { w: number; h: number }

export interface DrawingCanvasProps {
  tool: PaintTool
  color: string
  brushSize: number
  disabled?: boolean
  onDirty: () => void
  onCanUndoChange?: (canUndo: boolean) => void
  onBaselineRestored?: () => void
  className?: string
}

function fitCssSize(containerW: number, containerH: number): Size {
  if (containerW <= 0 || containerH <= 0) {
    return { w: CANVAS_WIDTH, h: CANVAS_HEIGHT }
  }
  let w = containerW
  let h = w / ASPECT
  if (h > containerH) {
    h = containerH
    w = h * ASPECT
  }
  w = Math.min(MAX_CSS_W, Math.max(1, Math.floor(w)))
  h = Math.min(MAX_CSS_H, Math.max(1, Math.floor(h)))
  return { w, h }
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  tool: 'line' | 'rect' | 'ellipse',
  from: Point,
  to: Point,
) {
  ctx.beginPath()
  if (tool === 'line') {
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    return
  }
  const x = Math.min(from.x, to.x)
  const y = Math.min(from.y, to.y)
  const w = Math.abs(to.x - from.x)
  const h = Math.abs(to.y - from.y)
  if (tool === 'rect') {
    ctx.strokeRect(x, y, w, h)
    return
  }
  ctx.ellipse(x + w / 2, y + h / 2, w / 2 || 0.5, h / 2 || 0.5, 0, 0, Math.PI * 2)
  ctx.stroke()
}

/**
 * 画布 CSS 尺寸随容器放大，位图按 devicePixelRatio 同步提高，避免放大模糊、笔触发粗。
 */
export const DrawingCanvas = forwardRef<DrawingCanvasHandle, DrawingCanvasProps>(
  function DrawingCanvas(
    { tool, color, brushSize, disabled, onDirty, onCanUndoChange, onBaselineRestored, className },
    ref,
  ) {
    const shellRef = useRef<HTMLDivElement>(null)
    const baseRef = useRef<HTMLCanvasElement>(null)
    const overlayRef = useRef<HTMLCanvasElement>(null)
    const drawing = useRef(false)
    const start = useRef<Nullable<Point>>(null)
    const last = useRef<Nullable<Point>>(null)
    const historyRef = useRef<ImageData[]>([])
    const snapshotTaken = useRef(false)
    const sizeRef = useRef<Size>({ w: CANVAS_WIDTH, h: CANVAS_HEIGHT })
    const dprRef = useRef(1)
    const [, bumpCanUndo] = useState(0)
    const [display, setDisplay] = useState<Size>({ w: CANVAS_WIDTH, h: CANVAS_HEIGHT })

    const notifyCanUndo = useCallback(() => {
      onCanUndoChange?.(historyRef.current.length > 0)
      bumpCanUndo((n) => n + 1)
    }, [onCanUndoChange])

    const resetHistory = useCallback(() => {
      historyRef.current = []
      notifyCanUndo()
    }, [notifyCanUndo])

    const applyHiDpi = useCallback((canvas: HTMLCanvasElement, css: Size, dpr: number) => {
      canvas.width = Math.max(1, Math.floor(css.w * dpr))
      canvas.height = Math.max(1, Math.floor(css.h * dpr))
      canvas.style.width = `${css.w}px`
      canvas.style.height = `${css.h}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.imageSmoothingEnabled = true
      return ctx
    }, [])

    const fillWhite = useCallback((ctx: CanvasRenderingContext2D, css: Size) => {
      ctx.save()
      ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, css.w, css.h)
      ctx.restore()
    }, [])

    const clearOverlay = useCallback(() => {
      const overlay = overlayRef.current
      if (!overlay) return
      const ctx = overlay.getContext('2d')
      if (!ctx) return
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, overlay.width, overlay.height)
      ctx.restore()
      ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
    }, [])

    const pushHistory = useCallback(() => {
      const base = baseRef.current
      const ctx = base?.getContext('2d')
      if (!base || !ctx) return
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      const snap = ctx.getImageData(0, 0, base.width, base.height)
      ctx.restore()
      historyRef.current.push(snap)
      if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift()
      notifyCanUndo()
    }, [notifyCanUndo])

    const restoreLast = useCallback((): boolean => {
      const base = baseRef.current
      const ctx = base?.getContext('2d')
      if (!base || !ctx) return false

      let snap: ImageData | undefined
      while (historyRef.current.length > 0) {
        const candidate = historyRef.current.pop()
        if (candidate && candidate.width === base.width && candidate.height === base.height) {
          snap = candidate
          break
        }
      }
      if (!snap) {
        notifyCanUndo()
        return false
      }

      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.putImageData(snap, 0, 0)
      ctx.restore()
      ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
      notifyCanUndo()
      if (historyRef.current.length === 0) onBaselineRestored?.()
      else onDirty()
      return true
    }, [notifyCanUndo, onBaselineRestored, onDirty])

    const resizeSurfaces = useCallback(
      (css: Size, preserve: boolean) => {
        const base = baseRef.current
        const overlay = overlayRef.current
        if (!base || !overlay) return

        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        dprRef.current = dpr

        let backup: Nullable<HTMLCanvasElement> = null
        if (preserve && base.width > 0 && base.height > 0) {
          backup = document.createElement('canvas')
          backup.width = base.width
          backup.height = base.height
          const bctx = backup.getContext('2d')
          bctx?.drawImage(base, 0, 0)
        }

        const baseCtx = applyHiDpi(base, css, dpr)
        applyHiDpi(overlay, css, dpr)
        if (!baseCtx) return

        fillWhite(baseCtx, css)
        if (backup) {
          baseCtx.drawImage(backup, 0, 0, css.w, css.h)
        }
        clearOverlay()
        sizeRef.current = css
        resetHistory()
      },
      [applyHiDpi, clearOverlay, fillWhite, resetHistory],
    )

    useEffect(() => {
      const el = shellRef.current
      if (!el) return
      const update = () => {
        const { width, height } = el.getBoundingClientRect()
        const next = fitCssSize(Math.floor(width), Math.floor(height))
        setDisplay((prev) => {
          if (prev.w === next.w && prev.h === next.h) return prev
          return next
        })
      }
      update()
      const ro = new ResizeObserver(update)
      ro.observe(el)
      return () => ro.disconnect()
    }, [])

    useEffect(() => {
      const base = baseRef.current
      const hasPixels = !!base && base.width > 0 && base.height > 0
      const sizeChanged =
        sizeRef.current.w !== display.w || sizeRef.current.h !== display.h
      resizeSurfaces(display, hasPixels && sizeChanged)
    }, [display, resizeSurfaces])

    useImperativeHandle(
      ref,
      () => ({
        clear: () => {
          const base = baseRef.current
          const ctx = base?.getContext('2d')
          if (!base || !ctx) return
          pushHistory()
          fillWhite(ctx, sizeRef.current)
          clearOverlay()
          onDirty()
        },
        undo: () => restoreLast(),
        canUndo: () => historyRef.current.length > 0,
        exportPngBase64: () => {
          const base = baseRef.current
          if (!base) return ''
          // 导出按 CSS 像素尺寸的清晰 PNG（去除多余 DPR 拉伸感：缩放到 css 尺寸）
          const css = sizeRef.current
          const out = document.createElement('canvas')
          out.width = css.w
          out.height = css.h
          const octx = out.getContext('2d')
          if (!octx) return base.toDataURL('image/png')
          octx.fillStyle = '#ffffff'
          octx.fillRect(0, 0, css.w, css.h)
          octx.drawImage(base, 0, 0, css.w, css.h)
          return out.toDataURL('image/png')
        },
        loadFromUrl: async (url) => {
          const base = baseRef.current
          const ctx = base?.getContext('2d')
          if (!base || !ctx) return
          const css = sizeRef.current
          fillWhite(ctx, css)
          clearOverlay()
          resetHistory()
          if (!url) return
          await new Promise<void>((resolve, reject) => {
            const img = new Image()
            img.onload = () => {
              ctx.drawImage(img, 0, 0, css.w, css.h)
              resolve()
            }
            img.onerror = () => reject(new Error('Failed to load image'))
            img.src = url.includes('?') ? url : `${url}?t=${Date.now()}`
          })
        },
        isBlank: () => {
          const base = baseRef.current
          const ctx = base?.getContext('2d')
          if (!base || !ctx) return true
          ctx.save()
          ctx.setTransform(1, 0, 0, 1, 0, 0)
          const data = ctx.getImageData(0, 0, base.width, base.height).data
          ctx.restore()
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) return false
          }
          return true
        },
      }),
      [clearOverlay, fillWhite, onDirty, pushHistory, resetHistory, restoreLast],
    )

    const getPoint = (e: ReactPointerEvent<HTMLCanvasElement>): Point => {
      const canvas = overlayRef.current ?? baseRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      const css = sizeRef.current
      return {
        x: ((e.clientX - rect.left) / rect.width) * css.w,
        y: ((e.clientY - rect.top) / rect.height) * css.h,
      }
    }

    const strokeStyle = (target: 'base' | 'overlay' = 'base') => {
      const canvas = target === 'base' ? baseRef.current : overlayRef.current
      const ctx = canvas?.getContext('2d')
      if (!ctx) return null
      ctx.setTransform(dprRef.current, 0, 0, dprRef.current, 0, 0)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = brushSize
      if (target === 'base' && tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.strokeStyle = 'rgba(0,0,0,1)'
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = color
      }
      return ctx
    }

    const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (disabled) return
      e.currentTarget.setPointerCapture(e.pointerId)
      drawing.current = true
      const p = getPoint(e)
      start.current = p
      last.current = p
      pushHistory()
      snapshotTaken.current = true

      if (tool === 'brush' || tool === 'eraser') {
        const ctx = strokeStyle('base')
        if (!ctx) return
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x + 0.01, p.y + 0.01)
        ctx.stroke()
        onDirty()
      }
    }

    const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current || disabled) return
      const p = getPoint(e)

      if (tool === 'brush' || tool === 'eraser') {
        const ctx = strokeStyle('base')
        const prev = last.current
        if (!ctx || !prev) return
        ctx.beginPath()
        ctx.moveTo(prev.x, prev.y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
        last.current = p
        onDirty()
        return
      }

      const from = start.current
      const octx = strokeStyle('overlay')
      if (!from || !octx || !overlayRef.current) return
      clearOverlay()
      octx.lineCap = 'round'
      octx.lineJoin = 'round'
      octx.lineWidth = brushSize
      octx.strokeStyle = color
      octx.setLineDash([4, 3])
      drawShape(octx, tool, from, p)
      octx.setLineDash([])
    }

    const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!drawing.current) return
      drawing.current = false
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        // ignore
      }

      if (tool === 'line' || tool === 'rect' || tool === 'ellipse') {
        const from = start.current
        const to = getPoint(e)
        const moved = from && (Math.abs(to.x - from.x) > 1 || Math.abs(to.y - from.y) > 1)
        const ctx = strokeStyle('base')
        if (from && ctx && moved) {
          ctx.globalCompositeOperation = 'source-over'
          ctx.strokeStyle = color
          drawShape(ctx, tool, from, to)
          onDirty()
        } else if (snapshotTaken.current) {
          historyRef.current.pop()
          notifyCanUndo()
        }
        clearOverlay()
      }

      start.current = null
      last.current = null
      snapshotTaken.current = false
      const ctx = baseRef.current?.getContext('2d')
      if (ctx) ctx.globalCompositeOperation = 'source-over'
    }

    return (
      <div
        ref={shellRef}
        className={cn(
          'h-full w-full min-h-0 min-w-0 flex items-center justify-center overflow-hidden',
          className,
        )}
      >
        <div
          className='relative shrink-0 border-2 border-t-chrome-dark border-l-chrome-dark border-r-chrome-light border-b-chrome-light bg-white shadow-[1px_1px_0_rgba(0,0,0,0.15)]'
          style={{ width: display.w, height: display.h }}
        >
          <canvas ref={baseRef} className='block touch-none' />
          <canvas
            ref={overlayRef}
            className={cn(
              'absolute inset-0 touch-none',
              disabled ? 'cursor-default' : 'cursor-crosshair',
            )}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          />
        </div>
      </div>
    )
  },
)
