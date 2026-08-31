import type { DesktopAppId } from '@/config/desktop'
import { isServer } from '@/lib/env'

const TASKBAR_ATTR = 'data-taskbar-app-id'

/** 任务栏窗口按钮选择器属性名 */
export const TASKBAR_APP_ATTR = TASKBAR_ATTR

export type DockPose = {
  x: number
  y: number
  scale: number
}

/** 按 app id 查找任务栏按钮矩形 */
export function queryTaskbarAppButton(id: string): Nullable<HTMLElement> {
  if (isServer) return null
  return document.querySelector(`[${TASKBAR_ATTR}="${CSS.escape(id)}"]`)
}

/**
 * 计算窗口飞向/飞出任务栏按钮时的 translate + scale
 *（transform-origin: center center，left/top 仍为 0）
 */
export function getDockPoseForWindow(appId: string, winWidth: number, winHeight: number): Nullable<DockPose> {
  const el = queryTaskbarAppButton(appId)
  const w = Math.max(1, winWidth)
  const h = Math.max(1, winHeight)

  if (el) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) {
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const scale = Math.min(r.width / w, r.height / h, 0.2) * 0.92
      return {
        x: cx - w / 2,
        y: cy - h / 2,
        scale: Math.max(0.04, scale),
      }
    }
  }

  // 无按钮时：落到视口底边对应水平中心
  if (isServer) return null
  const cx = window.innerWidth / 2
  const cy = window.innerHeight - 24
  return {
    x: cx - w / 2,
    y: cy - h / 2,
    scale: 0.08,
  }
}

/** 动画期间高亮任务栏按钮 */
export function setTaskbarAppAnimating(id: DesktopAppId | string, on: boolean) {
  const el = queryTaskbarAppButton(id)
  if (!el) return
  el.toggleAttribute('data-taskbar-animating', on)
}
