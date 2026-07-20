import { TASKBAR_H } from '@/lib/desktop/windowGeometry'
import { isServer } from '@/lib/env'

/** 靠近目标边进入吸附的距离 */
export const WINDOW_SNAP_THRESHOLD = 5
/** 已贴边后，需再拖这么远才解除吸附（可超出屏幕） */
export const WINDOW_SNAP_ESCAPE = 30

export type SnapPoint = { x: number; y: number }
export type SnapSize = { width: number; height: number }

/** 单次拖拽会话的轴向锁定（贴住哪条边） */
export type SnapSession = {
  lockX: number | null
  lockY: number | null
}

export function createSnapSession(): SnapSession {
  return { lockX: null, lockY: null }
}

type EdgeRect = { left: number; top: number; right: number; bottom: number }

function snapAxis(
  value: number,
  targets: number[],
  lock: number | null,
  threshold: number,
  escape: number,
): { value: number; lock: number | null } {
  // 已吸附：在 escape 距离内继续钉住，超过才放开
  if (lock != null) {
    if (Math.abs(value - lock) < escape) {
      return { value: lock, lock }
    }
  }

  let best: number | null = null
  let bestDist = threshold
  for (const t of targets) {
    const d = Math.abs(value - t)
    if (d < bestDist) {
      bestDist = d
      best = t
    }
  }
  if (best != null) return { value: best, lock: best }
  return { value, lock: null }
}

/** 收集可吸附的其它窗口矩形（跳过自身 / 最大化 / 最小化） */
export function collectSnapTargetRects(excludeId?: string): EdgeRect[] {
  if (isServer) return []
  const nodes = document.querySelectorAll<HTMLElement>('[data-window-id][data-window-snap="1"]')
  const out: EdgeRect[] = []
  for (const el of nodes) {
    const id = el.dataset.windowId
    if (!id || id === excludeId) continue
    const r = el.getBoundingClientRect()
    if (r.width < 8 || r.height < 8) continue
    out.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom })
  }
  return out
}

/**
 * 拖拽软吸附（带迟滞）：
 * - 距边 &lt; threshold 进入贴边
 * - 贴边后需拖超过 escape 才解除，从而允许强行拖出屏幕
 * session 在同一次拖拽中复用，开始拖拽时重置。
 */
export function snapWindowPosition(
  raw: SnapPoint,
  size: SnapSize,
  session: SnapSession,
  options?: { excludeId?: string; threshold?: number; escape?: number },
): SnapPoint {
  if (isServer) return raw

  const threshold = options?.threshold ?? WINDOW_SNAP_THRESHOLD
  const escape = options?.escape ?? WINDOW_SNAP_ESCAPE
  const workRight = window.innerWidth
  const workBottom = Math.max(0, window.innerHeight - TASKBAR_H)

  const xTargets: number[] = [0, workRight - size.width]
  const yTargets: number[] = [0, workBottom - size.height]

  for (const other of collectSnapTargetRects(options?.excludeId)) {
    xTargets.push(other.left, other.right, other.left - size.width, other.right - size.width)
    yTargets.push(other.top, other.bottom, other.top - size.height, other.bottom - size.height)
  }

  const sx = snapAxis(raw.x, xTargets, session.lockX, threshold, escape)
  const sy = snapAxis(raw.y, yTargets, session.lockY, threshold, escape)
  session.lockX = sx.lock
  session.lockY = sy.lock
  return { x: sx.value, y: sy.value }
}
