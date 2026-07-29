import { isClient, isServer } from '@/lib/env'
import type { WindowBounds } from '@/config/desktop'
import { getDockPoseForWindow } from '@/lib/desktop/dockPose'

export const MIN_WIDTH = 200
export const MIN_HEIGHT = 150
export const TASKBAR_H = 48
/** 窗口最大/最小化与任务栏飞入飞出时长 */
export const WINDOW_ANIM_MS = 200
export const WINDOW_ANIM_S = `${WINDOW_ANIM_MS / 1000}s`

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export type WindowPose = {
  x: number
  y: number
  scale: number
  opacity: number
}

export type WindowSeed = {
  position: { x: number; y: number }
  size: { width: number; height: number }
  maximized: boolean
}

export type MinAnim = 'shown' | 'hiding' | 'hidden' | 'showing'

export function maximizedSize() {
  if (isServer) return { width: 800, height: 600 }
  return {
    width: window.innerWidth,
    height: Math.max(240, window.innerHeight - TASKBAR_H),
  }
}

export function clampBounds(b: { x: number; y: number; width: number; height: number }) {
  return {
    x: b.x,
    y: b.y,
    width: Math.max(MIN_WIDTH, b.width),
    height: Math.max(MIN_HEIGHT, b.height),
  }
}

export function createWindowSeed(opts: {
  rememberedBounds?: WindowBounds | null
  defaultPosition?: { x: number; y: number }
  defaultMaximized?: boolean
  width: number
  height: number
}): WindowSeed {
  const { rememberedBounds, defaultPosition, defaultMaximized = false, width, height } = opts
  if (rememberedBounds) {
    const normal = clampBounds(rememberedBounds)
    return {
      position: { x: normal.x, y: normal.y },
      size: { width: normal.width, height: normal.height },
      maximized: rememberedBounds.maximized,
    }
  }
  const pos =
    defaultPosition ??
    (isServer
      ? { x: 100, y: 80 }
      : {
          x: Math.max(20, (window.innerWidth - width) / 2),
          y: Math.max(20, (window.innerHeight - height) / 2 - 40),
        })
  return {
    position: pos,
    size: { width, height },
    maximized: defaultMaximized,
  }
}

/** 飞向任务栏按钮的 pose（含淡出） */
export function resolveDockPose(appId: string | undefined, w: number, h: number): WindowPose {
  const dock = appId ? getDockPoseForWindow(appId, w, h) : null
  if (dock) return { ...dock, opacity: 0 }
  return {
    x: isClient ? window.innerWidth / 2 - w / 2 : 0,
    y: isClient ? window.innerHeight - 40 - h / 2 : 0,
    scale: 0.08,
    opacity: 0,
  }
}

/** 双 rAF 后再执行，确保起始样式已绘制 */
export function afterPaint(fn: () => void): () => void {
  let raf2 = 0
  const raf1 = requestAnimationFrame(() => {
    raf2 = requestAnimationFrame(fn)
  })
  return () => {
    cancelAnimationFrame(raf1)
    cancelAnimationFrame(raf2)
  }
}

export const RESIZE_HANDLES: { edge: ResizeEdge; className: string; cursor: string }[] = [
  { edge: 'n', className: 'left-0 right-0 top-0 h-[5px]', cursor: 'ns-resize' },
  { edge: 's', className: 'left-0 right-0 bottom-0 h-[5px]', cursor: 's-resize' },
  { edge: 'e', className: 'right-0 top-0 bottom-0 w-[5px]', cursor: 'ew-resize' },
  { edge: 'w', className: 'left-0 top-0 bottom-0 w-[5px]', cursor: 'w-resize' },
  { edge: 'ne', className: 'right-0 top-0 w-[5px] h-[5px]', cursor: 'nesw-resize' },
  { edge: 'nw', className: 'left-0 top-0 w-[5px] h-[5px]', cursor: 'nwse-resize' },
  { edge: 'se', className: 'right-0 bottom-0 w-[5px] h-[5px]', cursor: 'nwse-resize' },
  { edge: 'sw', className: 'left-0 bottom-0 w-[5px] h-[5px]', cursor: 'nesw-resize' },
]
