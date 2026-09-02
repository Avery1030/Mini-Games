import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { DesktopAppId, DesktopWindowRuntime, WindowBounds } from '@/config/desktop'
import { DEFAULT_WINDOW_RUNTIME } from '@/config/desktop'
import {
  createDefaultWindows,
  getDesktopWindow,
  registerWindowController,
  restorePersistedIdeSessions,
  restorePersistedOfficeSessions,
  restorePersistedExplorerSessions,
} from '@/lib/desktop/window'
import { STORAGE_KEYS, appStorage } from '@/lib/storage'

const WINDOW_Z_BASE = 1000

type WindowsMap = Record<DesktopAppId, DesktopWindowRuntime>

/** 批量最小化前的可见窗口快照（内存态） */
type ShowDesktopSnapshot = {
  visibleIds: DesktopAppId[]
  activeId: Nullable<DesktopAppId>
}

interface WindowState {
  windows: WindowsMap
  topZIndex: number
  /** 下一个新打开窗口的任务栏序号 */
  nextOpenOrder: number
  /**
   * 任务栏「显示桌面」快照：记录批量最小化前仍可见的窗口。
   * 不入 persist；有快照且当前无可见窗时，再次 toggle 会还原。
   */
  showDesktopSnapshot: Nullable<ShowDesktopSnapshot>
  _hasHydrated: boolean
}

interface WindowActions {
  setHasHydrated: (value: boolean) => void
  openWindow: (id: DesktopAppId) => void
  closeWindow: (id: DesktopAppId) => void
  /**
   * 强制结束任务：跳过 onBeforeClose（用于任务管理器「结束任务」）。
   * 仍会调用 onAfterClose。
   */
  forceCloseWindow: (id: DesktopAppId) => void
  closeAllWindows: () => void
  minimizeWindow: (id: DesktopAppId) => void
  /**
   * 任务栏空白双击：有可见窗 → 记下状态并全部最小化；
   * 已全部最小化且有快照 → 还原之前可见窗。
   */
  toggleMinimizeAllWindows: () => void
  /** 一键最小化全部可见窗口（记快照，便于之后「显示桌面」还原） */
  minimizeAllWindows: (opts?: { excludeIds?: DesktopAppId[] }) => void
  /** 记忆窗口位置/尺寸（关闭后仍保留） */
  updateWindowBounds: (id: DesktopAppId, bounds: WindowBounds) => void
  focusWindow: (id: DesktopAppId) => void
  handleTaskbarClick: (id: DesktopAppId) => void
  /**
   * 仅重排任务栏 openOrder，不改 zIndex / active / minimized。
   * @param orderedIds 当前打开窗口的期望从左到右顺序
   */
  reorderTaskbarWindows: (orderedIds: DesktopAppId[]) => void
  /** 动态注册时确保有运行时槽位 */
  ensureWindow: (id: DesktopAppId) => void
  /** 动态注销时移除运行时槽位 */
  removeWindow: (id: DesktopAppId) => void
}

export type WindowStore = WindowState & WindowActions

function patchWindow(windows: WindowsMap, id: DesktopAppId, patch: Partial<DesktopWindowRuntime>): WindowsMap {
  return {
    ...windows,
    [id]: { ...windows[id], ...patch },
  }
}

function activateNext(windows: WindowsMap, excludeId: DesktopAppId): WindowsMap {
  const candidates = (Object.entries(windows) as [DesktopAppId, DesktopWindowRuntime][]).filter(
    ([id, w]) => id !== excludeId && w.isOpen,
  )
  const visible = candidates.filter(([, w]) => !w.minimized).sort(([, a], [, b]) => b.zIndex - a.zIndex)
  const next = visible[0] ?? candidates.sort(([, a], [, b]) => b.zIndex - a.zIndex)[0]
  if (!next) {
    return Object.fromEntries(Object.entries(windows).map(([id, w]) => [id, { ...w, active: false }])) as WindowsMap
  }

  const nextId = next[0]
  return Object.fromEntries(
    Object.entries(windows).map(([id, w]) => [id, { ...w, active: id === nextId }]),
  ) as WindowsMap
}

function bringToFront(
  windows: WindowsMap,
  id: DesktopAppId,
  nextZ: number,
  patch?: Partial<Pick<DesktopWindowRuntime, 'isOpen' | 'minimized' | 'openOrder'>>,
): WindowsMap {
  return Object.fromEntries(
    Object.entries(windows).map(([appId, w]) => {
      if (appId !== id) return [appId, { ...w, active: false }]
      return [appId, { ...w, ...patch, active: true, zIndex: nextZ }]
    }),
  ) as WindowsMap
}

function getNextZ(windows: WindowsMap, topZIndex: number): number {
  const maxOpenZ = (Object.values(windows) as DesktopWindowRuntime[]).reduce(
    (max, w) => (w.isOpen ? Math.max(max, w.zIndex) : max),
    WINDOW_Z_BASE,
  )
  return Math.max(topZIndex, maxOpenZ) + 1
}

function normalizeBounds(raw: unknown): Nullable<WindowBounds> {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Partial<WindowBounds>
  if (
    typeof b.x !== 'number' ||
    typeof b.y !== 'number' ||
    typeof b.width !== 'number' ||
    typeof b.height !== 'number'
  ) {
    return null
  }
  return {
    x: b.x,
    y: b.y,
    width: Math.max(200, b.width),
    height: Math.max(150, b.height),
    maximized: b.maximized === true,
  }
}

function mergeWindows(saved?: Partial<Record<DesktopAppId, Partial<DesktopWindowRuntime>>>): WindowsMap {
  restorePersistedIdeSessions()
  restorePersistedOfficeSessions()
  restorePersistedExplorerSessions()
  const defaults = createDefaultWindows()
  const known = new Set(Object.keys(defaults))
  const ids = new Set<string>([...known])
  for (const id of Object.keys(saved ?? {})) {
    if (
      known.has(id) ||
      id.startsWith('folder_') ||
      id.startsWith('text_') ||
      id.startsWith('ide_') ||
      id.startsWith('wri_') ||
      id.startsWith('sht_') ||
      id.startsWith('exp_')
    ) {
      ids.add(id)
    }
  }
  return Object.fromEntries(
    [...ids].map((id) => {
      const fallback = defaults[id] ?? { ...DEFAULT_WINDOW_RUNTIME }
      const s = saved?.[id]
      if (!s) return [id, fallback]
      return [
        id,
        {
          isOpen: s.isOpen ?? fallback.isOpen,
          minimized: s.minimized ?? fallback.minimized,
          active: s.active ?? fallback.active,
          zIndex: s.zIndex ?? fallback.zIndex,
          openOrder: s.openOrder ?? (s.isOpen ? (s.zIndex ?? fallback.openOrder) : 0),
          bounds: normalizeBounds(s.bounds) ?? fallback.bounds,
        },
      ]
    }),
  ) as WindowsMap
}

/** 重置开关状态时保留各窗记忆几何（含动态窗口） */
function resetOpenStateKeepBounds(windows: WindowsMap): WindowsMap {
  return Object.fromEntries(
    Object.entries(windows).map(([id, w]) => [
      id,
      {
        ...DEFAULT_WINDOW_RUNTIME,
        bounds: w.bounds ?? null,
      },
    ]),
  ) as WindowsMap
}

function nextOrderFromWindows(windows: WindowsMap, nextOpenOrder: number): number {
  const maxOrder = (Object.values(windows) as DesktopWindowRuntime[]).reduce(
    (max, w) => (w.isOpen ? Math.max(max, w.openOrder) : max),
    0,
  )
  return Math.max(nextOpenOrder, maxOrder + 1)
}

export const useWindowStore = create<WindowStore>()(
  persist(
    (set, get) => ({
      windows: createDefaultWindows(),
      topZIndex: WINDOW_Z_BASE,
      nextOpenOrder: 1,
      showDesktopSnapshot: null,
      _hasHydrated: false,

      setHasHydrated: (value) => set({ _hasHydrated: value }),

      openWindow: (id) => {
        const deskWin = getDesktopWindow(id)
        if (!deskWin?.app) return
        // 先开始拉 chunk，再进 onBeforeOpen / 设 isOpen，缩短内容区空白
        deskWin.prefetchApp()
        if (!deskWin.onBeforeOpen()) return
        const { windows, topZIndex, nextOpenOrder } = get()
        const nextZ = getNextZ(windows, topZIndex)
        const wasClosed = !windows[id]?.isOpen
        const openOrder = wasClosed ? nextOrderFromWindows(windows, nextOpenOrder) : windows[id].openOrder
        set({
          topZIndex: nextZ,
          nextOpenOrder: wasClosed ? openOrder + 1 : nextOpenOrder,
          windows: bringToFront(windows, id, nextZ, {
            isOpen: true,
            minimized: false,
            ...(wasClosed ? { openOrder } : {}),
          }),
        })
        deskWin.onAfterOpen()
      },

      closeWindow: (id) => {
        const { windows } = get()
        const target = windows[id]
        if (!target) return
        const deskWin = getDesktopWindow(id)
        if (deskWin && !deskWin.onBeforeClose()) return

        // 关闭时保留 bounds，供下次打开恢复
        let next = patchWindow(windows, id, {
          isOpen: false,
          minimized: false,
          active: false,
          zIndex: 0,
          openOrder: 0,
        })
        if (target.active) {
          next = activateNext(next, id)
        }
        set({ windows: next })
        deskWin?.onAfterClose()
      },

      forceCloseWindow: (id) => {
        const { windows } = get()
        const target = windows[id]
        if (!target?.isOpen) return
        const deskWin = getDesktopWindow(id)

        let next = patchWindow(windows, id, {
          isOpen: false,
          minimized: false,
          active: false,
          zIndex: 0,
          openOrder: 0,
        })
        if (target.active) {
          next = activateNext(next, id)
        }
        set({ windows: next })
        deskWin?.onAfterClose()
      },

      closeAllWindows: () => {
        const { windows } = get()
        set({
          windows: resetOpenStateKeepBounds(windows),
          topZIndex: WINDOW_Z_BASE,
          nextOpenOrder: 1,
        })
      },

      updateWindowBounds: (id, bounds) => {
        const { windows } = get()
        if (!windows[id]) return
        const next = normalizeBounds(bounds)
        if (!next) return
        set({ windows: patchWindow(windows, id, { bounds: next }) })
      },

      minimizeWindow: (id) => {
        const { windows } = get()
        const target = windows[id]
        if (!target?.isOpen) return
        const deskWin = getDesktopWindow(id)
        if (deskWin && !deskWin.onBeforeMinimize()) return

        let next = patchWindow(windows, id, { minimized: true, active: false })
        if (target.active) {
          next = activateNext(next, id)
        }
        set({ windows: next })
        deskWin?.onAfterMinimize()
      },

      minimizeAllWindows: (opts) => {
        const exclude = new Set(opts?.excludeIds ?? [])
        const { windows } = get()
        const openEntries = (Object.entries(windows) as [DesktopAppId, DesktopWindowRuntime][]).filter(
          ([, w]) => w.isOpen,
        )
        const visibleIds = openEntries
          .filter(([id, w]) => !w.minimized && !exclude.has(id))
          .map(([id]) => id)
        if (visibleIds.length === 0) return

        const activeId =
          openEntries.find(([id, w]) => w.active && !w.minimized && !exclude.has(id))?.[0] ??
          visibleIds.slice().sort((a, b) => windows[b].zIndex - windows[a].zIndex)[0] ??
          null

        const next = { ...windows }
        for (const id of visibleIds) {
          next[id] = { ...next[id], minimized: true, active: false }
        }
        // 若当前活动窗被排除，保持其 active
        if (exclude.size > 0) {
          for (const id of exclude) {
            if (next[id]?.isOpen && !next[id].minimized) {
              next[id] = { ...next[id], active: true }
              break
            }
          }
        }
        set({
          windows: next,
          showDesktopSnapshot: { visibleIds, activeId },
        })
      },

      toggleMinimizeAllWindows: () => {
        const { windows, showDesktopSnapshot, topZIndex, minimizeAllWindows } = get()
        const openEntries = (Object.entries(windows) as [DesktopAppId, DesktopWindowRuntime][]).filter(
          ([, w]) => w.isOpen,
        )
        const visibleIds = openEntries.filter(([, w]) => !w.minimized).map(([id]) => id)

        // 无可见窗 + 有快照 → 还原
        if (visibleIds.length === 0) {
          if (!showDesktopSnapshot?.visibleIds.length) return

          let next = { ...windows }
          let nextZ = topZIndex
          const restoreIds = showDesktopSnapshot.visibleIds.filter((id) => next[id]?.isOpen)
          for (const id of restoreIds) {
            next[id] = { ...next[id], minimized: false, active: false }
          }

          const preferred =
            showDesktopSnapshot.activeId && restoreIds.includes(showDesktopSnapshot.activeId)
              ? showDesktopSnapshot.activeId
              : restoreIds[restoreIds.length - 1]

          if (preferred) {
            nextZ = getNextZ(next, topZIndex)
            next = bringToFront(next, preferred, nextZ, { minimized: false })
          }

          set({
            windows: next,
            topZIndex: nextZ,
            showDesktopSnapshot: null,
          })
          return
        }

        minimizeAllWindows()
      },

      focusWindow: (id) => {
        const { windows, topZIndex } = get()
        const target = windows[id]
        if (!target?.isOpen || target.minimized) return
        if (target.active) return

        const nextZ = getNextZ(windows, topZIndex)
        set({
          topZIndex: nextZ,
          windows: bringToFront(windows, id, nextZ),
        })
      },

      /**
       * 任务栏点击（Windows 经典行为）：
       * - 已最小化 → 还原并激活
       * - 已激活且可见 → 最小化
       * - 可见但未激活 → 激活（置顶）
       */
      handleTaskbarClick: (id) => {
        const { windows, openWindow, minimizeWindow, focusWindow } = get()
        const target = windows[id]
        if (!target?.isOpen) return

        if (target.minimized) {
          openWindow(id)
          return
        }
        if (target.active) {
          minimizeWindow(id)
          return
        }
        focusWindow(id)
      },

      reorderTaskbarWindows: (orderedIds) => {
        const { windows } = get()
        const seen = new Set<DesktopAppId>()
        const ordered: DesktopAppId[] = []
        for (const id of orderedIds) {
          if (!windows[id]?.isOpen || seen.has(id)) continue
          seen.add(id)
          ordered.push(id)
        }
        // 遗漏的打开窗追加到末尾，保持原相对顺序
        const rest = (Object.entries(windows) as [DesktopAppId, DesktopWindowRuntime][])
          .filter(([id, w]) => w.isOpen && !seen.has(id))
          .sort(([, a], [, b]) => a.openOrder - b.openOrder)
          .map(([id]) => id)
        const finalOrder = [...ordered, ...rest]
        if (finalOrder.length === 0) return

        const next = { ...windows }
        finalOrder.forEach((id, i) => {
          next[id] = { ...next[id], openOrder: i + 1 }
        })
        set({
          windows: next,
          nextOpenOrder: finalOrder.length + 1,
        })
      },

      ensureWindow: (id) => {
        const { windows } = get()
        if (windows[id]) return
        set({ windows: { ...windows, [id]: { ...DEFAULT_WINDOW_RUNTIME } } })
      },

      removeWindow: (id) => {
        const { windows } = get()
        if (!windows[id]) return
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [id]: _removed, ...rest } = windows
        set({ windows: rest as WindowsMap })
      },
    }),
    {
      name: STORAGE_KEYS.windows,
      version: 2,
      storage: createJSONStorage(() => appStorage.createStateStorage()),
      partialize: (state) => ({
        windows: state.windows,
        topZIndex: state.topZIndex,
        nextOpenOrder: state.nextOpenOrder,
      }),
      migrate: (persisted) => {
        const raw = (persisted ?? {}) as {
          windows?: Partial<Record<DesktopAppId, Partial<DesktopWindowRuntime>>>
          topZIndex?: unknown
          nextOpenOrder?: unknown
        }
        return {
          windows: raw.windows && typeof raw.windows === 'object' ? raw.windows : {},
          topZIndex: typeof raw.topZIndex === 'number' ? raw.topZIndex : WINDOW_Z_BASE,
          nextOpenOrder: typeof raw.nextOpenOrder === 'number' ? raw.nextOpenOrder : 1,
        }
      },
      merge: (persisted, current) => {
        const saved = persisted as
          | {
              windows?: Partial<Record<DesktopAppId, Partial<DesktopWindowRuntime>>>
              topZIndex?: number
              nextOpenOrder?: number
            }
          | undefined
        const windows = mergeWindows(saved?.windows)
        const maxOrder = (Object.values(windows) as DesktopWindowRuntime[]).reduce(
          (max, w) => Math.max(max, w.openOrder),
          0,
        )
        return {
          ...current,
          windows,
          topZIndex: saved?.topZIndex ?? WINDOW_Z_BASE,
          nextOpenOrder: Math.max(saved?.nextOpenOrder ?? 1, maxOrder + 1),
        }
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    },
  ),
)

registerWindowController({
  openWindow: (id) => useWindowStore.getState().openWindow(id),
  closeWindow: (id) => useWindowStore.getState().closeWindow(id),
  minimizeWindow: (id) => useWindowStore.getState().minimizeWindow(id),
  focusWindow: (id) => useWindowStore.getState().focusWindow(id),
  getRuntime: (id) => useWindowStore.getState().windows[id],
  ensureWindow: (id) => useWindowStore.getState().ensureWindow(id),
  removeWindow: (id) => useWindowStore.getState().removeWindow(id),
})
