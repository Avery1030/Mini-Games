import type { DesktopAppId } from '@/config/desktop'
import { DESKTOP_WINDOWS, getDesktopWindow } from './registry'

/** 与 features/games/ids 对齐：游戏夹内应用（预取优先级） */
const GAME_PREFETCH_IDS: readonly DesktopAppId[] = [
  'minesweeper',
  'tetris',
  'suika',
  'tileMatch',
  'match3',
  'imagePuzzle',
  'canvasJigsaw',
  'sokoban',
  'sudoku',
]

/** 较大依赖，空闲预取时靠后 */
const HEAVY_PREFETCH_IDS = new Set<DesktopAppId>(['klineChartViewer', 'aiChat', 'paint'])

/** 空闲预取优先级：桌面可见 → 游戏 → 开始菜单 → 其余（重应用靠后） */
function prioritizedBuiltinIds(): DesktopAppId[] {
  const gameSet = new Set<DesktopAppId>(GAME_PREFETCH_IDS)

  const scored = DESKTOP_WINDOWS.map((w) => {
    let score = 3
    if (w.showOnDesktop !== false) score = 0
    else if (gameSet.has(w.id)) score = 1
    else if (w.showInStartMenu !== false) score = 2
    if (HEAVY_PREFETCH_IDS.has(w.id)) score += 10
    return { id: w.id, score }
  })

  scored.sort((a, b) => a.score - b.score || String(a.id).localeCompare(String(b.id)))
  return scored.map((x) => x.id)
}

/** 立即预取指定应用（已加载的会瞬间返回） */
export function prefetchApps(ids: readonly DesktopAppId[]): void {
  for (const id of ids) getDesktopWindow(id)?.prefetchApp()
}

/**
 * 桌面就绪后在空闲时段逐个预热内置应用 chunk。
 * 返回取消函数（卸载 / 再次调度时调用）。
 */
export function scheduleIdlePrefetchBuiltinApps(): () => void {
  const ids = prioritizedBuiltinIds()
  let index = 0
  let cancelled = false
  let idleHandle = 0
  let timeoutHandle = 0

  const clearScheduled = () => {
    if (idleHandle && typeof cancelIdleCallback === 'function') {
      cancelIdleCallback(idleHandle)
      idleHandle = 0
    }
    if (timeoutHandle) {
      window.clearTimeout(timeoutHandle)
      timeoutHandle = 0
    }
  }

  const tick = () => {
    if (cancelled || index >= ids.length) return
    getDesktopWindow(ids[index++]!)?.prefetchApp()
    scheduleNext()
  }

  const scheduleNext = () => {
    if (cancelled || index >= ids.length) return
    if (typeof requestIdleCallback === 'function') {
      idleHandle = requestIdleCallback(tick, { timeout: 1500 })
    } else {
      timeoutHandle = window.setTimeout(tick, 40)
    }
  }

  // 稍等一帧，避开首屏绘制争抢带宽
  timeoutHandle = window.setTimeout(() => {
    timeoutHandle = 0
    scheduleNext()
  }, 400)

  return () => {
    cancelled = true
    clearScheduled()
  }
}
